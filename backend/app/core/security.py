"""
Security utilities:
  - JWT access/refresh token creation and decoding
  - Password hashing and verification via bcrypt (passlib)
  - Fernet symmetric encryption/decryption for broker credentials
  - assert_ownership helper
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Password hashing ───────────────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Refresh token hash (SHA-256, stored in DB) ─────────────────────────────────
def hash_refresh_token(token: str) -> str:
    """Return a hex-encoded SHA-256 hash of a refresh token for DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── JWT ────────────────────────────────────────────────────────────────────────
def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def create_access_token(user_id: int, email: str) -> str:
    expire = _utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "type": "access",
        "exp": expire,
        "iat": _utcnow(),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int) -> str:
    expire = _utcnow() + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": _utcnow(),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.
    Raises JWTError on failure (invalid signature, expired, malformed).
    """
    return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])


# ── Fernet encryption ──────────────────────────────────────────────────────────
def _get_fernet() -> Fernet:
    return Fernet(settings.encryption_key.encode())


def encrypt_value(plain: str) -> str:
    """Encrypt a string using Fernet; returns URL-safe base64 ciphertext."""
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a Fernet ciphertext; raises InvalidToken on failure."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()


# ── Ownership guard ────────────────────────────────────────────────────────────
from fastapi import HTTPException, status  # noqa: E402 — placed here to avoid circular import


def assert_ownership(record_user_id: int, current_user_id: int) -> None:
    """Raise 403 if the record does not belong to the current user."""
    if record_user_id != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this resource.",
        )
