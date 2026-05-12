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


def test_active_floor_breach_returns_stop_out():
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("84999.99"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)


def test_active_floor_equal_returns_stop_out():
    """Boundary: price == floor must also trigger StopOut (≤ semantics)."""
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("85000.00"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)


def test_active_floor_above_price_no_stop_out():
    state = _state(current_floor=Decimal("85000"))
    action = evaluate_tick(
        state, Decimal("85000.01"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, StopOut)


def test_ladder_l1_fires_at_minus_20pct_from_original():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("72000"),   # below price 80000 so FLOOR doesn't pre-empt
        ladder_next=0,
    )
    action = evaluate_tick(
        state, Decimal("80000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 1
    assert action.usd_amount == Decimal("10000")


def test_ladder_l2_fires_after_l1_at_minus_30pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("90000"),
        current_floor=Decimal("65000"),
        ladder_next=1,
    )
    action = evaluate_tick(
        state, Decimal("70000"), Decimal("0.20"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 2
    assert action.usd_amount == Decimal("15000")


def test_ladder_l3_fires_after_l2_at_minus_40pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("80000"),
        current_floor=Decimal("55000"),
        ladder_next=2,
    )
    action = evaluate_tick(
        state, Decimal("60000"), Decimal("0.30"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, LadderBuy)
    assert action.level == 3
    assert action.usd_amount == Decimal("20000")


def test_already_fired_ladder_does_not_refire():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("90000"),
        current_floor=Decimal("80000"),
        ladder_next=1,
    )
    action = evaluate_tick(
        state, Decimal("80500"), Decimal("0.20"), None, Decimal("10000"), _now()
    )
    if isinstance(action, LadderBuy):
        assert action.level != 1


def test_all_ladders_fired_no_more_fire():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("75000"),
        current_floor=Decimal("50000"),
        ladder_next=3,
    )
    action = evaluate_tick(
        state, Decimal("55000"), Decimal("0.50"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, LadderBuy)


def test_floor_wins_over_ladder_when_both_triggered_same_tick():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("85000"),
        ladder_next=0,
    )
    action = evaluate_tick(
        state, Decimal("70000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, StopOut)


def test_trailing_activates_at_plus_10pct_gain():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("90000"),
        trailing_active=False,
    )
    action = evaluate_tick(
        state, Decimal("110000"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, AdvanceTrailing)
    assert action.activated_now is True
    assert action.new_floor == Decimal("104500.00")
    assert action.new_trailing_high == Decimal("110000")


def test_trailing_does_not_activate_below_10pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("90000"),
        trailing_active=False,
    )
    action = evaluate_tick(
        state, Decimal("109999"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)


def test_trailing_step_advances_every_5pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("104500"),
        trailing_active=True,
        trailing_high=Decimal("110000"),
    )
    action = evaluate_tick(
        state, Decimal("115500"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert isinstance(action, AdvanceTrailing)
    assert action.activated_now is False
    assert action.new_floor == Decimal("109725.00")
    assert action.new_trailing_high == Decimal("115500")


def test_trailing_step_does_not_fire_below_5pct():
    state = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("104500"),
        trailing_active=True,
        trailing_high=Decimal("110000"),
    )
    action = evaluate_tick(
        state, Decimal("114400"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)


def test_trailing_floor_is_up_only():
    state2 = _state(
        original_entry=Decimal("100000"),
        blended_entry=Decimal("100000"),
        current_floor=Decimal("130000"),
        trailing_active=True,
        trailing_high=Decimal("125000"),
    )
    action = evaluate_tick(
        state2, Decimal("131250"), Decimal("0.10"), None, Decimal("10000"), _now()
    )
    assert not isinstance(action, AdvanceTrailing)


def test_compute_blended_entry():
    from app.services.btc_bot_service import compute_blended_entry

    new_blended = compute_blended_entry(
        prior_qty=Decimal("0.10"),
        prior_blended=Decimal("100000"),
        fill_qty=Decimal("0.15"),
        fill_price=Decimal("80000"),
    )
    assert new_blended == Decimal("88000.00")


def test_compute_new_floor_up_only():
    from app.services.btc_bot_service import compute_new_floor_up_only

    assert compute_new_floor_up_only(Decimal("90000"), Decimal("95000")) == Decimal("95000")
    assert compute_new_floor_up_only(Decimal("95000"), Decimal("90000")) == Decimal("95000")
    assert compute_new_floor_up_only(None, Decimal("85000")) == Decimal("85000")
