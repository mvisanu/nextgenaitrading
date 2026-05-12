"""Orchestrator + credential-resolver unit tests.

Avoid hitting Alpaca by patching BtcBotClient. Use the conftest fixtures for
deterministic user + session inputs.
"""
from unittest.mock import MagicMock, patch

import pytest

from app.scheduler.tasks.btc_bot_monitor import _resolve_creds_for_user


def test_resolve_creds_returns_env_for_bootstrap_user(user_bootstrap):
    """User matching BTC_BOT_BOOTSTRAP_USER_EMAIL gets env-var creds."""
    creds = _resolve_creds_for_user(user_bootstrap, broker_cred=None)
    assert creds is not None
    api, secret = creds
    assert api == "test-key"
    assert secret == "test-secret"


def test_resolve_creds_returns_none_for_other_user_without_broker_cred(user_other):
    """Non-bootstrap user without saved credentials → no creds available."""
    creds = _resolve_creds_for_user(user_other, broker_cred=None)
    assert creds is None


def test_resolve_creds_prefers_broker_cred_over_env(user_bootstrap):
    """If user has a BrokerCredential, prefer it even if env vars are set."""
    mock_cred = MagicMock()
    with patch("app.scheduler.tasks.btc_bot_monitor.decrypt_value") as mock_dec:
        mock_dec.side_effect = ["personal-key", "personal-secret"]
        creds = _resolve_creds_for_user(user_bootstrap, broker_cred=mock_cred)
    assert creds == ("personal-key", "personal-secret")


from decimal import Decimal

from app.scheduler.tasks.btc_bot_monitor import _build_session_state
from app.services.btc_bot_service import SessionState


def test_build_session_state_from_active_session(active_session):
    state = _build_session_state(active_session)
    assert isinstance(state, SessionState)
    assert state.status == "active"
    assert state.original_entry == Decimal("94000.00")
    assert state.ladder_next == 0


def test_build_session_state_from_none_returns_no_session():
    state = _build_session_state(None)
    assert state.status == "no_session"
    assert state.total_qty == Decimal("0")
    assert state.original_entry is None


from app.scheduler.tasks.btc_bot_monitor import _record_action, _record_error
from app.models.btc_bot import BtcBotAction


def test_record_action_creates_row_with_required_fields():
    db = MagicMock()
    db.add = MagicMock()
    _record_action(
        db,
        session_id=10,
        user_id=1,
        action="initial_buy",
        btc_price=Decimal("94000"),
        qty_delta=Decimal("0.10"),
        usd_delta=Decimal("10000"),
        alpaca_order_id="abc",
        notes=None,
    )
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert isinstance(row, BtcBotAction)
    assert row.action == "initial_buy"
    assert row.qty_delta == Decimal("0.10")
    assert row.alpaca_order_id == "abc"


def test_record_error_writes_error_row(active_session):
    db = MagicMock()
    db.add = MagicMock()
    _record_error(db, active_session, reason="Alpaca quote failed")
    db.add.assert_called_once()
    row = db.add.call_args[0][0]
    assert row.action == "error"
    assert "Alpaca" in row.notes
