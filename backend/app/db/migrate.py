from __future__ import annotations

import argparse
import hashlib
from dataclasses import dataclass
from pathlib import Path

import psycopg

from app.core.config import settings


MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"


@dataclass(frozen=True, slots=True)
class MigrationResult:
    applied: tuple[str, ...]
    skipped: tuple[str, ...]


def _psycopg_url(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def _migration_files(migrations_dir: Path) -> list[Path]:
    return sorted(path for path in migrations_dir.glob("*.sql") if path.is_file())


def apply_migrations(
    database_url: str,
    migrations_dir: Path = MIGRATIONS_DIR,
) -> MigrationResult:
    applied: list[str] = []
    skipped: list[str] = []

    with psycopg.connect(_psycopg_url(database_url), autocommit=False) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version text PRIMARY KEY,
                checksum_sha256 text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
            )
            """
        )
        connection.commit()

        for path in _migration_files(migrations_dir):
            sql = path.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode("utf-8")).hexdigest()
            existing = connection.execute(
                "SELECT checksum_sha256 FROM schema_migrations WHERE version = %s",
                (path.name,),
            ).fetchone()
            if existing:
                if existing[0] != checksum:
                    raise RuntimeError(
                        f"Applied migration {path.name} was modified; create a new migration instead."
                    )
                skipped.append(path.name)
                continue

            try:
                connection.execute(sql, prepare=False)
                connection.execute(
                    "INSERT INTO schema_migrations (version, checksum_sha256) VALUES (%s, %s)",
                    (path.name, checksum),
                )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
            applied.append(path.name)

    return MigrationResult(tuple(applied), tuple(skipped))


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply MDIS versioned SQL migrations.")
    parser.add_argument("--database-url", default=settings.database_url)
    args = parser.parse_args()
    result = apply_migrations(args.database_url)
    print({"applied": list(result.applied), "skipped": list(result.skipped)})


if __name__ == "__main__":
    main()
