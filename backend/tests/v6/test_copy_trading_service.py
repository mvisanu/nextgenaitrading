"""
Tests for copy_trading_service.py — session creation, trade execution, seeding.

Uses importlib.util + sys.modules stubs to load the service module directly
from its file path without triggering heavy ORM/DB imports, and without
colliding with the congress-copy-bot worktree `app` namespace.
"""
from __future__ import annotations
import importlib.util
import os
import sys
from datetime import date
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))


def _ensure_module(name: str, mod: ModuleType) -> None:
    """Register a module in sys.modules only if not already present."""
    sys.modules.setdefault(name, mod)


def _load_service() -> ModuleType:
    """
    Load copy_trading_service.py directly, stubbing out all heavy app.* imports
    that would pull in SQLAlchemy, ORM models, etc.
    """
    # --- stub: app.broker.base ---
    base_mod = ModuleType("app.broker.base")
    from dataclasses import dataclass

    @dataclass
    class OrderResult:
        broker_order_id: str
        status: str
        filled_price: object
        filled_quantity: object
        raw_response: dict

    base_mod.OrderResult = OrderResult
    base_mod.AbstractBrokerClient = object
    _ensure_module("app.broker.base", base_mod)

    # --- stub: app.broker.factory ---
    factory_mod = ModuleType("app.broker.factory")
    factory_mod.get_broker_client = MagicMock()
    _ensure_module("app.broker.factory", factory_mod)

    # --- stub: app.models.broker ---
    broker_models = ModuleType("app.models.broker")
    broker_models.BrokerCredential = MagicMock()
    _ensure_module("app.models.broker", broker_models)

    # --- stub: app.models.copy_trading ---
    ct_models = ModuleType("app.models.copy_trading")
    ct_models.CopiedPoliticianTrade = MagicMock()
    ct_models.CopyTradingSession = MagicMock()
    _ensure_module("app.models.copy_trading", ct_models)

    # --- stub: app.models.user ---
    user_models = ModuleType("app.models.user")
    user_models.User = MagicMock()
    _ensure_module("app.models.user", user_models)

    # --- stub: app.schemas.copy_trading ---
    ct_schemas = ModuleType("app.schemas.copy_trading")
    ct_schemas.CreateSessionRequest = MagicMock()
    _ensure_module("app.schemas.copy_trading", ct_schemas)

    # --- load politician_scraper_service (pure Python, no DB) ---
    scraper_path = os.path.join(_BACKEND_DIR, "app", "services", "politician_scraper_service.py")
    scraper_spec = importlib.util.spec_from_file_location(
        "app.services.politician_scraper_service", scraper_path
    )
    scraper_mod = importlib.util.module_from_spec(scraper_spec)
    sys.modules["app.services.politician_scraper_service"] = scraper_mod
    scraper_spec.loader.exec_module(scraper_mod)  # type: ignore[union-attr]

    # --- load politician_ranker_service ---
    ranker_path = os.path.join(_BACKEND_DIR, "app", "services", "politician_ranker_service.py")
    ranker_spec = importlib.util.spec_from_file_location(
        "app.services.politician_ranker_service", ranker_path
    )
    ranker_mod = importlib.util.module_from_spec(ranker_spec)
    sys.modules["app.services.politician_ranker_service"] = ranker_mod
    ranker_spec.loader.exec_module(ranker_mod)  # type: ignore[union-attr]

    # --- load copy_trading_service ---
    svc_path = os.path.join(_BACKEND_DIR, "app", "services", "copy_trading_service.py")
    svc_spec = importlib.util.spec_from_file_location("_copy_trading_service", svc_path)
    svc_mod = importlib.util.module_from_spec(svc_spec)
    svc_spec.loader.exec_module(svc_mod)  # type: ignore[union-attr]
    return svc_mod


# Load once at module level
_svc = _load_service()
_execute_stock_trade = _svc._execute_stock_trade
_execute_options_trade = _svc._execute_options_trade
_should_skip_sell = _svc._should_skip_sell

# PoliticianTrade from the loaded scraper module
PoliticianTrade = sys.modules["app.services.politician_scraper_service"].PoliticianTrade

# OrderResult from the stub
from dataclasses import dataclass


@dataclass
class OrderResult:
    broker_order_id: str
    status: str
    filled_price: object
    filled_quantity: object
    raw_response: dict


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
