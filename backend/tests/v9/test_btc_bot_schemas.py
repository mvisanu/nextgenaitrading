from datetime import datetime, timezone
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.btc_bot import (
    BtcBotActionResponse,
    BtcBotSessionCreateRequest,
    BtcBotSessionResponse,
)


def test_session_create_request_defaults():
    """initial_buy_usd is optional and defaults to None (service picks env default)."""
    req = BtcBotSessionCreateRequest()
    assert req.initial_buy_usd is None


def test_session_create_request_rejects_zero():
    """Initial buy USD must be positive when supplied."""
    with pytest.raises(ValidationError):
        BtcBotSessionCreateRequest(initial_buy_usd=0)


def test_session_response_round_trip():
    """BtcBotSessionResponse parses Decimal + datetime correctly."""
    resp = BtcBotSessionResponse(
        id=1,
        user_id=42,
        status="active",
        original_entry_price=Decimal("94000.00"),
        blended_entry_price=Decimal("92000.00"),
        total_qty=Decimal("0.10000000"),
        initial_buy_usd=Decimal("10000.00"),
        current_floor=Decimal("82800.00"),
        trailing_active=False,
        trailing_high=None,
        ladder_next=0,
        cooldown_until=None,
        realized_pnl=None,
        last_action_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=None,
        ended_at=None,
    )
    assert resp.status == "active"
    assert resp.current_floor == Decimal("82800.00")


def test_action_response_round_trip():
    resp = BtcBotActionResponse(
        id=1,
        session_id=1,
        user_id=42,
        action="initial_buy",
        btc_price=Decimal("94000.00"),
        qty_delta=Decimal("0.10000000"),
        usd_delta=Decimal("10000.00"),
        floor_before=None,
        floor_after=Decimal("84600.00"),
        alpaca_order_id="abc",
        notes=None,
        created_at=datetime.now(timezone.utc),
    )
    assert resp.action == "initial_buy"
    assert resp.qty_delta == Decimal("0.10000000")
