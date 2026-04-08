"""
Unit tests for trailing bot service — adjust_trailing_stop() logic.

Covers bugs found:
  - Trailing activation at +10% threshold
  - Floor only ever moves up (never down)
  - Step-up logic every additional +trailing_step_pct
  - No-op when session is inactive or entry_price is None
  - No-op when current price not fetched
  - Floor not raised if new_floor <= current_floor
  - trailing_high_water updated correctly after each step
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.trailing_bot_service import adjust_trailing_stop


def _make_session(
    *,
    status: str = "active",
    entry_price: float | None = 100.0,
    trailing_active: bool = False,
    trailing_high_water: float | None = None,
    current_floor: float | None = 90.0,
    floor_price: float = 90.0,
    trailing_trigger_pct: float = 10.0,
    trailing_trail_pct: float = 5.0,
    trailing_step_pct: float = 5.0,
    stop_order_id: str | None = "dry-stop-BTC-USD-90.0",
    dry_run: bool = True,
    symbol: str = "BTC/USD",
    initial_qty: float = 0.01,
    id: int = 1,
) -> MagicMock:
    s = MagicMock()
    s.id = id
    s.status = status
    s.entry_price = entry_price
    s.trailing_active = trailing_active
    s.trailing_high_water = trailing_high_water
    s.current_floor = current_floor
    s.floor_price = floor_price
    s.trailing_trigger_pct = trailing_trigger_pct
    s.trailing_trail_pct = trailing_trail_pct
    s.trailing_step_pct = trailing_step_pct
    s.stop_order_id = stop_order_id
    s.dry_run = dry_run
    s.symbol = symbol
    s.initial_qty = initial_qty
    return s


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_db() -> AsyncMock:
    db = AsyncMock()
    db.commit = AsyncMock()
    return db


def _mock_broker() -> MagicMock:
    return MagicMock()


# ---------------------------------------------------------------------------
# No-op cases
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_noop_when_status_not_active():
    """Session with status != 'active' should return immediately."""
    session = _make_session(status="cancelled")
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service._get_latest_price") as mock_price:
        await adjust_trailing_stop(session, broker, db)
        mock_price.assert_not_called()
        db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_noop_when_entry_price_is_none():
    """Session with entry_price=None should return immediately — no ZeroDivisionError."""
    session = _make_session(entry_price=None)
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service._get_latest_price") as mock_price:
        await adjust_trailing_stop(session, broker, db)
        mock_price.assert_not_called()
        db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_noop_when_price_fetch_returns_none():
    """If _get_latest_price returns None, nothing should change."""
    session = _make_session(entry_price=100.0)
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [None]
        await adjust_trailing_stop(session, broker, db)
        db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Trailing activation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_trailing_activates_at_trigger_pct():
    """
    BUG CHECK: trailing activates when gain >= trailing_trigger_pct (10%).
    entry=100, price=110 → gain=10% → should activate.
    new_floor = 110 * 0.95 = 104.5 > current_floor 90 → commit expected.
    """
    session = _make_session(
        entry_price=100.0,
        current_floor=90.0,
        trailing_active=False,
        trailing_trigger_pct=10.0,
        trailing_trail_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        # First call → _get_latest_price → 110.0
        # Second call → _cancel_order_alpaca → None
        # Third call → _place_stop_order_alpaca → new stop ID
        mock_thread.side_effect = [110.0, None, "dry-stop-BTC-USD-104.5"]
        await adjust_trailing_stop(session, broker, db)

    assert session.trailing_active is True
    assert session.trailing_high_water == 110.0
    assert abs(session.current_floor - 104.5) < 0.01
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_trailing_does_not_activate_below_trigger():
    """
    gain < trailing_trigger_pct — no activation, no commit.
    entry=100, price=109 → gain=9% < 10% → no-op.
    """
    session = _make_session(
        entry_price=100.0,
        current_floor=90.0,
        trailing_active=False,
        trailing_trigger_pct=10.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [109.0]
        await adjust_trailing_stop(session, broker, db)

    assert session.trailing_active is False
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_floor_never_moves_down():
    """
    BUG CHECK: floor must never decrease.
    If new_floor would be <= current_floor, no update and no commit.
    entry=100, price=110, trailing_trail_pct=5 → new_floor=104.5
    but current_floor=105.0 (already higher) → no-op.
    """
    session = _make_session(
        entry_price=100.0,
        current_floor=105.0,
        trailing_active=False,
        trailing_trigger_pct=10.0,
        trailing_trail_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [110.0]
        await adjust_trailing_stop(session, broker, db)

    # trailing_active should be True (threshold met) but floor should not change
    assert session.trailing_active is True
    assert session.current_floor == 105.0  # unchanged
    db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Step-up after already trailing
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_step_up_raises_floor_when_already_trailing():
    """
    BUG CHECK: step-up logic — once trailing_active, floor advances every +trailing_step_pct.
    high_water=110, price=115.5 → step_gained = (115.5-110)/110 * 100 ≈ 5% → raise floor.
    new_floor = 115.5 * 0.95 = 109.725 > current_floor 104.5 → commit.
    """
    session = _make_session(
        entry_price=100.0,
        trailing_active=True,
        trailing_high_water=110.0,
        current_floor=104.5,
        trailing_trail_pct=5.0,
        trailing_step_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [115.5, None, "dry-stop-BTC-USD-109.7"]
        await adjust_trailing_stop(session, broker, db)

    assert abs(session.current_floor - 109.725) < 0.01
    assert session.trailing_high_water == 115.5
    db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_no_step_up_below_step_pct():
    """
    price rose less than trailing_step_pct above high_water → no step-up.
    high_water=110, price=114 → step_gained ≈ 3.6% < 5% → no update.
    """
    session = _make_session(
        entry_price=100.0,
        trailing_active=True,
        trailing_high_water=110.0,
        current_floor=104.5,
        trailing_trail_pct=5.0,
        trailing_step_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [114.0]
        await adjust_trailing_stop(session, broker, db)

    assert session.current_floor == 104.5  # unchanged
    db.commit.assert_not_called()


@pytest.mark.asyncio
async def test_no_step_up_when_price_below_high_water():
    """
    price < high_water → price dropped, no trailing update.
    """
    session = _make_session(
        entry_price=100.0,
        trailing_active=True,
        trailing_high_water=115.0,
        current_floor=109.0,
        trailing_trail_pct=5.0,
        trailing_step_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [112.0]
        await adjust_trailing_stop(session, broker, db)

    assert session.current_floor == 109.0  # unchanged
    db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# Bug: trailing_high_water is None when trailing_active is True
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_step_calc_with_none_high_water_falls_back_to_entry():
    """
    BUG: trailing_active=True but trailing_high_water=None (data corruption scenario).
    The service code does: prev_high = session.trailing_high_water or entry
    This should not crash and should use entry as prev_high.
    """
    session = _make_session(
        entry_price=100.0,
        trailing_active=True,
        trailing_high_water=None,  # corrupted/missing
        current_floor=90.0,
        trailing_trail_pct=5.0,
        trailing_step_pct=5.0,
    )
    db = _mock_db()
    broker = _mock_broker()

    # price = 107 → step_gained = (107-100)/100 * 100 = 7% >= 5% → should step up
    with patch("app.services.trailing_bot_service.asyncio.to_thread", new_callable=AsyncMock) as mock_thread:
        mock_thread.side_effect = [107.0, None, "dry-stop-BTC-USD-101.65"]
        await adjust_trailing_stop(session, broker, db)

    # Should not raise; should raise floor
    expected_floor = round(107.0 * 0.95, 4)  # 101.65
    assert abs(session.current_floor - expected_floor) < 0.01
    db.commit.assert_called_once()


# ---------------------------------------------------------------------------
# Schema: from_orm_session
# ---------------------------------------------------------------------------

def test_from_orm_session_parses_valid_json():
    """from_orm_session() with valid ladder JSON should return correct LadderRuleOut list."""
    from app.schemas.trailing_bot import TrailingBotSessionOut
    from datetime import datetime, timezone

    ladder = [
        {"price": 50000.0, "qty": 0.01, "order_id": "dry-limit-BTC-50000", "filled": False},
        {"price": 45000.0, "qty": 0.02, "order_id": "dry-limit-BTC-45000", "filled": True},
    ]
    s = MagicMock()
    s.id = 1
    s.symbol = "BTC/USD"
    s.initial_qty = 0.01
    s.entry_price = 70000.0
    s.initial_order_id = "dry-buy-BTC-70000"
    s.stop_order_id = "dry-stop-BTC-63000"
    s.floor_price = 63000.0
    s.trailing_trigger_pct = 10.0
    s.trailing_trail_pct = 5.0
    s.trailing_step_pct = 5.0
    s.trailing_active = False
    s.current_floor = 63000.0
    s.ladder_rules_json = json.dumps(ladder)
    s.dry_run = True
    s.status = "active"
    s.created_at = datetime(2026, 4, 7, 12, 0, 0, tzinfo=timezone.utc)

    result = TrailingBotSessionOut.from_orm_session(s)

    assert len(result.ladder_rules) == 2
    assert result.ladder_rules[0].price == 50000.0
    assert result.ladder_rules[1].filled is True
    assert result.status == "active"


def test_from_orm_session_with_null_json_returns_empty_ladder():
    """BUG CHECK: ladder_rules_json=None should return empty list, not crash."""
    from app.schemas.trailing_bot import TrailingBotSessionOut
    from datetime import datetime, timezone

    s = MagicMock()
    s.id = 2
    s.symbol = "ETH/USD"
    s.initial_qty = 0.1
    s.entry_price = 3000.0
    s.initial_order_id = None
    s.stop_order_id = None
    s.floor_price = 2700.0
    s.trailing_trigger_pct = 10.0
    s.trailing_trail_pct = 5.0
    s.trailing_step_pct = 5.0
    s.trailing_active = False
    s.current_floor = 2700.0
    s.ladder_rules_json = None
    s.dry_run = True
    s.status = "active"
    s.created_at = datetime(2026, 4, 7, tzinfo=timezone.utc)

    result = TrailingBotSessionOut.from_orm_session(s)
    assert result.ladder_rules == []


def test_from_orm_session_with_malformed_json_returns_empty_ladder():
    """
    BUG FIX: If ladder_rules_json is malformed, from_orm_session() should
    catch the JSONDecodeError and return an empty ladder list — not crash.
    Schema now has try/except json.JSONDecodeError; this test verifies that.
    """
    from app.schemas.trailing_bot import TrailingBotSessionOut
    from datetime import datetime, timezone

    s = MagicMock()
    s.id = 3
    s.symbol = "SOL/USD"
    s.initial_qty = 1.0
    s.entry_price = 150.0
    s.initial_order_id = None
    s.stop_order_id = None
    s.floor_price = 130.0
    s.trailing_trigger_pct = 10.0
    s.trailing_trail_pct = 5.0
    s.trailing_step_pct = 5.0
    s.trailing_active = False
    s.current_floor = 130.0
    s.ladder_rules_json = "{broken json["  # malformed
    s.dry_run = True
    s.status = "active"
    s.created_at = datetime(2026, 4, 7, tzinfo=timezone.utc)

    # Should not raise — schema hardened to return empty list on parse failure.
    result = TrailingBotSessionOut.from_orm_session(s)
    assert result.ladder_rules == []


# ---------------------------------------------------------------------------
# Schema: TrailingBotSetupRequest validation
# ---------------------------------------------------------------------------

def test_setup_request_normalises_symbol():
    """Symbol should be uppercased and stripped."""
    from app.schemas.trailing_bot import TrailingBotSetupRequest

    req = TrailingBotSetupRequest(
        credential_id=1,
        symbol="  btc/usd  ",
        buy_amount_usd=1000.0,
        floor_pct=10.0,
    )
    assert req.symbol == "BTC/USD"


def test_setup_request_rejects_zero_buy_amount():
    """buy_amount_usd must be > 0."""
    from app.schemas.trailing_bot import TrailingBotSetupRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TrailingBotSetupRequest(
            credential_id=1,
            symbol="BTC/USD",
            buy_amount_usd=0.0,
            floor_pct=10.0,
        )


def test_setup_request_rejects_zero_floor_pct():
    """floor_pct must be > 0."""
    from app.schemas.trailing_bot import TrailingBotSetupRequest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TrailingBotSetupRequest(
            credential_id=1,
            symbol="BTC/USD",
            buy_amount_usd=1000.0,
            floor_pct=0.0,
        )


def test_setup_request_ladder_rule_rejects_zero_drop_pct():
    """LadderRule drop_pct must be > 0."""
    from app.schemas.trailing_bot import TrailingBotSetupRequest, LadderRule
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        TrailingBotSetupRequest(
            credential_id=1,
            symbol="BTC/USD",
            buy_amount_usd=1000.0,
            floor_pct=10.0,
            ladder_rules=[LadderRule(drop_pct=0.0, buy_amount_usd=500.0)],
        )


def test_setup_request_max_5_ladder_rules():
    """ladder_rules cannot exceed 5 entries."""
    from app.schemas.trailing_bot import TrailingBotSetupRequest, LadderRule
    from pydantic import ValidationError

    rules = [LadderRule(drop_pct=float(10 + i * 5), buy_amount_usd=500.0) for i in range(6)]
    with pytest.raises(ValidationError):
        TrailingBotSetupRequest(
            credential_id=1,
            symbol="BTC/USD",
            buy_amount_usd=1000.0,
            floor_pct=10.0,
            ladder_rules=rules,
        )


