from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any

from pydantic import BeforeValidator, Field, SecretStr
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _parse_origins(value: Any) -> tuple[str, ...]:
    if isinstance(value, str):
        return tuple(item.strip().rstrip("/") for item in value.split(",") if item.strip())
    if isinstance(value, (list, tuple)):
        return tuple(str(item).strip().rstrip("/") for item in value if str(item).strip())
    raise ValueError("CORS_ORIGINS must be a comma-separated string or a list of origins")


CorsOrigins = Annotated[tuple[str, ...], NoDecode, BeforeValidator(_parse_origins)]


class Settings(BaseSettings):
    """Validated process settings loaded from the environment and local env files."""

    model_config = SettingsConfigDict(
        env_file=(PROJECT_ROOT / ".env", PROJECT_ROOT / "backend" / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        validate_default=True,
    )

    app_name: str = "Maharashtra Drought Intelligence System"
    app_env: str = "development"
    api_prefix: str = "/api"
    database_url: str = "postgresql+psycopg://mdis:mdis@localhost:5432/mdis"
    redis_url: str = "redis://localhost:6379/0"
    gee_project_id: str | None = None
    gee_service_account: str | None = None
    gee_private_key_path: Path | None = None
    gee_use_adc: bool = True
    gee_request_timeout_seconds: int = Field(default=120, ge=1, le=900)
    demo_mode: bool = False
    cors_origins: CorsOrigins = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )
    auth_secret: SecretStr | None = None
    session_cookie_secure: bool = False

    @property
    def environment(self) -> str:
        return self.app_env


settings = Settings()

