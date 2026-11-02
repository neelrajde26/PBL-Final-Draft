from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import psycopg

from app.core.config import settings
from app.db.migrate import _psycopg_url


SEEDS_DIR = Path(__file__).resolve().parents[2] / "seeds"


@dataclass(frozen=True, slots=True)
class SeedResult:
    executed: tuple[str, ...]


def apply_seeds(database_url: str, seeds_dir: Path = SEEDS_DIR) -> SeedResult:
    executed: list[str] = []
    with psycopg.connect(_psycopg_url(database_url), autocommit=False) as connection:
        for path in sorted(seeds_dir.glob("*.sql")):
            if not path.is_file():
                continue
            try:
                connection.execute(path.read_text(encoding="utf-8"), prepare=False)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
            executed.append(path.name)
    return SeedResult(tuple(executed))


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply idempotent MDIS seed files.")
    parser.add_argument("--database-url", default=settings.database_url)
    args = parser.parse_args()
    result = apply_seeds(args.database_url)
    print({"executed": list(result.executed)})


if __name__ == "__main__":
    main()
