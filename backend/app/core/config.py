from __future__ import annotations

from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import BeforeValidator, Field, SecretStr, model_validator
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
    app_env: Literal["development", "test", "production"] = "development"
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
    boundary_source_path: Path | None = None

    @model_validator(mode="before")
    @classmethod
    def empty_strings_to_none(cls, data: Any) -> Any:
        if isinstance(data, dict):
            cleaned: dict[str, Any] = {}
            for k, v in data.items():
                if isinstance(v, str) and not v.strip():
                    cleaned[k] = None
                else:
                    cleaned[k] = v
            # Docker Compose and deployment alias mappings
            if "app_env" not in cleaned and "environment" in cleaned and cleaned["environment"]:
                cleaned["app_env"] = cleaned["environment"]
            if "auth_secret" not in cleaned and "jwt_secret" in cleaned and cleaned["jwt_secret"]:
                cleaned["auth_secret"] = cleaned["jwt_secret"]
            if "cors_origins" not in cleaned and "allowed_origins" in cleaned and cleaned["allowed_origins"]:
                cleaned["cors_origins"] = cleaned["allowed_origins"]
            return cleaned
        return data

    @model_validator(mode="after")
    def validate_environment_contract(self) -> "Settings":
        has_key = bool(self.gee_private_key_path and str(self.gee_private_key_path).strip())
        has_account = bool(self.gee_service_account and self.gee_service_account.strip())
        if has_key and not has_account:
            raise ValueError("GEE_SERVICE_ACCOUNT is required when GEE_PRIVATE_KEY_PATH is set")
        if has_account and not has_key:
            raise ValueError("GEE_PRIVATE_KEY_PATH is required when GEE_SERVICE_ACCOUNT is set")
        if self.gee_private_key_path:
            resolved = Path(self.gee_private_key_path).resolve()
            if not resolved.is_file():
                raise ValueError(f"GEE_PRIVATE_KEY_PATH file does not exist: {self.gee_private_key_path}")
        if self.app_env == "production":
            errors: list[str] = []
            if "localhost" in self.database_url or "change-me" in self.database_url:
                errors.append("DATABASE_URL must use a production database host and credentials")
            if self.auth_secret is None or len(self.auth_secret.get_secret_value()) < 32:
                errors.append("AUTH_SECRET must contain at least 32 characters")
            if not self.session_cookie_secure:
                errors.append("SESSION_COOKIE_SECURE must be true")
            if any("localhost" in origin or "127.0.0.1" in origin for origin in self.cors_origins):
                errors.append("CORS_ORIGINS must not contain loopback origins")
            if errors:
                raise ValueError("Invalid production configuration: " + "; ".join(errors))
        return self

    @property
    def environment(self) -> str:
        return self.app_env


settings = Settings()
