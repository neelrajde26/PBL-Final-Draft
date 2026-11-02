from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Protocol, Sequence

from app.services.gee.district_extractor import DistrictBoundary, DistrictExtractor
from app.services.gee.gee_client import EarthEngineClient
from app.services.gee.gee_collections import get_collection_spec


class IngestionRepository(Protocol):
    def last_successful_acquisition(self, collection_key: str) -> date | None: ...
    def load_active_boundaries(self) -> Sequence[DistrictBoundary]: ...
    def persist_feature_collection(self, collection_key: str, payload: dict[str, Any]) -> int: ...
    def log_run(self, **fields: Any) -> None: ...


@dataclass(frozen=True, slots=True)
class IngestionResult:
    collection_key: str
    status: str
    period_start: str
    period_end: str
    district_count: int
    persisted_count: int


class GeeIngestionService:
    """Incremental, batch-oriented ingestion orchestration.

    Temporal cadence is taken from collection metadata. A daily scheduler may
    invoke every collection, but the persisted observations retain native
    acquisition timestamps and no missing dates are synthesized.
    """

    def __init__(self, client: EarthEngineClient, repository: IngestionRepository) -> None:
        self.client = client
        self.repository = repository
        self.extractor = DistrictExtractor(client)

    def run(self, collection_key: str, through_date: date | None = None) -> IngestionResult:
        spec = get_collection_spec(collection_key)
        through_date = through_date or datetime.now(UTC).date()
        previous = self.repository.last_successful_acquisition(collection_key)
        start = max(date.fromisoformat(spec.start_date), (previous + timedelta(days=1)) if previous else date.fromisoformat(spec.start_date))
        end = through_date + timedelta(days=1)
        boundaries = self.repository.load_active_boundaries()

        if start >= end:
            return IngestionResult(collection_key, "up_to_date", start.isoformat(), end.isoformat(), len(boundaries), 0)

        self.repository.log_run(
            collection_key=collection_key,
            status="running",
            started_at=datetime.now(UTC).isoformat(),
            period_start=start.isoformat(),
            period_end=end.isoformat(),
        )
        try:
            feature_collection = self.extractor.extract_many(
                collection_key,
                boundaries,
                start.isoformat(),
                end.isoformat(),
            )
            payload = feature_collection.getInfo()
            persisted = self.repository.persist_feature_collection(collection_key, payload)
        except Exception as exc:
            self.repository.log_run(
                collection_key=collection_key,
                status="failed",
                finished_at=datetime.now(UTC).isoformat(),
                error_type=type(exc).__name__,
            )
            raise

        self.repository.log_run(
            collection_key=collection_key,
            status="succeeded",
            finished_at=datetime.now(UTC).isoformat(),
            persisted_count=persisted,
        )
        return IngestionResult(
            collection_key,
            "succeeded",
            start.isoformat(),
            end.isoformat(),
            len(boundaries),
            persisted,
        )

