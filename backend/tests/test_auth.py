"""
Unit tests for the auth module.

Covers:
  - core/security.py  : JWT, password hashing, Fernet, assert_ownership
  - auth/service.py   : register, login, refresh, logout, lockout
  - auth/dependencies.py : get_current_user, optional_current_user
  - schemas/auth.py   : RegisterRequest password-complexity validation

All DB calls are mocked — no real database required.
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


# ══════════════════════════════════════════════════════════════════════════════
# 1. core/security.py
# ══════════════════════════════════════════════════════════════════════════════

class TestPasswordHashing:
    """Tests for hash_password / verify_password — bcrypt calls are mocked."""

    def test_hash_is_not_plaintext(self):
        with patch("app.core.security._pwd_context") as mock_ctx:
            mock_ctx.hash.return_value = "$2b$hashed"
            from app.core.security import hash_password
            result = hash_password("Secret1!")
        assert result != "Secret1!"
        mock_ctx.hash.assert_called_once_with("Secret1!")

    def test_verify_correct_password(self):
        with patch("app.core.security._pwd_context") as mock_ctx:
            mock_ctx.verify.return_value = True
            from app.core.security import verify_password
            assert verify_password("Secret1!", "$2b$hashed") is True

    def test_verify_wrong_password(self):
        with patch("app.core.security._pwd_context") as mock_ctx:
            mock_ctx.verify.return_value = False
            from app.core.security import verify_password
            assert verify_password("wrong", "$2b$hashed") is False

    def test_hashes_are_unique(self):
        """Bcrypt salts produce different hashes; verified via mock call count."""
        with patch("app.core.security._pwd_context") as mock_ctx:
            mock_ctx.hash.side_effect = ["$2b$hash1", "$2b$hash2"]
            from app.core.security import hash_password
            h1 = hash_password("Secret1!")
            h2 = hash_password("Secret1!")
        assert h1 != h2


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
        assert "jti" in payload  # unique nonce present

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
        with pytest.raises(Exception):  # ExpiredSignatureError
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


class TestFernet:
    def test_encrypt_decrypt_roundtrip(self):
        from app.core.security import decrypt_value, encrypt_value
        plain = "my-broker-api-key"
        cipher = encrypt_value(plain)
        assert cipher != plain
        assert decrypt_value(cipher) == plain

    def test_different_calls_produce_different_ciphertext(self):
        from app.core.security import encrypt_value
        # Fernet uses a random IV each time
        c1 = encrypt_value("key")
        c2 = encrypt_value("key")
        assert c1 != c2

    def test_decrypt_invalid_raises(self):
        from cryptography.fernet import InvalidToken
        from app.core.security import decrypt_value
        with pytest.raises(Exception):  # InvalidToken or similar
            decrypt_value("not-valid-ciphertext")


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
# 2. schemas/auth.py
# ══════════════════════════════════════════════════════════════════════════════

class TestRegisterRequestValidation:
    def _make(self, password: str):
        from app.schemas.auth import RegisterRequest
        return RegisterRequest(email="user@example.com", password=password)

    def test_valid_password_accepted(self):
        req = self._make("Secret1!")
        assert req.password == "Secret1!"

    def test_too_short_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("Sh0rt")

    def test_no_uppercase_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("alllower1!")

    def test_no_lowercase_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("ALLUPPER1!")

    def test_no_digit_rejected(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            self._make("NoDigits!")

    def test_invalid_email_rejected(self):
        from pydantic import ValidationError
        from app.schemas.auth import RegisterRequest
        with pytest.raises(ValidationError):
            RegisterRequest(email="not-an-email", password="Valid1!")


# ══════════════════════════════════════════════════════════════════════════════
# 3. auth/service.py — lockout helpers
# ══════════════════════════════════════════════════════════════════════════════

class TestLockoutHelpers:
    def setup_method(self):
        # Reset the in-memory tracker before each test
        from app.auth import service as svc
        svc._failed_attempts.clear()

    def test_no_lockout_initially(self):
        from app.auth.service import _check_lockout
        _check_lockout("a@b.com")  # should not raise

    def test_lockout_after_five_failures(self):
        from fastapi import HTTPException
        from app.auth import service as svc
        email = "lock@test.com"
        for _ in range(5):
            svc._record_failed_attempt(email)
        with pytest.raises(HTTPException) as exc_info:
            svc._check_lockout(email)
        assert exc_info.value.status_code == 429

    def test_no_lockout_with_four_failures(self):
        from app.auth import service as svc
        email = "almost@test.com"
        for _ in range(4):
            svc._record_failed_attempt(email)
        svc._check_lockout(email)  # should not raise

    def test_clear_resets_counter(self):
        from app.auth import service as svc
        email = "clear@test.com"
        for _ in range(5):
            svc._record_failed_attempt(email)
        svc._clear_failed_attempts(email)
        svc._check_lockout(email)  # should not raise after clear

    def test_old_attempts_expire(self):
        from app.auth import service as svc
        email = "old@test.com"
        old_time = _utcnow() - timedelta(minutes=20)
        svc._failed_attempts[email] = [old_time] * 5
        svc._check_lockout(email)  # should not raise — all attempts are stale


# ══════════════════════════════════════════════════════════════════════════════
# 4. auth/service.py — register
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthServiceRegister:
    def _make_db(self, existing_user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing_user
        db.execute.return_value = result
        db.flush = AsyncMock()
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()
        return db

    def _make_request(self, ua="TestAgent", host="127.0.0.1"):
        req = MagicMock()
        req.headers.get.return_value = ua
        req.client.host = host
        return req

    def _make_response(self):
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        return resp

    @pytest.mark.asyncio
    async def test_register_success(self):
        from app.auth.service import register
        from app.schemas.auth import RegisterRequest
        db = self._make_db(existing_user=None)
        response = self._make_response()
        request = self._make_request()

        async def _refresh_side_effect(obj):
            obj.id = 1
        db.refresh.side_effect = _refresh_side_effect

        payload = RegisterRequest(email="new@example.com", password="Secret1!")
        with patch("app.auth.service.hash_password", return_value="$2b$fakehash"):
            user = await register(payload, db, response, request)
        db.commit.assert_awaited_once()
        response.set_cookie.assert_called()

    @pytest.mark.asyncio
    async def test_register_duplicate_email_raises_409(self):
        from fastapi import HTTPException
        from app.auth.service import register
        from app.schemas.auth import RegisterRequest

        existing = MagicMock()
        db = self._make_db(existing_user=existing)
        payload = RegisterRequest(email="dup@example.com", password="Secret1!")

        with pytest.raises(HTTPException) as exc_info:
            await register(payload, db, self._make_response(), self._make_request())
        assert exc_info.value.status_code == 409


# ══════════════════════════════════════════════════════════════════════════════
# 5. auth/service.py — login
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthServiceLogin:
    def setup_method(self):
        from app.auth import service as svc
        svc._failed_attempts.clear()

    def _make_user(self) -> MagicMock:
        user = MagicMock()
        user.id = 1
        user.email = "user@example.com"
        user.password_hash = "$2b$fakehash"
        user.is_active = True
        return user

    def _make_db(self, user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result
        db.commit = AsyncMock()
        db.add = MagicMock()
        return db

    def _make_request(self):
        req = MagicMock()
        req.headers.get.return_value = "TestAgent"
        req.client.host = "127.0.0.1"
        return req

    def _make_response(self):
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        return resp

    @pytest.mark.asyncio
    async def test_login_success(self):
        from app.auth.service import login
        from app.schemas.auth import LoginRequest
        user = self._make_user()
        db = self._make_db(user=user)
        payload = LoginRequest(email="user@example.com", password="Secret1!")
        with patch("app.auth.service.verify_password", return_value=True):
            result = await login(payload, db, self._make_response(), self._make_request())
        assert result.email == "user@example.com"

    @pytest.mark.asyncio
    async def test_login_wrong_password_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import login
        from app.schemas.auth import LoginRequest
        user = self._make_user()
        db = self._make_db(user=user)
        payload = LoginRequest(email="user@example.com", password="WrongPass1!")
        with patch("app.auth.service.verify_password", return_value=False):
            with pytest.raises(HTTPException) as exc_info:
                await login(payload, db, self._make_response(), self._make_request())
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_unknown_email_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import login
        from app.schemas.auth import LoginRequest
        db = self._make_db(user=None)
        payload = LoginRequest(email="nobody@example.com", password="Secret1!")
        with pytest.raises(HTTPException) as exc_info:
            await login(payload, db, self._make_response(), self._make_request())
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_increments_failed_attempts(self):
        from fastapi import HTTPException
        from app.auth import service as svc
        from app.schemas.auth import LoginRequest
        db = self._make_db(user=None)
        email = "fail@example.com"
        payload = LoginRequest(email=email, password="WrongPass1!")
        try:
            await svc.login(payload, db, MagicMock(), MagicMock())
        except HTTPException:
            pass
        assert len(svc._failed_attempts[email]) == 1

    @pytest.mark.asyncio
    async def test_login_clears_failed_attempts_on_success(self):
        from app.auth import service as svc
        from app.schemas.auth import LoginRequest
        user = self._make_user()
        email = user.email
        svc._failed_attempts[email] = [_utcnow()]

        db = self._make_db(user=user)
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        req = MagicMock()
        req.headers.get.return_value = "Agent"
        req.client.host = "127.0.0.1"

        payload = LoginRequest(email=email, password="Secret1!")
        with patch("app.auth.service.verify_password", return_value=True):
            await svc.login(payload, db, resp, req)
        assert email not in svc._failed_attempts

    @pytest.mark.asyncio
    async def test_login_raises_429_when_locked(self):
        from fastapi import HTTPException
        from app.auth import service as svc
        from app.schemas.auth import LoginRequest
        email = "locked@example.com"
        for _ in range(5):
            svc._record_failed_attempt(email)

        db = self._make_db(user=None)
        payload = LoginRequest(email=email, password="Whatever1!")
        with pytest.raises(HTTPException) as exc_info:
            await svc.login(payload, db, MagicMock(), MagicMock())
        assert exc_info.value.status_code == 429


# ══════════════════════════════════════════════════════════════════════════════
# 6. auth/service.py — refresh
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthServiceRefresh:
    def _make_session(self, expired: bool = False, revoked: bool = False):
        from app.core.security import create_refresh_token, hash_refresh_token
        refresh_token = create_refresh_token(user_id=1)
        token_hash = hash_refresh_token(refresh_token)

        session = MagicMock()
        session.user_id = 1
        session.refresh_token_hash = token_hash
        session.revoked_at = _utcnow() if revoked else None
        if expired:
            session.expires_at = _utcnow() - timedelta(days=1)
        else:
            session.expires_at = _utcnow() + timedelta(days=7)
        return session, refresh_token

    def _make_user(self):
        user = MagicMock()
        user.id = 1
        user.email = "user@example.com"
        user.is_active = True
        return user

    def _make_db_for_refresh(self, session=None, user=None):
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()

        session_result = MagicMock()
        session_result.scalar_one_or_none.return_value = session
        user_result = MagicMock()
        user_result.scalar_one_or_none.return_value = user

        db.execute.side_effect = [session_result, user_result]
        return db

    @pytest.mark.asyncio
    async def test_refresh_success_rotates_session(self):
        from app.auth.service import refresh
        session, refresh_token = self._make_session()
        user = self._make_user()
        db = self._make_db_for_refresh(session=session, user=user)
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        req = MagicMock()
        req.headers.get.return_value = "Agent"
        req.client.host = "127.0.0.1"

        result = await refresh(db, resp, req, refresh_token)
        assert result.id == 1
        assert session.revoked_at is not None  # old session revoked
        db.add.assert_called()  # new session created

    @pytest.mark.asyncio
    async def test_refresh_missing_token_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import refresh
        db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await refresh(db, MagicMock(), MagicMock(), None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_invalid_token_string_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import refresh
        db = AsyncMock()
        with pytest.raises(HTTPException) as exc_info:
            await refresh(db, MagicMock(), MagicMock(), "not.a.jwt")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_access_token_type_rejected(self):
        """Using an access token where a refresh token is expected should raise 401."""
        from fastapi import HTTPException
        from app.auth.service import refresh
        from app.core.security import create_access_token
        access_token = create_access_token(1, "a@b.com")
        db = AsyncMock()
        # No need for DB side effects — type check happens before DB lookup
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        db.execute.return_value = result_mock
        with pytest.raises(HTTPException) as exc_info:
            await refresh(db, MagicMock(), MagicMock(), access_token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_expired_session_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import refresh
        session, refresh_token = self._make_session(expired=True)
        db = self._make_db_for_refresh(session=session, user=self._make_user())
        with pytest.raises(HTTPException) as exc_info:
            await refresh(db, MagicMock(), MagicMock(), refresh_token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_session_not_found_raises_401(self):
        from fastapi import HTTPException
        from app.auth.service import refresh
        from app.core.security import create_refresh_token
        token = create_refresh_token(user_id=99)
        db = self._make_db_for_refresh(session=None, user=None)
        with pytest.raises(HTTPException) as exc_info:
            await refresh(db, MagicMock(), MagicMock(), token)
        assert exc_info.value.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 7. auth/service.py — logout
# ══════════════════════════════════════════════════════════════════════════════

class TestAuthServiceLogout:
    def _make_session(self):
        from app.core.security import create_refresh_token, hash_refresh_token
        refresh_token = create_refresh_token(user_id=1)
        session = MagicMock()
        session.user_id = 1
        session.refresh_token_hash = hash_refresh_token(refresh_token)
        session.revoked_at = None
        return session, refresh_token

    @pytest.mark.asyncio
    async def test_logout_revokes_session(self):
        from app.auth.service import logout
        session, refresh_token = self._make_session()
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = session
        db.execute.return_value = result
        db.commit = AsyncMock()

        resp = MagicMock()
        resp.set_cookie = MagicMock()
        await logout(db, resp, refresh_token)
        assert session.revoked_at is not None
        db.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_logout_clears_cookies(self):
        from app.auth.service import logout
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute.return_value = result
        db.commit = AsyncMock()

        resp = MagicMock()
        resp.set_cookie = MagicMock()
        await logout(db, resp, None)
        resp.set_cookie.assert_called()  # cookies cleared even without token

    @pytest.mark.asyncio
    async def test_logout_no_token_does_not_raise(self):
        from app.auth.service import logout
        db = AsyncMock()
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        # Should complete gracefully
        await logout(db, resp, None)

    @pytest.mark.asyncio
    async def test_logout_invalid_token_does_not_raise(self):
        """Best-effort logout — invalid token is silently ignored."""
        from app.auth.service import logout
        db = AsyncMock()
        resp = MagicMock()
        resp.set_cookie = MagicMock()
        await logout(db, resp, "garbage.token.string")


# ══════════════════════════════════════════════════════════════════════════════
# 8. auth/dependencies.py — get_current_user
# ══════════════════════════════════════════════════════════════════════════════

class TestGetCurrentUser:
    def _make_db(self, user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result
        return db

    def _make_user(self, user_id: int = 1):
        user = MagicMock()
        user.id = user_id
        user.email = "user@example.com"
        user.is_active = True
        return user

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        from app.auth.dependencies import get_current_user
        from app.core.security import create_access_token
        user = self._make_user()
        db = self._make_db(user=user)
        token = create_access_token(1, "user@example.com")
        result = await get_current_user(db, access_token=token)
        assert result.id == 1

    @pytest.mark.asyncio
    async def test_missing_token_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(db, access_token=None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(db, access_token="not.a.jwt")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token_type_rejected(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        from app.core.security import create_refresh_token
        db = self._make_db()
        token = create_refresh_token(1)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(db, access_token=token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_inactive_user_raises_401(self):
        from fastapi import HTTPException
        from app.auth.dependencies import get_current_user
        from app.core.security import create_access_token
        db = self._make_db(user=None)  # DB returns no active user
        token = create_access_token(99, "ghost@example.com")
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(db, access_token=token)
        assert exc_info.value.status_code == 401


# ══════════════════════════════════════════════════════════════════════════════
# 9. auth/dependencies.py — optional_current_user
# ══════════════════════════════════════════════════════════════════════════════

class TestOptionalCurrentUser:
    def _make_db(self, user=None):
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = user
        db.execute.return_value = result
        return db

    @pytest.mark.asyncio
    async def test_no_token_returns_none(self):
        from app.auth.dependencies import optional_current_user
        db = self._make_db()
        result = await optional_current_user(db, access_token=None)
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_token_returns_none(self):
        from app.auth.dependencies import optional_current_user
        db = self._make_db()
        result = await optional_current_user(db, access_token="bad.token")
        assert result is None

    @pytest.mark.asyncio
    async def test_valid_token_returns_user(self):
        from app.auth.dependencies import optional_current_user
        from app.core.security import create_access_token
        user = MagicMock()
        user.id = 1
        db = self._make_db(user=user)
        token = create_access_token(1, "a@b.com")
        result = await optional_current_user(db, access_token=token)
        assert result is not None
        assert result.id == 1

    @pytest.mark.asyncio
    async def test_refresh_token_type_returns_none(self):
        from app.auth.dependencies import optional_current_user
        from app.core.security import create_refresh_token
        db = self._make_db()
        token = create_refresh_token(1)
        result = await optional_current_user(db, access_token=token)
        assert result is None
