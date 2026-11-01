from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _csv(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    if not value:
        return default
    return tuple(item.strip() for item in value.split(",") if item.strip())


@dataclass(frozen=True, slots=True)
class Settings:
    app_name: str = "Maharashtra Drought Intelligence System"
    environment: str = os.getenv("APP_ENV", "development")
    api_prefix: str = "/api"
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://mdis:mdis@localhost:5432/mdis",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    gee_project_id: str | None = os.getenv("GEE_PROJECT_ID")
    gee_service_account: str | None = os.getenv("GEE_SERVICE_ACCOUNT")
    gee_private_key_path: Path | None = (
        Path(os.environ["GEE_PRIVATE_KEY_PATH"]).expanduser()
        if os.getenv("GEE_PRIVATE_KEY_PATH")
        else None
    )
    gee_use_adc: bool = _as_bool(os.getenv("GEE_USE_ADC"), default=True)
    gee_request_timeout_seconds: int = int(os.getenv("GEE_REQUEST_TIMEOUT_SECONDS", "120"))
    demo_mode: bool = _as_bool(os.getenv("DEMO_MODE"), default=False)
    cors_origins: tuple[str, ...] = _csv(
        os.getenv("CORS_ORIGINS"),
        ("http://localhost:3000", "http://127.0.0.1:3000"),
    )


settings = Settings()

