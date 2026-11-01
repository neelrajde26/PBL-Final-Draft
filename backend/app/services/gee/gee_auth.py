from __future__ import annotations

import importlib
from dataclasses import dataclass
from pathlib import Path
from types import ModuleType

from app.core.config import Settings


class GeeConfigurationError(RuntimeError):
    """Earth Engine is installed but its configuration is unusable."""


class GeeDependencyError(RuntimeError):
    """The optional Earth Engine Python dependency is not installed."""


@dataclass(frozen=True, slots=True)
class GeeAuthentication:
    ee: ModuleType
    project_id: str
    method: str


def _load_ee() -> ModuleType:
    try:
        return importlib.import_module("ee")
    except ModuleNotFoundError as exc:
        raise GeeDependencyError(
            "The earthengine-api package is not installed in the backend environment."
        ) from exc


def _validate_key_path(path: Path | None) -> Path:
    if path is None:
        raise GeeConfigurationError("GEE_PRIVATE_KEY_PATH is required for service-account auth.")
    resolved = path.resolve()
    if not resolved.is_file():
        raise GeeConfigurationError("The configured Earth Engine private-key file does not exist.")
    return resolved


def initialize_earth_engine(settings: Settings) -> GeeAuthentication:
    """Initialize Earth Engine with a service account or ADC.

    Credential contents and paths are never returned or logged. Service-account
    authentication takes precedence when configured; otherwise ADC is used.
    """

    if not settings.gee_project_id:
        raise GeeConfigurationError("GEE_PROJECT_ID is not configured.")

    ee = _load_ee()

    if settings.gee_service_account or settings.gee_private_key_path:
        if not settings.gee_service_account:
            raise GeeConfigurationError(
                "GEE_SERVICE_ACCOUNT is required when a private-key path is configured."
            )
        key_path = _validate_key_path(settings.gee_private_key_path)
        credentials = ee.ServiceAccountCredentials(
            settings.gee_service_account,
            str(key_path),
        )
        ee.Initialize(credentials=credentials, project=settings.gee_project_id)
        return GeeAuthentication(ee=ee, project_id=settings.gee_project_id, method="service_account")

    if settings.gee_use_adc:
        ee.Initialize(project=settings.gee_project_id)
        return GeeAuthentication(ee=ee, project_id=settings.gee_project_id, method="application_default")

    raise GeeConfigurationError(
        "Configure service-account credentials or enable GEE_USE_ADC."
    )

