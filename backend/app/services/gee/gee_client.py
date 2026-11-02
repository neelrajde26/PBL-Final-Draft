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

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


def _safe_error(error: Exception) -> str:
    if isinstance(error, (GeeConfigurationError, GeeDependencyError)):
        return str(error)
    return "Earth Engine initialization or remote health check failed."


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
            )
        try:
            self.initialize(verify_remote=verify_remote)
        except GeeDependencyError as exc:
            return GeeHealth(
                status="dependency_missing",
                configured=True,
                available=False,
                project_id=self.settings.gee_project_id,
                auth_method=None,
                checked_at=now,
                message=_safe_error(exc),
            )
        except Exception as exc:
            return GeeHealth(
                status="error",
                configured=True,
                available=False,
                project_id=self.settings.gee_project_id,
                auth_method=self._auth_method,
                checked_at=now,
                message=_safe_error(exc),
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

