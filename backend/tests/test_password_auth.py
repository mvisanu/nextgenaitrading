"""
Unit tests for password-based auth — POST /auth/register.

The Supabase admin API is mocked; these tests cover request validation,
success, duplicate-email, weak-password, and upstream-failure paths.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.password_auth import router


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def _mock_async_client(status_code: int, body: dict) -> MagicMock:
    """Build a mock httpx.AsyncClient context manager returning one response."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = body
    resp.text = str(body)
    mc = MagicMock()
    mc.__aenter__ = AsyncMock(return_value=mc)
    mc.__aexit__ = AsyncMock(return_value=False)
    mc.post = AsyncMock(return_value=resp)
    return mc


def _configured(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "supabase_url", "https://fake.supabase.co")
    monkeypatch.setattr(settings, "supabase_service_role_key", "fake-service-key")


class TestRegisterValidation:
    def test_short_password_rejected(self, client):
        r = client.post("/auth/register", json={"email": "a@b.co", "password": "short"})
        assert r.status_code == 422

    def test_invalid_email_rejected(self, client):
        r = client.post("/auth/register", json={"email": "not-an-email", "password": "longenough1"})
        assert r.status_code == 422

    def test_unconfigured_supabase_returns_503(self, client, monkeypatch):
        from app.core.config import settings
        monkeypatch.setattr(settings, "supabase_url", "")
        monkeypatch.setattr(settings, "supabase_service_role_key", "")
        r = client.post("/auth/register", json={"email": "a@b.co", "password": "longenough1"})
        assert r.status_code == 503


class TestRegisterFlow:
    def test_success_creates_confirmed_user(self, client, monkeypatch):
        _configured(monkeypatch)
        mc = _mock_async_client(200, {"id": "uuid-1", "email": "new@user.com"})
        with patch("app.api.password_auth.httpx.AsyncClient", return_value=mc):
            r = client.post(
                "/auth/register",
                json={"email": "  New@User.com ", "password": "longenough1"},
            )
        assert r.status_code == 201
        # Email is trimmed + lowercased before hitting Supabase
        assert r.json() == {"email": "new@user.com"}
        sent = mc.post.call_args
        assert sent.kwargs["json"] == {
            "email": "new@user.com",
            "password": "longenough1",
            "email_confirm": True,
        }
        assert sent.args[0].endswith("/auth/v1/admin/users")

    def test_duplicate_email_returns_409(self, client, monkeypatch):
        _configured(monkeypatch)
        mc = _mock_async_client(
            422,
            {"error_code": "email_exists", "msg": "A user with this email address has already been registered"},
        )
        with patch("app.api.password_auth.httpx.AsyncClient", return_value=mc):
            r = client.post("/auth/register", json={"email": "dup@user.com", "password": "longenough1"})
        assert r.status_code == 409
        assert "already exists" in r.json()["detail"]

    def test_duplicate_email_legacy_message_returns_409(self, client, monkeypatch):
        _configured(monkeypatch)
        mc = _mock_async_client(400, {"msg": "User already registered"})
        with patch("app.api.password_auth.httpx.AsyncClient", return_value=mc):
            r = client.post("/auth/register", json={"email": "dup@user.com", "password": "longenough1"})
        assert r.status_code == 409

    def test_weak_password_from_supabase_returns_400(self, client, monkeypatch):
        _configured(monkeypatch)
        mc = _mock_async_client(422, {"error_code": "weak_password", "msg": "Password is too weak"})
        with patch("app.api.password_auth.httpx.AsyncClient", return_value=mc):
            r = client.post("/auth/register", json={"email": "a@b.co", "password": "longenough1"})
        assert r.status_code == 400

    def test_upstream_failure_returns_502(self, client, monkeypatch):
        _configured(monkeypatch)
        mc = _mock_async_client(500, {"msg": "internal"})
        with patch("app.api.password_auth.httpx.AsyncClient", return_value=mc):
            r = client.post("/auth/register", json={"email": "a@b.co", "password": "longenough1"})
        assert r.status_code == 502
