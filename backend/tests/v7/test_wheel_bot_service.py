"""Unit tests for the Wheel Bot state machine. All broker calls are mocked."""
import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock

from app.models.wheel_bot import WheelBotSession
from app.services.wheel_bot_service import (
    _sell_new_put,
    _sell_new_call,
    _handle_sell_put_stage,
    _handle_sell_call_stage,
    generate_daily_summary,
)


def make_session(**kwargs) -> WheelBotSession:
    """Return a MagicMock that quacks like a WheelBotSession — avoids SQLAlchemy ORM init."""
    defaults = dict(
        id=1, user_id=1, symbol="TSLA", dry_run=True,
        stage="sell_put", shares_qty=0, total_premium_collected=0.0,
        status="active", active_contract_symbol=None, active_order_id=None,
        active_premium_received=None, active_strike=None, active_expiry=None,
        cost_basis_per_share=None, last_action=None,
    )
    defaults.update(kwargs)
    s = MagicMock(spec=WheelBotSession)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def make_client_for_new_put(price=200.0, cash="50000.00", premium=3.0):
    """Return a mocked client that succeeds at selling a new put."""
    client = AsyncMock()
    client.get_stock_latest_price.return_value = price
    client.get_account.return_value = {"cash": cash, "equity": cash}
    client.get_expirations.return_value = [date(2026, 4, 10), date(2026, 4, 21), date(2026, 5, 5)]
    contract = {
        "strike_price": "180.00", "bid_price": str(premium - 0.20),
        "ask_price": str(premium + 0.20), "type": "put",
        "symbol": "TSLA260421P00180000", "open_interest": "400",
    }
    client.get_options_chain.return_value = [contract]
    client.pick_expiration = MagicMock(return_value=date(2026, 4, 21))
    client.closest_strike = MagicMock(return_value=contract)
    client.mid_price = MagicMock(return_value=premium)
    client.sell_to_open.return_value = {
        "order_id": "sim-sell-TSLA2604", "status": "simulated", "dry_run": True,
    }
    return client


@pytest.mark.asyncio
async def test_sell_new_put_populates_session():
    client = make_client_for_new_put(price=200.0, premium=3.0)
    db = AsyncMock()
    session = make_session()

    await _sell_new_put(session, client, db)

    assert session.active_contract_symbol == "TSLA260421P00180000"
    assert session.active_strike == 180.0
    assert session.active_premium_received == 3.0
    assert session.total_premium_collected == 300.0  # 3.0 * 100


@pytest.mark.asyncio
async def test_sell_new_put_blocks_if_insufficient_cash():
    client = make_client_for_new_put(price=200.0, cash="5000.00")
    db = AsyncMock()
    session = make_session()

    await _sell_new_put(session, client, db)

    assert session.active_contract_symbol is None
    assert "Insufficient cash" in (session.last_action or "")


@pytest.mark.asyncio
async def test_handle_sell_put_assigned_transitions_stage():
    client = AsyncMock()
    client.get_position.return_value = {
        "symbol": "TSLA", "qty": "100", "avg_entry_price": "180.00",
    }
    db = AsyncMock()
    session = make_session(
        stage="sell_put",
        active_contract_symbol="TSLA260421P00180000",
        active_order_id="abc",
        active_premium_received=3.0,
        active_strike=180.0,
        active_expiry="2026-04-21",
    )

    await _handle_sell_put_stage(session, client, db)

    assert session.stage == "sell_call"
    assert session.shares_qty == 100
    assert session.cost_basis_per_share == pytest.approx(177.0)  # 180 - 3
    assert session.active_contract_symbol is None


@pytest.mark.asyncio
async def test_handle_sell_put_early_close_at_50pct():
    client = AsyncMock()
    client.get_position.return_value = None  # not assigned
    client.get_option_current_price.return_value = 1.40  # <= 3.0 * 0.50
    client.buy_to_close.return_value = {"order_id": "sim-close", "status": "simulated", "dry_run": True}
    # After early close, tries to sell new put — no expirations available
    client.get_stock_latest_price.return_value = 200.0
    client.get_account.return_value = {"cash": "50000.00", "equity": "50000.00"}
    client.get_expirations.return_value = []
    client.pick_expiration = MagicMock(return_value=None)

    db = AsyncMock()
    session = make_session(
        stage="sell_put",
        active_contract_symbol="TSLA260421P00180000",
        active_order_id="abc",
        active_premium_received=3.0,
        active_strike=180.0,
        active_expiry="2026-04-21",
    )

    await _handle_sell_put_stage(session, client, db)

    client.buy_to_close.assert_called_once()
    assert session.active_contract_symbol is None


@pytest.mark.asyncio
async def test_handle_sell_call_called_away_transitions_to_sell_put():
    client = AsyncMock()
    client.get_position.return_value = None  # no TSLA shares -> called away
    db = AsyncMock()
    session = make_session(
        stage="sell_call",
        shares_qty=100,
        cost_basis_per_share=177.0,
        active_contract_symbol="TSLA260421C00195000",
        active_order_id="xyz",
        active_premium_received=2.50,
        active_strike=195.0,
        active_expiry="2026-04-21",
    )

    await _handle_sell_call_stage(session, client, db)

    assert session.stage == "sell_put"
    assert session.shares_qty == 0
    assert session.active_contract_symbol is None


@pytest.mark.asyncio
async def test_sell_new_call_respects_cost_basis():
    """If closest strike < cost_basis, no call is sold."""
    client = AsyncMock()
    client.get_expirations.return_value = [date(2026, 4, 21)]
    bad_contract = {
        "strike_price": "150.00", "bid_price": "5.00", "ask_price": "5.20",
        "type": "call", "symbol": "TSLA260421C00150000", "open_interest": "500",
    }
    client.get_options_chain.return_value = [bad_contract]
    client.pick_expiration = MagicMock(return_value=date(2026, 4, 21))
    client.closest_strike = MagicMock(return_value=bad_contract)
    client.mid_price = MagicMock(return_value=5.1)

    db = AsyncMock()
    session = make_session(stage="sell_call", shares_qty=100, cost_basis_per_share=177.0)

    await _sell_new_call(session, client, db)

    assert session.active_contract_symbol is None
    assert "below cost basis" in (session.last_action or "").lower()


@pytest.mark.asyncio
async def test_generate_daily_summary_structure():
    client = AsyncMock()
    client.get_account.return_value = {"cash": "20000.00", "equity": "22000.00"}
    client.get_position.return_value = None

    session = make_session(
        id=5,
        stage="sell_put",
        total_premium_collected=450.0,
        active_contract_symbol="TSLA260421P00180000",
        last_action="Sold put",
    )

    result = await generate_daily_summary(session, client)

    assert result["session_id"] == 5
    assert result["total_premium_collected"] == 450.0
    assert result["account_equity"] == 22000.0
    assert "total_return_pct" in result
