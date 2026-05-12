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
