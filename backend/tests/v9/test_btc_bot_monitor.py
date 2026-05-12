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


from datetime import timedelta, datetime, timezone
from app.scheduler.tasks.btc_bot_monitor import _apply_action
from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    Idle,
    InitialBuy,
    LadderBuy,
    StopOut,
)


def test_apply_idle_does_nothing(active_session):
    db = MagicMock()
    client = MagicMock()
    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=Idle("nothing"), price=Decimal("95000"), now_utc=None,
    )
    assert new_session is active_session
    db.add.assert_not_called()
    client.market_buy.assert_not_called()
    client.market_sell_all.assert_not_called()


def test_apply_initial_buy_creates_session_and_records_action(user_bootstrap):
    db = MagicMock()
    db.add = MagicMock()
    client = MagicMock()
    client.market_buy.return_value = {
        "filled_qty": Decimal("0.10526316"),
        "filled_price": Decimal("95000.00"),
        "order_id": "buy-1",
    }
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=None, user_id=user_bootstrap.id,
        action=InitialBuy(usd_amount=Decimal("10000")),
        price=Decimal("95000"), now_utc=now,
    )

    client.market_buy.assert_called_once_with(usd_amount=Decimal("10000"))
    assert new_session is not None
    assert new_session.user_id == user_bootstrap.id
    assert new_session.status == "active"
    assert new_session.total_qty == Decimal("0.10526316")
    assert new_session.original_entry_price == Decimal("95000.00")
    assert new_session.blended_entry_price == Decimal("95000.00")
    assert new_session.current_floor == Decimal("85500.00")
    assert new_session.ladder_next == 0
    assert db.add.call_count == 2


def test_apply_adopt_position_creates_session(user_bootstrap):
    db = MagicMock()
    client = MagicMock()
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=None, user_id=user_bootstrap.id,
        action=AdoptPosition(avg_entry=Decimal("94000"), qty=Decimal("0.10")),
        price=Decimal("95000"), now_utc=now,
    )

    assert new_session is not None
    assert new_session.original_entry_price == Decimal("94000")
    assert new_session.blended_entry_price == Decimal("94000")
    assert new_session.total_qty == Decimal("0.10")
    assert new_session.current_floor == Decimal("84600.00")
    client.market_buy.assert_not_called()
    assert db.add.call_count == 2


def test_apply_ladder_buy_updates_blended_and_floor(active_session):
    db = MagicMock()
    client = MagicMock()
    client.market_buy.return_value = {
        "filled_qty": Decimal("0.125"),
        "filled_price": Decimal("80000.00"),
        "order_id": "ladder-1",
    }
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=LadderBuy(level=1, usd_amount=Decimal("10000")),
        price=Decimal("80000"), now_utc=now,
    )

    client.market_buy.assert_called_once_with(usd_amount=Decimal("10000"))
    assert new_session.total_qty == Decimal("0.22500000")
    assert new_session.blended_entry_price == Decimal("86222.22")
    assert new_session.current_floor == Decimal("84600.00")
    assert new_session.ladder_next == 1


def test_apply_advance_trailing_updates_floor_in_place(active_session):
    db = MagicMock()
    client = MagicMock()
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)
    action = AdvanceTrailing(
        new_floor=Decimal("104500.00"),
        new_trailing_high=Decimal("110000.00"),
        activated_now=True,
    )

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=action, price=Decimal("110000"), now_utc=now,
    )

    assert new_session.current_floor == Decimal("104500.00")
    assert new_session.trailing_high == Decimal("110000.00")
    assert new_session.trailing_active is True
    client.market_buy.assert_not_called()
    client.market_sell_all.assert_not_called()


def test_apply_stop_out_sells_all_and_enters_cooldown(active_session):
    db = MagicMock()
    client = MagicMock()
    client.market_sell_all.return_value = {
        "filled_qty": Decimal("0.10000000"),
        "filled_price": Decimal("83000.00"),
        "order_id": "sell-1",
    }
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=StopOut(reason="FLOOR hit"),
        price=Decimal("83000"), now_utc=now,
    )

    client.market_sell_all.assert_called_once_with(qty=Decimal("0.10000000"))
    assert new_session.status == "cooldown"
    assert new_session.cooldown_until is not None
    assert new_session.cooldown_until > now
    assert new_session.realized_pnl == Decimal("-1100.00")
    assert new_session.total_qty == Decimal("0")


def test_apply_exit_cooldown_ends_session(active_session):
    db = MagicMock()
    client = MagicMock()
    active_session.status = "cooldown"
    active_session.cooldown_until = None
    now = datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)

    new_session = _apply_action(
        db, client, session=active_session, user_id=1,
        action=ExitCooldown(),
        price=Decimal("95000"), now_utc=now,
    )

    assert new_session.status == "ended"
    assert new_session.ended_at == now
