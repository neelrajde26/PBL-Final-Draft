"""Security primitives: Argon2id password hashing, JWT tokens, and RBAC."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime, timedelta
import secrets
from typing import Any
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
import jwt

from app.core.config import settings

ph = PasswordHasher()

# Default secret for token generation if auth_secret is not set
SECRET_KEY = (
    settings.auth_secret.get_secret_value()
    if settings.auth_secret
    else "development-super-secret-mdis-key-32-bytes"
)
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
    def __init__(self) -> None:
        self._users_by_email: dict[str, User] = {}
        self._users_by_id: dict[str, User] = {}
        self._reset_tokens: dict[str, dict[str, Any]] = {}
        self._bootstrap_admin()

    def _bootstrap_admin(self) -> None:
        admin_email = "admin@mdis.gov.in"
        if admin_email not in self._users_by_email:
            admin = User(
                email=admin_email,
                password_hash=hash_password("AdminSecurePass123!"),
                role=UserRole.ADMIN,
                full_name="MDIS System Administrator",
            )
            self._users_by_email[admin.email] = admin
            self._users_by_id[admin.id] = admin

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
        return True


user_repository = UserRepository()

