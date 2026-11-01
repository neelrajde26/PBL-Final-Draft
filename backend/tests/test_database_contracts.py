from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]

from app.db.migrate import _migration_files, _psycopg_url


def test_sqlalchemy_database_url_is_converted_for_psycopg() -> None:
    assert (
        _psycopg_url("postgresql+psycopg://user:pass@localhost/db")
        == "postgresql://user:pass@localhost/db"
    )


def test_migration_strategy_uses_native_partitions_without_timescale() -> None:
    migration = (BACKEND_ROOT / "migrations/001_initial.sql").read_text(encoding="utf-8")
    assert "PARTITION BY RANGE (observation_time)" in migration
    assert "environmental_observations_default" in migration
    assert "CREATE EXTENSION IF NOT EXISTS timescaledb" not in migration
    assert "create_hypertable" not in migration


def test_migrations_are_ordered() -> None:
    migrations = _migration_files(BACKEND_ROOT / "migrations")
    assert [path.name for path in migrations] == ["001_initial.sql"]
