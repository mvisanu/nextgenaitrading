import pytest
from app.models.wheel_bot import WheelBotSession


def test_wheel_bot_session_defaults():
    """WheelBotSession can be instantiated and column types are correct."""
    session = WheelBotSession(
        user_id=1,
        symbol="TSLA",
        stage="sell_put",
        shares_qty=0,
        total_premium_collected=0.0,
        status="active",
        dry_run=True,
    )
    assert session.stage == "sell_put"
    assert session.shares_qty == 0
    assert session.total_premium_collected == 0.0
    assert session.status == "active"
    assert session.dry_run is True


def test_wheel_bot_session_fields():
    session = WheelBotSession(
        user_id=1,
        symbol="TSLA",
        dry_run=False,
        stage="sell_call",
        shares_qty=100,
        cost_basis_per_share=175.50,
        active_contract_symbol="TSLA250516C00193000",
        active_order_id="abc123",
        active_premium_received=3.50,
        active_strike=193.0,
        active_expiry="2025-05-16",
        total_premium_collected=650.0,
        status="active",
    )
    assert session.cost_basis_per_share == 175.50
    assert session.shares_qty == 100
    assert session.active_strike == 193.0
