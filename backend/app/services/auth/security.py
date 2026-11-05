"""Security primitives: Argon2id password hashing, JWT tokens, and RBAC."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from datetime import UTC, datetime, timedelta
import json
import logging
import os
from pathlib import Path
import secrets
import threading
from typing import Any
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import jwt

from app.core.config import settings

ph = PasswordHasher()

logger = logging.getLogger(__name__)

# Local auth state (user records with Argon2 hashes, generated secrets). Gitignored.
AUTH_DIR = Path(os.environ.get("MDIS_AUTH_DIR") or Path(__file__).resolve().parents[3] / "data" / "auth")


def _signing_secret() -> str:
    """AUTH_SECRET from the environment, else a random secret generated once and kept on disk."""
    if settings.auth_secret:
        return settings.auth_secret.get_secret_value()
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    path = AUTH_DIR / ".signing_secret"
    if not path.exists():
        path.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    return path.read_text(encoding="utf-8").strip()


SECRET_KEY = _signing_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


class UserRole:
    ADMIN = "admin"
    RESEARCHER = "researcher"
    FARMER = "farmer"


@dataclass
class User:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    email: str = ""
    password_hash: str = ""
    role: str = UserRole.FARMER
    full_name: str = ""
    district_id: str | None = None
    taluka: str | None = None
    village: str | None = None
    preferred_language: str = "en"
    is_active: bool = True
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("password_hash", None)
        return d


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(hash_str: str, password: str) -> bool:
    try:
        return ph.verify(hash_str, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def create_access_token(user_id: str, role: str, email: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "role": role,
        "email": email,
        "exp": expire,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


class UserRepository:
    """Users persisted to data/auth/users.json (hashes only) so accounts survive restarts."""

    def __init__(self) -> None:
        self._users_by_email: dict[str, User] = {}
        self._users_by_id: dict[str, User] = {}
        self._reset_tokens: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._path = AUTH_DIR / "users.json"
        self._load()
        self._bootstrap_admin()

    def _load(self) -> None:
        if not self._path.exists():
            return
        names = {f.name for f in fields(User)}
        for raw in json.loads(self._path.read_text(encoding="utf-8")):
            user = User(**{k: v for k, v in raw.items() if k in names})
            self._users_by_email[user.email] = user
            self._users_by_id[user.id] = user

    def save(self) -> None:
        with self._lock:
            AUTH_DIR.mkdir(parents=True, exist_ok=True)
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps([asdict(u) for u in self._users_by_id.values()], indent=2), encoding="utf-8")
            tmp.replace(self._path)

    def _bootstrap_admin(self) -> None:
        """Create the first admin from MDIS_ADMIN_EMAIL / MDIS_ADMIN_PASSWORD, or with a one-time
        random password written to data/auth/initial_admin.txt. No password lives in the source."""
        if any(u.role == UserRole.ADMIN for u in self._users_by_id.values()):
            return
        email = (os.environ.get("MDIS_ADMIN_EMAIL") or "admin@example.com").strip().lower()
        password = os.environ.get("MDIS_ADMIN_PASSWORD")
        generated = not password
        if generated:
            password = secrets.token_urlsafe(14)
        admin = User(email=email, password_hash=hash_password(password), role=UserRole.ADMIN, full_name="DroughtLens Administrator")
        self._users_by_email[admin.email] = admin
        self._users_by_id[admin.id] = admin
        self.save()
        if generated:
            note = AUTH_DIR / "initial_admin.txt"
            note.write_text(
                f"email: {email}\npassword: {password}\nChange it after first sign-in, then delete this file.\n",
                encoding="utf-8",
            )
            logger.warning("Created initial admin %s; password written to %s", email, note)

    def get_by_email(self, email: str) -> User | None:
        return self._users_by_email.get(email.strip().lower())

    def get_by_id(self, user_id: str) -> User | None:
        return self._users_by_id.get(user_id)

    def create(
        self,
        email: str,
        password: str,
        full_name: str,
        role: str = UserRole.FARMER,
        district_id: str | None = None,
        taluka: str | None = None,
        village: str | None = None,
        preferred_language: str = "en",
    ) -> User:
        norm_email = email.strip().lower()
        if norm_email in self._users_by_email:
            raise ValueError(f"User with email '{email}' already exists.")

        user = User(
            email=norm_email,
            password_hash=hash_password(password),
            role=role,
            full_name=full_name,
            district_id=district_id,
            taluka=taluka,
            village=village,
            preferred_language=preferred_language,
        )
        self._users_by_email[norm_email] = user
        self._users_by_id[user.id] = user
        self.save()
        return user

    def list_users(self) -> list[dict[str, Any]]:
        return [u.to_dict() for u in self._users_by_id.values()]

    def create_password_reset_token(self, email: str) -> str | None:
        user = self.get_by_email(email)
        if not user:
            return None
        token = secrets.token_urlsafe(32)
        self._reset_tokens[token] = {
            "user_id": user.id,
            "expires_at": datetime.now(UTC) + timedelta(hours=1),
        }
        return token

    def reset_password(self, token: str, new_password: str) -> bool:
        record = self._reset_tokens.get(token)
        if not record:
            return False
        if datetime.now(UTC) > record["expires_at"]:
            del self._reset_tokens[token]
            return False

        user = self.get_by_id(record["user_id"])
        if not user:
            return False

        user.password_hash = hash_password(new_password)
        del self._reset_tokens[token]
        self.save()
        return True


user_repository = UserRepository()

