from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import UTC, datetime
import threading
import time
from typing import Any

from app.core.config import Settings, settings as default_settings
from app.services.gee.gee_auth import (
    GeeConfigurationError,
    GeeDependencyError,
    initialize_earth_engine,
)


@dataclass(frozen=True, slots=True)
class GeeHealth:
    status: str  # "not_configured" | "configured" | "authenticated" | "connected" | "error"
    configured: bool
    available: bool
    project_id: str | None
    auth_method: str | None
    checked_at: str
    message: str
    error_category: str | None = None
    remediation: str | None = None
    is_stale: bool = False

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _classify_error(error: Exception, project_id: str | None) -> tuple[str, str, str]:
    """Diagnose Earth Engine failure into a standard category, message, and actionable remediation."""
    msg = str(error)
    low = msg.lower()

    if isinstance(error, GeeDependencyError) or "no module named 'ee'" in low:
        return (
            "dependency_missing",
            "The earthengine-api Python package is not installed.",
            "Install earthengine-api via: pip install earthengine-api",
        )
    if isinstance(error, GeeConfigurationError):
        if "project" in low:
            return (
                "missing_project",
                msg,
                "Configure GEE_PROJECT_ID in .env (e.g., GEE_PROJECT_ID=gee-pbl).",
            )
        if "private" in low or "key" in low:
            return (
                "invalid_service_account_key",
                msg,
                "Verify GEE_PRIVATE_KEY_PATH points to a valid service account JSON key file.",
            )
        return ("configuration_error", msg, "Inspect GEE configuration settings in .env.")

    if "authorize access" in low or "authenticate" in low or "credentials" in low or "not found" in low:
        return (
            "credentials_missing",
            "Application Default Credentials or Earth Engine credentials were not found.",
            "Run 'earthengine authenticate' in your command line, or set GEE_SERVICE_ACCOUNT and GEE_PRIVATE_KEY_PATH.",
        )
    if "permission denied" in low or "403" in low or "not authorized" in low:
        return (
            "permission_denied",
            f"Access denied for project '{project_id}'. The account does not have Earth Engine permissions.",
            f"Ensure the Earth Engine API is enabled in Google Cloud Console for project '{project_id}' and your user/service account has 'Earth Engine Resource Viewer' or 'Earth Engine User' role.",
        )
    if "timeout" in low or "timed out" in low:
        return (
            "remote_timeout",
            "The remote Earth Engine evaluation timed out.",
            "Check internet connectivity and Google Cloud API service status, or increase GEE_REQUEST_TIMEOUT_SECONDS.",
        )
    if "collection" in low:
        return (
            "collection_access_failure",
            "The requested Earth Engine image collection or asset was not found.",
            "Verify collection ID in GEE Data Catalog.",
        )

    return (
        "remote_api_error",
        f"Earth Engine evaluation failed: {msg}",
        "Inspect Google Cloud Earth Engine quota and service health.",
    )


class EarthEngineClient:
    """Thread-safe, lazy Earth Engine client with bounded health evaluation.

    Importing the FastAPI application never authenticates or makes a remote
    request. Remote checks are bounded with a TTL cache to avoid calling
    getInfo() on every dashboard refresh.
    """

    def __init__(self, settings: Settings = default_settings) -> None:
        self.settings = settings
        self._lock = threading.RLock()
        self._ee: Any | None = None
        self._auth_method: str | None = None
        self._last_error: Exception | None = None
        self._cached_remote_health: GeeHealth | None = None
        self._cached_remote_timestamp: float = 0.0
        self._cache_ttl_seconds: float = 60.0
        self._stale_threshold_seconds: float = 300.0

    @property
    def configured(self) -> bool:
        has_project = bool(self.settings.gee_project_id)
        has_service_account = bool(
            self.settings.gee_service_account and self.settings.gee_private_key_path
        )
        return has_project and (has_service_account or self.settings.gee_use_adc)

    def initialize(self, *, verify_remote: bool = True) -> Any:
        with self._lock:
            if self._ee is None:
                try:
                    auth = initialize_earth_engine(self.settings)
                    self._ee = auth.ee
                    self._auth_method = auth.method
                    self._last_error = None
                except Exception as exc:
                    self._last_error = exc
                    raise

            if verify_remote:
                try:
                    # A minimal evaluated expression verifies authentication and API access.
                    self._ee.Number(1).getInfo()
                    self._last_error = None
                except Exception as exc:
                    self._last_error = exc
                    raise RuntimeError("Earth Engine remote health check failed.") from exc
            return self._ee

    def image_collection(self, collection_id: str) -> Any:
        return self.initialize(verify_remote=False).ImageCollection(collection_id)

    def health(self, *, verify_remote: bool = False, force_refresh: bool = False) -> GeeHealth:
        now = datetime.now(UTC).isoformat()
        current_time = time.monotonic()

        if not self.configured:
            return GeeHealth(
                status="not_configured",
                configured=False,
                available=False,
                project_id=self.settings.gee_project_id,
                auth_method=None,
                checked_at=now,
                message="Earth Engine project or authentication is not configured.",
                error_category="not_configured",
                remediation="Configure GEE_PROJECT_ID and credentials in .env.",
                is_stale=False,
            )

        with self._lock:
            # If verify_remote is requested:
            if verify_remote:
                if (
                    not force_refresh
                    and self._cached_remote_health is not None
                    and (current_time - self._cached_remote_timestamp) < self._cache_ttl_seconds
                ):
                    return self._cached_remote_health

                try:
                    self.initialize(verify_remote=True)
                    health_res = GeeHealth(
                        status="connected",
                        configured=True,
                        available=True,
                        project_id=self.settings.gee_project_id,
                        auth_method=self._auth_method,
                        checked_at=now,
                        message="Earth Engine authentication and remote evaluation succeeded.",
                        is_stale=False,
                    )
                    self._cached_remote_health = health_res
                    self._cached_remote_timestamp = current_time
                    return health_res
                except Exception as exc:
                    category, msg, remediation = _classify_error(exc, self.settings.gee_project_id)
                    health_res = GeeHealth(
                        status="error",
                        configured=True,
                        available=False,
                        project_id=self.settings.gee_project_id,
                        auth_method=self._auth_method,
                        checked_at=now,
                        message=msg,
                        error_category=category,
                        remediation=remediation,
                        is_stale=False,
                    )
                    self._cached_remote_health = health_res
                    self._cached_remote_timestamp = current_time
                    return health_res

            # When verify_remote is False:
            # Check if we already have a cached remote check
            if self._cached_remote_health is not None:
                age = current_time - self._cached_remote_timestamp
                is_stale = age > self._stale_threshold_seconds
                return GeeHealth(
                    status=self._cached_remote_health.status,
                    configured=self._cached_remote_health.configured,
                    available=self._cached_remote_health.available,
                    project_id=self._cached_remote_health.project_id,
                    auth_method=self._cached_remote_health.auth_method,
                    checked_at=self._cached_remote_health.checked_at,
                    message=self._cached_remote_health.message,
                    error_category=self._cached_remote_health.error_category,
                    remediation=self._cached_remote_health.remediation,
                    is_stale=is_stale,
                )

            # No remote check yet: attempt local initialization only
            try:
                self.initialize(verify_remote=False)
                return GeeHealth(
                    status="authenticated",
                    configured=True,
                    available=False,  # available is True ONLY when connected remotely!
                    project_id=self.settings.gee_project_id,
                    auth_method=self._auth_method,
                    checked_at=now,
                    message="Earth Engine credentials initialized; remote connectivity has not been evaluated.",
                    is_stale=False,
                )
            except Exception as exc:
                category, msg, remediation = _classify_error(exc, self.settings.gee_project_id)
                return GeeHealth(
                    status="error",
                    configured=True,
                    available=False,
                    project_id=self.settings.gee_project_id,
                    auth_method=self._auth_method,
                    checked_at=now,
                    message=msg,
                    error_category=category,
                    remediation=remediation,
                    is_stale=False,
                )


gee_client = EarthEngineClient()
