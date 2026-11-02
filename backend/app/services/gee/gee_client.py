from __future__ import annotations

import threading
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings, settings as default_settings
from app.services.gee.gee_auth import (
    GeeConfigurationError,
    GeeDependencyError,
    initialize_earth_engine,
)


@dataclass(frozen=True, slots=True)
class GeeHealth:
    status: str
    configured: bool
    available: bool
    project_id: str | None
    auth_method: str | None
    checked_at: str
    message: str
    error_category: str | None = None
    remediation: str | None = None

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

    if "authorize access" in low or "authenticate" in low or "credentials" in low:
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
    if "not found" in low or "404" in low or "collection" in low:
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
    """Thread-safe, lazy Earth Engine client.

    Importing the FastAPI application never authenticates or makes a remote
    request. Workers initialize on first use and retain the initialized module.
    """

    def __init__(self, settings: Settings = default_settings) -> None:
        self.settings = settings
        self._lock = threading.RLock()
        self._ee: Any | None = None
        self._auth_method: str | None = None
        self._last_error: Exception | None = None

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

    def health(self, *, verify_remote: bool = False) -> GeeHealth:
        now = datetime.now(UTC).isoformat()
        if not self.configured:
            return GeeHealth(
                status="not_configured",
                configured=False,
                available=False,
                project_id=self.settings.gee_project_id,
                auth_method=None,
                checked_at=now,
                message="Earth Engine is not configured; stored observations remain available.",
                error_category="not_configured",
                remediation="Configure GEE_PROJECT_ID and credentials in .env.",
            )
        try:
            self.initialize(verify_remote=verify_remote)
        except Exception as exc:
            category, msg, remediation = _classify_error(exc, self.settings.gee_project_id)
            return GeeHealth(
                status="error" if category != "dependency_missing" else "dependency_missing",
                configured=True,
                available=False,
                project_id=self.settings.gee_project_id,
                auth_method=self._auth_method,
                checked_at=now,
                message=msg,
                error_category=category,
                remediation=remediation,
            )
        return GeeHealth(
            status="connected" if verify_remote else "initialized",
            configured=True,
            available=True,
            project_id=self.settings.gee_project_id,
            auth_method=self._auth_method,
            checked_at=now,
            message=(
                "Earth Engine authentication and remote evaluation succeeded."
                if verify_remote
                else "Earth Engine client initialized; remote evaluation not requested."
            ),
        )


gee_client = EarthEngineClient()
