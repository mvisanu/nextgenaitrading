from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.services.btc_bot_service import (
    AdoptPosition,
    AdvanceTrailing,
    ExitCooldown,
    Idle,
    InitialBuy,
    LadderBuy,
    SessionState,
    StopOut,
    evaluate_tick,
)


def _now() -> datetime:
    return datetime(2026, 5, 12, 15, 0, 0, tzinfo=timezone.utc)


def _state(**kwargs) -> SessionState:
    """Build a SessionState with sensible defaults; override per-test."""
    defaults = dict(
        status="active",
        original_entry=Decimal("94000.00"),
        blended_entry=Decimal("94000.00"),
        total_qty=Decimal("0.10000000"),
        current_floor=Decimal("84600.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
        cooldown_until=None,
    )
    defaults.update(kwargs)
    return SessionState(**defaults)


def test_ended_session_is_idle():
    state = _state(status="ended", original_entry=None, blended_entry=None,
                   total_qty=Decimal("0"), current_floor=None)
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, Idle)


def test_cooldown_not_expired_is_idle():
    state = _state(
        status="cooldown",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
        cooldown_until=_now() + timedelta(hours=2),
    )
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, Idle)
    assert "cooldown" in action.reason.lower()


def test_cooldown_expired_returns_exit():
    state = _state(
        status="cooldown",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
        cooldown_until=_now() - timedelta(minutes=1),
    )
    action = evaluate_tick(
        state, Decimal("95000"), Decimal("0"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, ExitCooldown)


def test_no_session_flat_account_returns_initial_buy():
    state = _state(
        status="no_session",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
    )
    action = evaluate_tick(
        state,
        current_price=Decimal("95000"),
        alpaca_position_qty=Decimal("0"),
        alpaca_avg_entry=None,
        initial_buy_usd=Decimal("10000"),
        now_utc=_now(),
    )
    assert isinstance(action, InitialBuy)
    assert action.usd_amount == Decimal("10000")


def test_no_session_with_open_position_returns_adopt():
    state = _state(
        status="no_session",
        original_entry=None,
        blended_entry=None,
        total_qty=Decimal("0"),
        current_floor=None,
    )
    action = evaluate_tick(
        state,
        current_price=Decimal("95000"),
        alpaca_position_qty=Decimal("0.10000000"),
        alpaca_avg_entry=Decimal("94000"),
        initial_buy_usd=Decimal("10000"),
        now_utc=_now(),
    )
    assert isinstance(action, AdoptPosition)
    assert action.avg_entry == Decimal("94000")
    assert action.qty == Decimal("0.10000000")
