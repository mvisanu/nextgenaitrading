"""Tests for copy_trading_service.py — session creation, trade execution, seeding."""
from __future__ import annotations
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.copy_trading_service import (
    _execute_stock_trade,
    _execute_options_trade,
    _should_skip_sell,
)
from app.services.politician_scraper_service import PoliticianTrade
from app.broker.base import OrderResult


def _make_trade(
    ticker: str = "AAPL",
    trade_type: str = "buy",
    asset_type: str = "stock",
    option_type: str | None = None,
    option_strike: float | None = None,
    option_expiry: str | None = None,
) -> PoliticianTrade:
    return PoliticianTrade(
        trade_id=f"J000309_{ticker}_2026-03-01_{trade_type}",
        politician_id="J000309",
        politician_name="Jonathan Jackson",
        ticker=ticker,
        asset_type=asset_type,
        trade_type=trade_type,
        trade_date=date(2026, 3, 1),
        disclosure_date=date(2026, 3, 15),
        amount_low=15001.0,
        amount_high=50000.0,
        option_type=option_type,
        option_strike=option_strike,
        option_expiry=option_expiry,
    )


def _make_broker(positions: list[str] | None = None) -> MagicMock:
    broker = MagicMock()
    broker.place_order.return_value = OrderResult(
        broker_order_id="order-123",
        status="accepted",
        filled_price=None,
        filled_quantity=None,
        raw_response={},
    )
    if positions is not None:
        broker.get_positions.return_value = [{"symbol": s} for s in positions]
    return broker


def test_execute_stock_trade_dry_run():
    broker = _make_broker()
    trade = _make_trade("AAPL", "buy")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=True)
    broker.place_order.assert_called_once_with(
        symbol="AAPL", side="buy", quantity=0, notional_usd=300.0, dry_run=True
    )
    assert result["status"] == "accepted"


def test_execute_stock_trade_sell_with_position():
    broker = _make_broker(positions=["AAPL", "MSFT"])
    trade = _make_trade("AAPL", "sell")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=False)
    broker.place_order.assert_called_once()
    assert result["status"] == "accepted"


def test_execute_stock_trade_sell_skips_if_no_position():
    broker = _make_broker(positions=["MSFT"])
    trade = _make_trade("AAPL", "sell")
    result = _execute_stock_trade(trade, broker, copy_amount_usd=300.0, dry_run=False)
    broker.place_order.assert_not_called()
    assert result["alpaca_status"] == "skipped_no_position"


def test_should_skip_sell_true_when_not_in_positions():
    positions = [{"symbol": "MSFT"}, {"symbol": "GOOG"}]
    assert _should_skip_sell("AAPL", positions) is True


def test_should_skip_sell_false_when_in_positions():
    positions = [{"symbol": "AAPL"}, {"symbol": "GOOG"}]
    assert _should_skip_sell("AAPL", positions) is False


def test_execute_options_trade_falls_back_to_stock_when_contract_unknown():
    """Options trade with no strike/expiry should fall back to buying the underlying."""
    broker = _make_broker()
    trade = _make_trade("AAPL", "buy", "option", option_type="call")  # no strike or expiry
    result = _execute_options_trade(trade, broker, copy_amount_usd=300.0, dry_run=True)
    broker.place_order.assert_called_once_with(
        symbol="AAPL", side="buy", quantity=0, notional_usd=300.0, dry_run=True
    )
