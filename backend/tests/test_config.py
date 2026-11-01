from pathlib import Path

from app.core.config import Settings


def test_settings_load_dotenv_and_parse_origins(
    tmp_path: Path,
    monkeypatch,
) -> None:
    for name in ("APP_ENV", "DEMO_MODE", "CORS_ORIGINS", "GEE_PROJECT_ID"):
        monkeypatch.delenv(name, raising=False)
    env_file = tmp_path / ".env"
    env_file.write_text(
        "APP_ENV=test\n"
        "DEMO_MODE=true\n"
        "CORS_ORIGINS=http://localhost:3000/,https://mdis.example\n"
        "GEE_PROJECT_ID=example-project\n",
        encoding="utf-8",
    )

    loaded = Settings(_env_file=env_file)

    assert loaded.environment == "test"
    assert loaded.demo_mode is True
    assert loaded.gee_project_id == "example-project"
    assert loaded.cors_origins == ("http://localhost:3000", "https://mdis.example")


def test_settings_environment_overrides_dotenv(tmp_path: Path, monkeypatch) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text("GEE_PROJECT_ID=file-project\n", encoding="utf-8")
    monkeypatch.setenv("GEE_PROJECT_ID", "process-project")

    loaded = Settings(_env_file=env_file)

    assert loaded.gee_project_id == "process-project"
