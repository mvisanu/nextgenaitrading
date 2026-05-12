"""Test the BtcBotClient wrapper surface.

We test only the wrapper's shape (method signatures, that it accepts api/secret keys,
returns dicts/None correctly) — actual Alpaca calls are mocked.
"""
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.broker.btc_bot_client import BtcBotClient


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_ask_returns_decimal(mock_data_cls, mock_trading_cls):
    mock_data = MagicMock()
    mock_quote = MagicMock()
    mock_quote.ask_price = 95000.5
    mock_data.get_crypto_latest_quote.return_value = {"BTC/USD": mock_quote}
    mock_data_cls.return_value = mock_data

    client = BtcBotClient(api_key="k", secret_key="s")
    price = client.get_btc_ask()

    assert isinstance(price, Decimal)
    assert price == Decimal("95000.5")


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_position_returns_none_when_flat(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_trading.get_all_positions.return_value = []
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    pos = client.get_btc_position()

    assert pos is None


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_get_btc_position_returns_qty_and_avg(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_pos = MagicMock()
    mock_pos.symbol = "BTCUSD"
    mock_pos.qty = "0.10000000"
    mock_pos.avg_entry_price = "94000.00"
    mock_trading.get_all_positions.return_value = [mock_pos]
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    pos = client.get_btc_position()

    assert pos is not None
    assert pos["qty"] == Decimal("0.10000000")
    assert pos["avg_entry_price"] == Decimal("94000.00")


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_market_buy_returns_fill_summary(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_data = MagicMock()
    mock_quote = MagicMock()
    mock_quote.ask_price = 95000.0
    mock_data.get_crypto_latest_quote.return_value = {"BTC/USD": mock_quote}
    mock_data_cls.return_value = mock_data

    mock_order = MagicMock()
    mock_order.id = "order-123"
    mock_trading.submit_order.return_value = mock_order

    mock_filled = MagicMock()
    mock_filled.status.value = "filled"
    mock_filled.filled_qty = "0.10526316"
    mock_filled.filled_avg_price = "95000.00"
    mock_trading.get_order_by_id.return_value = mock_filled
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    fill = client.market_buy(usd_amount=Decimal("10000"))

    assert fill["filled_qty"] == Decimal("0.10526316")
    assert fill["filled_price"] == Decimal("95000.00")
    assert fill["order_id"] == "order-123"


@patch("app.broker.btc_bot_client.TradingClient")
@patch("app.broker.btc_bot_client.CryptoHistoricalDataClient")
def test_market_sell_all_returns_fill_summary(mock_data_cls, mock_trading_cls):
    mock_trading = MagicMock()
    mock_order = MagicMock()
    mock_order.id = "sell-456"
    mock_trading.submit_order.return_value = mock_order

    mock_filled = MagicMock()
    mock_filled.status.value = "filled"
    mock_filled.filled_qty = "0.10000000"
    mock_filled.filled_avg_price = "94000.00"
    mock_trading.get_order_by_id.return_value = mock_filled
    mock_trading_cls.return_value = mock_trading

    client = BtcBotClient(api_key="k", secret_key="s")
    fill = client.market_sell_all(qty=Decimal("0.10000000"))

    assert fill["filled_qty"] == Decimal("0.10000000")
    assert fill["filled_price"] == Decimal("94000.00")
    assert fill["order_id"] == "sell-456"
