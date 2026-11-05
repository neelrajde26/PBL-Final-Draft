from __future__ import annotations

import socket
import time
from urllib.parse import urlsplit
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, settings as default_settings


@dataclass(frozen=True, slots=True)
class DatabaseHealth:
    configured: bool
    available: bool
    message: str

    def to_dict(self) -> dict[str, object]:
        return {
            "configured": self.configured,
            "available": self.available,
            "message": self.message,
        }


class Database:
    """Lazy SQLAlchemy session provider.

    Importing the FastAPI application does not open a database connection.
    Pooling and connectivity are initialized only when a repository or readiness
    check first asks for a session.
    """

    def __init__(self, settings: Settings = default_settings) -> None:
        self.settings = settings
        self._engine: Engine | None = None
        self._session_factory: sessionmaker[Session] | None = None
        # When a connection attempt fails, skip further attempts for a short window so that
        # every request does not pay the connect timeout while the database is down.
        self._unavailable_until = 0.0

    RETRY_AFTER_SECONDS = 60.0

    def _port_open(self) -> bool:
        """Cheap TCP probe. Windows takes ~2 s per address to refuse a closed port, so probe first."""
        try:
            parts = urlsplit(self.settings.database_url.replace("+psycopg", ""))
            if not parts.hostname:
                return True
            with socket.create_connection((parts.hostname, parts.port or 5432), timeout=0.3):
                return True
        except OSError:
            return False

    def _check_reachable(self) -> bool:
        if time.monotonic() < self._unavailable_until:
            return False
        if not self._port_open():
            self._unavailable_until = time.monotonic() + self.RETRY_AFTER_SECONDS
            return False
        return True

    class Unavailable(RuntimeError):
        pass

    @property
    def configured(self) -> bool:
        return bool(self.settings.database_url)

    def engine(self) -> Engine:
        if self._engine is None:
            connect_args = {"connect_timeout": 2} if "psycopg" in self.settings.database_url else {}
            self._engine = create_engine(
                self.settings.database_url,
                connect_args=connect_args,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_recycle=1800,
            )
        return self._engine

    def session_factory(self) -> sessionmaker[Session]:
        if self._session_factory is None:
            self._session_factory = sessionmaker(
                bind=self.engine(),
                autoflush=False,
                expire_on_commit=False,
            )
        return self._session_factory

    @contextmanager
    def session(self) -> Iterator[Session]:
        if not self._check_reachable():
            raise Database.Unavailable("Database not reachable; retrying later.")
        session = self.session_factory()()
        try:
            try:
                session.connection()
            except Exception:
                self._unavailable_until = time.monotonic() + self.RETRY_AFTER_SECONDS
                raise
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def health(self) -> DatabaseHealth:
        if not self.configured:
            return DatabaseHealth(False, False, "DATABASE_URL is not configured.")
        if not self._check_reachable():
            return DatabaseHealth(True, False, "Database connection failed; inspect server availability and DATABASE_URL.")
        try:
            with self.engine().connect() as connection:
                connection.execute(text("SELECT 1"))
        except Exception:
            self._unavailable_until = time.monotonic() + self.RETRY_AFTER_SECONDS
            return DatabaseHealth(
                True,
                False,
                "Database connection failed; inspect server availability and DATABASE_URL.",
            )
        return DatabaseHealth(True, True, "Database connection succeeded.")

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
        self._engine = None
        self._session_factory = None


database = Database()
