"""Shared fixtures for v9 btc-bot tests."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.models.btc_bot import BtcBotSession
from app.models.user import User


@pytest.fixture
def fixed_now() -> datetime:
    return datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def user_bootstrap(monkeypatch) -> User:
    """User whose email matches BTC_BOT_BOOTSTRAP_USER_EMAIL — gets env-var fallback."""
    monkeypatch.setattr("app.core.config.settings.btc_bot_bootstrap_user_email", "bootstrap@example.com")
    monkeypatch.setattr("app.core.config.settings.visanu_alpaca_api_key", "test-key")
    monkeypatch.setattr("app.core.config.settings.visanu_alpaca_secret_key", "test-secret")
    u = User(id=1, email="bootstrap@example.com")
    return u


@pytest.fixture
def user_other(monkeypatch) -> User:
    """User whose email does NOT match the bootstrap user."""
    monkeypatch.setattr("app.core.config.settings.btc_bot_bootstrap_user_email", "bootstrap@example.com")
    u = User(id=2, email="other@example.com")
    return u


@pytest.fixture
def active_session() -> BtcBotSession:
    return BtcBotSession(
        id=10,
        user_id=1,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("84600.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
    )
