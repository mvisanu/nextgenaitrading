"""
Tests for politician_scraper_service.py — Quiver Quant trade parsing + caching.
"""
from __future__ import annotations
import time
from unittest.mock import MagicMock, patch, AsyncMock
import pytest

from app.services.politician_scraper_service import (
    PoliticianTrade,
    _parse_quiver_record,
    _build_trade_id,
    get_politician_trades,
)


def _make_quiver_record(**overrides) -> dict:
    base = {
        "Representative": "Jonathan Jackson",
        "BioGuideID": "J000309",
        "Ticker": "AAPL",
        "TickerType": "Stock",
        "Transaction": "Purchase",
        "TransactionDate": "2026-03-01",
        "ReportDate": "2026-03-15",
        "Range": "$15,001 - $50,000",
        "Amount": "0",
        "Description": "",
        "ExcessReturn": 5.2,
        "PriceChange": 8.1,
    }
    base.update(overrides)
    return base


def test_parse_quiver_record_buy():
    rec = _make_quiver_record()
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.ticker == "AAPL"
    assert trade.trade_type == "buy"
    assert trade.asset_type == "stock"
    assert trade.politician_id == "J000309"
    assert trade.politician_name == "Jonathan Jackson"
    assert trade.amount_low == 15001.0
    assert trade.amount_high == 50000.0
    assert trade.excess_return == 5.2


def test_parse_quiver_record_sell():
    rec = _make_quiver_record(Transaction="Sale (Full)")
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.trade_type == "sell"


def test_parse_quiver_record_option():
    rec = _make_quiver_record(TickerType="Option", Description="AAPL call strike $180 expiry 2026-06-20")
    trade = _parse_quiver_record(rec)
    assert trade is not None
    assert trade.asset_type == "option"
    assert trade.option_type == "call"
    assert trade.option_strike == 180.0


def test_parse_quiver_record_skips_empty_ticker():
    rec = _make_quiver_record(Ticker="")
    trade = _parse_quiver_record(rec)
    assert trade is None


def test_parse_quiver_record_skips_na_ticker():
    rec = _make_quiver_record(Ticker="N/A")
    trade = _parse_quiver_record(rec)
    assert trade is None


def test_build_trade_id_is_stable():
    rec = _make_quiver_record()
    id1 = _build_trade_id(rec)
    id2 = _build_trade_id(rec)
    assert id1 == id2
    assert "J000309" in id1
    assert "AAPL" in id1


def test_get_politician_trades_filters_by_id():
    trades = [
        PoliticianTrade(
            trade_id="J000309_AAPL_2026-03-01_buy",
            politician_id="J000309",
            politician_name="Jonathan Jackson",
            ticker="AAPL",
            asset_type="stock",
            trade_type="buy",
            trade_date=None,
            disclosure_date=None,
            amount_low=15001.0,
            amount_high=50000.0,
        ),
        PoliticianTrade(
            trade_id="P000197_MSFT_2026-03-02_buy",
            politician_id="P000197",
            politician_name="Nancy Pelosi",
            ticker="MSFT",
            asset_type="stock",
            trade_type="buy",
            trade_date=None,
            disclosure_date=None,
            amount_low=1001.0,
            amount_high=15000.0,
        ),
    ]
    result = get_politician_trades("J000309", trades)
    assert len(result) == 1
    assert result[0].ticker == "AAPL"


def test_get_politician_trades_returns_empty_when_no_match():
    result = get_politician_trades("NOBODY", [])
    assert result == []
