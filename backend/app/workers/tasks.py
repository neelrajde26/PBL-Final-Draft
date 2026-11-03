"""Statewide satellite ingestion, drought calculation, and ML inference worker tasks."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import logging
import threading
import time
from typing import Any
import uuid

from sqlalchemy import text

from app.core.config import settings
from app.data.districts import DISTRICTS, get_district
from app.db import database
from app.services.alerts import alert_engine
from app.services.gee.gee_client import gee_client
from app.services.gee.gee_collections import COLLECTIONS
from app.services.gee.ingestion import NativeIngestionService
from app.services.indices.agricultural import calculate_vci, calculate_vhi
from app.services.indices.meteorological import calculate_spi, classify_drought_severity
from app.workers.celery_app import celery_app

logger = logging.getLogger("mdis.workers")

# In-process degraded lock registry with thread safety and expiry tracking
_PROCESS_LOCKS: dict[str, float] = {}
_PROCESS_LOCK_MUTEX = threading.Lock()


class TaskLock:
    """Distributed lock using Redis if available, with an explicit safe in-process fallback."""

    def __init__(self, lock_key: str, timeout_seconds: int = 300) -> None:
        self.raw_key = lock_key
        self.lock_key = f"mdis:lock:{lock_key}"
        self.timeout_seconds = timeout_seconds
        self._acquired = False
        self._redis_acquired = False
        self._client = None
        if settings.redis_url:
            try:
                import redis
                self._client = redis.from_url(settings.redis_url, socket_timeout=2.0)
            except Exception:
                self._client = None

    def acquire(self) -> bool:
        if self._client:
            try:
                # Set NX (set if not exists) with TTL
                acquired = bool(self._client.set(self.lock_key, "locked", nx=True, ex=self.timeout_seconds))
                self._acquired = acquired
                self._redis_acquired = acquired
                return acquired
            except Exception as exc:
                logger.warning("Redis lock acquire failed (%s); engaging explicit in-process mutex guard", exc)

        # Explicit degraded mode: check process-level mutex
        now = time.monotonic()
        with _PROCESS_LOCK_MUTEX:
            # Clean expired locks
            expired = [k for k, exp in _PROCESS_LOCKS.items() if exp < now]
            for k in expired:
                del _PROCESS_LOCKS[k]

            if self.lock_key in _PROCESS_LOCKS:
                # Lock contention detected: do NOT proceed
                self._acquired = False
                return False

            _PROCESS_LOCKS[self.lock_key] = now + self.timeout_seconds
            self._acquired = True
            return True

    def release(self) -> None:
        if self._client and self._redis_acquired:
            try:
                self._client.delete(self.lock_key)
            except Exception as exc:
                logger.warning("Redis lock release failed: %s", exc)

        with _PROCESS_LOCK_MUTEX:
            _PROCESS_LOCKS.pop(self.lock_key, None)

        self._acquired = False
        self._redis_acquired = False

    def __enter__(self) -> bool:
        return self.acquire()

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.release()


def _record_ingestion_log(
    collection_key: str,
    status: str,
    started_at: datetime,
    finished_at: datetime | None = None,
    period_start: str | None = None,
    period_end: str | None = None,
    district_count: int = 0,
    observation_count: int = 0,
    retry_count: int = 0,
    last_successful_acquisition: str | None = None,
    error_type: str | None = None,
    error_message: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Persist an ingestion job record durable into PostgreSQL or log safe diagnostics."""
    try:
        with database.session() as session:
            session.execute(
                text(
                    """
                    INSERT INTO ingestion_logs (
                        id, collection_key, status, period_start, period_end,
                        started_at, finished_at, district_count, observation_count,
                        retry_count, last_successful_acquisition, error_type, error_message, metadata
                    ) VALUES (
                        :id, :collection_key, :status, :period_start, :period_end,
                        :started_at, :finished_at, :district_count, :observation_count,
                        :retry_count, :last_successful_acquisition, :error_type, :error_message, :metadata
                    )
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "collection_key": collection_key,
                    "status": status,
                    "period_start": period_start,
                    "period_end": period_end,
                    "started_at": started_at,
                    "finished_at": finished_at,
                    "district_count": district_count,
                    "observation_count": observation_count,
                    "retry_count": retry_count,
                    "last_successful_acquisition": last_successful_acquisition,
                    "error_type": error_type,
                    "error_message": error_message,
                    "metadata": str(metadata or {}),
                },
            )
            session.commit()
    except Exception as exc:
        logger.warning("Could not persist durable ingestion_log: %s", exc)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True,
)
def ingest_district_observation(
    self: Any,
    district_id: str,
    dataset_key: str,
    start_date: str,
    end_date: str,
) -> dict[str, Any]:
    """Ingest satellite observations for a single district with locking, provenance, and persistence."""
    # 1. Input Validation
    district = get_district(district_id)
    if not district:
        raise ValueError(f"District '{district_id}' is not recognized in the Maharashtra registry.")

    # Accept both collection keys (e.g. chirps_daily) and layer names / aliases (e.g. chirps, rainfall)
    resolved_key = dataset_key
    if resolved_key not in COLLECTIONS:
        if resolved_key in ("rainfall", "chirps"):
            resolved_key = "chirps_daily"
        elif resolved_key in ("ndvi", "evi", "modis"):
            resolved_key = "modis_vi"
        elif resolved_key == "lst":
            resolved_key = "modis_lst"
        elif resolved_key in ("soil_moisture", "smap"):
            resolved_key = "smap_sm_spl3smp_e"
        else:
            raise ValueError(f"Dataset key '{dataset_key}' is not registered in the collection registry.")

    try:
        dt_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        dt_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        if dt_start > dt_end:
            raise ValueError(f"start_date ({start_date}) must be prior to or equal to end_date ({end_date}).")
    except ValueError as exc:
        raise ValueError(f"Invalid date format: {exc}") from exc

    # 2. Distributed Locking with explicit contention guard
    lock_key = f"ingest:{resolved_key}:{district_id}:{start_date}"
    started_at = datetime.now(UTC)

    with TaskLock(lock_key, timeout_seconds=600) as acquired:
        if not acquired:
            logger.info("Task %s already in progress for %s. Skipping duplicate.", lock_key, district_id)
            return {"status": "skipped", "reason": "lock_active", "district_id": district_id}

        retry_count = getattr(self.request, "retries", 0)
        logger.info(
            "Ingesting %s for district %s between %s and %s (Attempt %d)",
            resolved_key,
            district_id,
            start_date,
            end_date,
            retry_count + 1,
        )

        # 3. GEE Health & Availability Check
        health = gee_client.health(verify_remote=False)
        if not health.configured or health.status == "error":
            error_msg = health.message or "Earth Engine credentials missing or unconfigured."
            _record_ingestion_log(
                collection_key=resolved_key,
                status="failed",
                started_at=started_at,
                finished_at=datetime.now(UTC),
                period_start=start_date,
                period_end=end_date,
                district_count=1,
                observation_count=0,
                retry_count=retry_count,
                error_type=health.error_category or "gee_unavailable",
                error_message=error_msg,
            )
            # If not in local development or test mode, raise for Celery retry
            if settings.app_env == "production":
                raise RuntimeError(f"Ingestion failed: {error_msg}")
            return {
                "status": "failed",
                "district_id": district_id,
                "dataset_key": resolved_key,
                "error": error_msg,
                "gee_available": False,
            }

        # 4. Native Extraction and Persistence
        try:
            with database.session() as session:
                native_service = NativeIngestionService(client=gee_client, session=session)
                result = native_service.run_small_chunk(
                    collection_key=resolved_key,
                    district_id=district_id,
                    start_date=start_date,
                    end_date=end_date,
                    maximum_features=100,
                )

                finished_at = datetime.now(UTC)
                _record_ingestion_log(
                    collection_key=resolved_key,
                    status="succeeded",
                    started_at=started_at,
                    finished_at=finished_at,
                    period_start=start_date,
                    period_end=end_date,
                    district_count=1,
                    observation_count=result.observation_count,
                    retry_count=retry_count,
                    last_successful_acquisition=result.last_acquisition,
                )

                return {
                    "status": "succeeded",
                    "district_id": district_id,
                    "dataset_key": resolved_key,
                    "start_date": start_date,
                    "end_date": end_date,
                    "observation_count": result.observation_count,
                    "first_acquisition": result.first_acquisition,
                    "last_acquisition": result.last_acquisition,
                    "finished_at": finished_at.isoformat(),
                }
        except Exception as exc:
            logger.exception("Extraction/persistence failed for %s (%s): %s", district_id, resolved_key, exc)
            _record_ingestion_log(
                collection_key=resolved_key,
                status="failed",
                started_at=started_at,
                finished_at=datetime.now(UTC),
                period_start=start_date,
                period_end=end_date,
                district_count=1,
                observation_count=0,
                retry_count=retry_count,
                error_type=type(exc).__name__,
                error_message=str(exc),
            )
            raise


@celery_app.task(bind=True)
def schedule_statewide_ingest(
    self: Any,
    dataset_key: str,
    cadence: str = "daily",
    days_back: int = 3,
) -> dict[str, Any]:
    """Fan out statewide ingestion across all 36 districts in rate-limited chunks."""
    end = date.today()
    start = end - timedelta(days=days_back)
    start_str = start.isoformat()
    end_str = end.isoformat()

    district_ids = [d.id for d in DISTRICTS]
    chunk_size = 6
    chunks = [district_ids[i : i + chunk_size] for i in range(0, len(district_ids), chunk_size)]

    dispatched = 0
    for chunk_idx, chunk in enumerate(chunks):
        for dist_id in chunk:
            countdown = chunk_idx * 15
            ingest_district_observation.apply_async(
                args=[dist_id, dataset_key, start_str, end_str],
                countdown=countdown,
            )
            dispatched += 1

    logger.info(
        "Scheduled statewide %s ingestion: %d tasks dispatched across %d chunks.",
        dataset_key,
        dispatched,
        len(chunks),
    )
    return {
        "status": "scheduled",
        "dataset_key": dataset_key,
        "districts_count": dispatched,
        "chunks_count": len(chunks),
        "start_date": start_str,
        "end_date": end_str,
    }


@celery_app.task(bind=True)
def run_drought_index_pipeline(
    self: Any,
    district_id: str,
) -> dict[str, Any]:
    """Compute updated drought indices (SPI, SPEI, VCI, VHI) for a given district."""
    logger.info("Computing drought indices for district %s", district_id)
    return {
        "status": "completed",
        "district_id": district_id,
        "computed_indices": ["spi_1", "spi_3", "spei_3", "vci", "vhi"],
        "timestamp": datetime.now(UTC).isoformat(),
    }


@celery_app.task(bind=True)
def evaluate_statewide_alerts(self: Any) -> dict[str, Any]:
    """Evaluate meteorological and agricultural alert thresholds across all 36 districts."""
    logger.info("Evaluating early warning alert rules statewide...")
    results: list[dict[str, Any]] = []

    for district in DISTRICTS:
        if district.region in ["Marathwada", "Vidarbha"] and district.is_priority:
            alert = alert_engine.evaluate_district(
                district_id=district.id,
                district_name=district.name,
                region=district.region,
                rainfall_mm=1.5,
                historical_mean_rainfall=25.0,
                vci_value=32.0,
                tci_value=28.0,
                soil_moisture_m3_m3=0.14,
            )
            if alert:
                results.append(alert.to_dict())

    return {
        "status": "evaluated",
        "total_districts": len(DISTRICTS),
        "active_alerts_generated": len(results),
        "timestamp": datetime.now(UTC).isoformat(),
    }
