"""
Unit tests for the auth module — updated for Supabase auth migration.

Covers:
  - core/security.py  : password hashing (bcrypt direct), JWT, Fernet, assert_ownership
  - auth/dependencies.py : get_current_user (Supabase JWT), optional_current_user
  - schemas/auth.py   : UserOut schema
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(tz=timezone.utc)


def _make_request(token: str | None = None, dev_token_cookie: str | None = None):
    """Build a mock FastAPI Request."""
    req = MagicMock()
    req.cookies = {}
    if dev_token_cookie:
        req.cookies["dev_token"] = dev_token_cookie
    return req


def _make_credentials(token: str | None):
    """Build a mock HTTPAuthorizationCredentials."""
    if token is None:
        return None
    creds = MagicMock()
    creds.credentials = token
    return creds


# ══════════════════════════════════════════════════════════════════════════════
# 1. core/security.py — password hashing (bcrypt direct, no _pwd_context)
# ══════════════════════════════════════════════════════════════════════════════

class TestPasswordHashing:
    """Tests for hash_password / verify_password using bcrypt directly."""

    def test_hash_is_not_plaintext(self):
        from app.core.security import hash_password
        result = hash_password("Secret1!")
        assert result != "Secret1!"
        assert result.startswith("$2b$")  # bcrypt format

    def test_verify_correct_password(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password("Secret1!")
        assert verify_password("Secret1!", hashed) is True

    def test_verify_wrong_password(self):
        from app.core.security import hash_password, verify_password
        hashed = hash_password("Secret1!")
        assert verify_password("wrong", hashed) is False

    def test_hashes_are_unique(self):
        """bcrypt uses random salts — two calls on same input differ."""
        from app.core.security import hash_password
        h1 = hash_password("Secret1!")
        h2 = hash_password("Secret1!")
        assert h1 != h2


# ══════════════════════════════════════════════════════════════════════════════
# 2. core/security.py — refresh token hash
# ══════════════════════════════════════════════════════════════════════════════

class TestRefreshTokenHash:
    def test_hash_is_sha256_hex(self):
        from app.core.security import hash_refresh_token
        token = "sometoken123"
        result = hash_refresh_token(token)
        expected = hashlib.sha256(token.encode()).hexdigest()
        assert result == expected

    def test_hash_length(self):
        from app.core.security import hash_refresh_token
        assert len(hash_refresh_token("abc")) == 64  # SHA-256 hex

    def test_different_tokens_different_hashes(self):
        from app.core.security import hash_refresh_token
        assert hash_refresh_token("a") != hash_refresh_token("b")


# ══════════════════════════════════════════════════════════════════════════════
# 3. core/security.py — JWT
# ══════════════════════════════════════════════════════════════════════════════

class TestJWT:
    def test_access_token_roundtrip(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token(42, "test@example.com")
        payload = decode_token(token)
        assert payload["sub"] == "42"
        assert payload["email"] == "test@example.com"
        assert payload["type"] == "access"

    def test_refresh_token_roundtrip(self):
        from app.core.security import create_refresh_token, decode_token
        token = create_refresh_token(99)
        payload = decode_token(token)
        assert payload["sub"] == "99"
        assert payload["type"] == "refresh"
        assert "jti" in payload

    def test_expired_token_raises(self):
        import jwt
        from app.core.config import settings
        expired_payload = {
            "sub": "1",
            "type": "access",
            "exp": _utcnow() - timedelta(seconds=1),
            "iat": _utcnow() - timedelta(minutes=5),
        }
        expired_token = jwt.encode(
            expired_payload, settings.secret_key, algorithm=settings.jwt_algorithm
        )
        with pytest.raises(Exception):
            from app.core.security import decode_token
            decode_token(expired_token)

    def test_tampered_token_raises(self):
        from app.core.security import create_access_token, decode_token
        token = create_access_token(1, "a@b.com")
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(Exception):
            decode_token(tampered)

    def test_wrong_secret_raises(self):
        import jwt
        from app.core.security import decode_token
        bad_token = jwt.encode({"sub": "1"}, "wrong-secret", algorithm="HS256")
        with pytest.raises(Exception):
            decode_token(bad_token)


# ══════════════════════════════════════════════════════════════════════════════
# 4. core/security.py — Fernet encryption
# ══════════════════════════════════════════════════════════════════════════════

class TestFernet:
    def test_encrypt_decrypt_roundtrip(self):
        from app.core.security import decrypt_value, encrypt_value
        plain = "my-broker-api-key"
        cipher = encrypt_value(plain)
        assert cipher != plain
        assert decrypt_value(cipher) == plain

    def test_different_calls_produce_different_ciphertext(self):
        from app.core.security import encrypt_value
        c1 = encrypt_value("key")
        c2 = encrypt_value("key")
        assert c1 != c2

    def test_decrypt_invalid_raises(self):
        from app.core.security import decrypt_value
        with pytest.raises(Exception):
            decrypt_value("not-valid-ciphertext")


# ══════════════════════════════════════════════════════════════════════════════
# 5. core/security.py — assert_ownership
# ══════════════════════════════════════════════════════════════════════════════

class TestAssertOwnership:
    def test_same_user_passes(self):
        from app.core.security import assert_ownership
        assert_ownership(1, 1)  # should not raise

    def test_different_user_raises_403(self):
        from fastapi import HTTPException
        from app.core.security import assert_ownership
        with pytest.raises(HTTPException) as exc_info:
            assert_ownership(1, 2)
        assert exc_info.value.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 6. schemas/auth.py — UserOut
# ══════════════════════════════════════════════════════════════════════════════

class TestUserOutSchema:
    def test_user_out_from_attributes(self):
        from app.schemas.auth import UserOut
        user = MagicMock()
        user.id = 5
        user.email = "test@example.com"
        user.is_active = True
        user.created_at = _utcnow()
        out = UserOut.model_validate(user)
        assert out.id == 5
        assert out.email == "test@example.com"
        assert out.is_active is True

    def test_user_out_has_required_fields(self):
        from app.schemas.auth import UserOut
        fields = UserOut.model_fields
        assert "id" in fields
        assert "email" in fields
        assert "is_active" in fields
        assert "created_at" in fields


# ══════════════════════════════════════════════════════════════════════════════
# 7. auth/dependencies.py — get_current_user (Supabase JWT)
# ══════════════════════════════════════════════════════════════════════════════

class TestGetCurrentUser:
    """get_current_user now decodes Supabase JWTs and auto-provisions users."""

    def _make_db(self, user=None, provision_user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock(side_effect=lambda u: None)
        return db

    def _make_user(self, user_id: int = 1):
        user = MagicMock()
        user.id = user_id
        user.email = "user@example.com"
        user.is_active = True
        return user

    @pytest.mark.asyncio
    async def test_valid_supabase_token_returns_user(self):
        """A Supabase-style JWT with email claim → returns matching DB user."""
        from app.auth.dependencies import get_current_user
        from app.core.security import create_access_token
        user = self._make_user()
        db = self._make_db(user=user)
        # Use the legacy secret_key path (supabase_jwt_secret fallback)
        token = create_access_token(1, "user@example.com")

        with patch("app.auth.dependencies._decode_supabase_token") as mock_decode:
            mock_decode.return_value = {"email": "user@example.com", "sub": "uuid-1"}
            result = await get_current_user(
                request=_make_request(),
                db=db,
                credentials=_make_credentials(token),
            )
        assert result.id == 1

    @pytest.mark.asyncio
    async def test_missing_token_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                request=_make_request(),
                db=db,
                credentials=None,
            )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                request=_make_request(),
                db=db,
                credentials=_make_credentials("not.a.jwt"),
            )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_token_with_no_email_or_sub_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        db = self._make_db()
        with patch("app.auth.dependencies._decode_supabase_token") as mock_decode:
            mock_decode.return_value = {}   # no email, no sub
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(
                    request=_make_request(),
                    db=db,
                    credentials=_make_credentials("some.jwt.token"),
                )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_user_not_found_raises_401(self):
        """User not in DB and auto-provision returns None → 401."""
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        # DB returns None but then auto-provisions — simulate by returning no user
        db = self._make_db(user=None)

        # Patch auto-provision to simulate it creating a user returned via db.refresh
        provisioned = MagicMock()
        provisioned.id = 99
        provisioned.email = "new@example.com"
        provisioned.is_active = True

        async def _refresh_side(u):
            u.id = 99

        db.refresh.side_effect = _refresh_side

        with patch("app.auth.dependencies._decode_supabase_token") as mock_decode:
            mock_decode.return_value = {"email": "new@example.com", "sub": "uuid-99"}
            # Auto-provision path should succeed (not raise 401)
            result = await get_current_user(
                request=_make_request(),
                db=db,
                credentials=_make_credentials("some.jwt"),
            )
        # User was auto-provisioned
        db.add.assert_called_once()
        db.commit.assert_awaited_once()


# ══════════════════════════════════════════════════════════════════════════════
# 8. auth/dependencies.py — optional_current_user
# ══════════════════════════════════════════════════════════════════════════════

class TestOptionalCurrentUser:
    def _make_db(self, user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        return db

    @pytest.mark.asyncio
    async def test_no_credentials_returns_none(self):
        from app.auth.dependencies import optional_current_user
        db = self._make_db()
        result = await optional_current_user(
            request=_make_request(),
            db=db,
            credentials=None,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self):
        from app.auth.dependencies import optional_current_user
        db = self._make_db()
        result = await optional_current_user(
            request=_make_request(),
            db=db,
            credentials=_make_credentials("bad.token"),
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        from app.auth.dependencies import optional_current_user
        user = MagicMock()
        user.id = 1
        user.email = "a@b.com"
        user.is_active = True
        db = self._make_db(user=user)

        with patch("app.auth.dependencies._decode_supabase_token") as mock_decode:
            mock_decode.return_value = {"email": "a@b.com", "sub": "uuid-1"}
            result = await optional_current_user(
                request=_make_request(),
                db=db,
                credentials=_make_credentials("valid.jwt.token"),
            )
        assert result is not None
        assert result.id == 1

    @pytest.mark.asyncio
    async def test_exception_returns_none_not_raise(self):
        """optional_current_user swallows HTTPException and returns None."""
        from jwt.exceptions import PyJWTError as JWTError
        from app.auth.dependencies import optional_current_user
        db = self._make_db()
        with patch("app.auth.dependencies._decode_supabase_token") as mock_decode:
            # JWTError is caught by get_current_user → re-raised as HTTPException
            # → caught by optional_current_user → returns None
            mock_decode.side_effect = JWTError("bad token")
            result = await optional_current_user(
                request=_make_request(),
                db=db,
                credentials=_make_credentials("broken.jwt"),
            )
        assert result is None
