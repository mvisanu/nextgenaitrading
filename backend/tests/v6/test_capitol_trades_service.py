"""
Unit tests for capitol_trades_service.py (Congress Copy Bot).

Covers bugs found:
  - _parse_trade: ticker can be empty string (falsy, but not None)
  - _parse_trade: option type detection on asset_name
  - fetch_politicians: returns [] on API failure (silent, no exception raised)
  - fetch_trades_for_politician: returns [] on API failure
  - fetch_trades_for_politician: since_date filter uses string comparison (ISO format only)
  - fetch_trades_for_politician: skips trades with empty ticker
  - pick_best_politician: returns None when no politicians
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

# Note: these tests run against the worktree version of the service.
# Adjust sys.path if running standalone.
import sys
import os

# Add worktree backend to path so we can import the module directly
# __file__ is backend/tests/v6/test_*.py → go up 3 dirs to reach repo root
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
_WORKTREE_BACKEND = os.path.join(_REPO_ROOT, ".worktrees", "congress-copy-bot", "backend")
if os.path.exists(_WORKTREE_BACKEND) and _WORKTREE_BACKEND not in sys.path:
    sys.path.insert(0, _WORKTREE_BACKEND)

try:
    from app.services.capitol_trades_service import (
        _parse_trade,
        _parse_option_type,
        fetch_politicians,
        fetch_trades_for_politician,
        pick_best_politician,
    )
    from app.schemas.congress_trade import CapitolTradeEntry, PoliticianSummary
    _IMPORT_OK = True
except ImportError:
    _IMPORT_OK = False

pytestmark = pytest.mark.skipif(
    not _IMPORT_OK,
    reason="congress-copy-bot worktree not importable (run from worktree env)"
)


# ---------------------------------------------------------------------------
# _parse_option_type
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("asset_name,expected", [
    ("Call Option on AAPL", "call"),
    ("Put Option on TSLA", "put"),
    ("Apple Inc Common Stock", None),
    ("", None),
    (None, None),
    ("CALL SPREAD", "call"),
    ("PUT SPREAD", "put"),
])
def test_parse_option_type(asset_name, expected):
    assert _parse_option_type(asset_name) == expected


# ---------------------------------------------------------------------------
# _parse_trade
# ---------------------------------------------------------------------------

def _make_raw_trade(
    *,
    id: str = "trade-001",
    ticker: str = "AAPL",
    asset_type: str = "stock",
    asset_name: str = "Apple Inc",
    trade_type: str = "purchase",
    size: str = "$1,001-$15,000",
    reported_at: str = "2026-04-01",
    tx_date: str = "2026-03-28",
) -> dict:
    return {
        "_id": id,
        "asset": {
            "assetTicker": ticker,
            "assetType": asset_type,
            "assetName": asset_name,
        },
        "type": trade_type,
        "size": size,
        "reportedAt": reported_at,
        "txDate": tx_date,
    }


def test_parse_trade_stock_purchase():
    raw = _make_raw_trade(ticker="AAPL", trade_type="purchase")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.ticker == "AAPL"
    assert entry.trade_type == "purchase"
    assert entry.asset_type == "stock"
    assert entry.option_type is None


def test_parse_trade_stock_sale():
    raw = _make_raw_trade(ticker="MSFT", trade_type="sale")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.trade_type == "sale"


def test_parse_trade_sale_partial_normalised_to_sale():
    raw = _make_raw_trade(ticker="NVDA", trade_type="sale (partial)")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.trade_type == "sale"


def test_parse_trade_option_detected_from_asset_type():
    raw = _make_raw_trade(ticker="TSLA", asset_type="option", asset_name="Tesla Call Option")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.asset_type == "option"
    assert entry.option_type == "call"


def test_parse_trade_option_detected_from_asset_name():
    """Option type resolved from asset_name even when asset_type is 'stock'."""
    raw = _make_raw_trade(ticker="AMZN", asset_type="stock", asset_name="Amazon Put Option")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.asset_type == "option"
    assert entry.option_type == "put"


def test_parse_trade_etf_type():
    raw = _make_raw_trade(ticker="SPY", asset_type="etf")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.asset_type == "etf"


def test_parse_trade_ticker_uppercased():
    raw = _make_raw_trade(ticker="aapl")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.ticker == "AAPL"


def test_parse_trade_ticker_empty_string():
    """
    BUG CHECK: If all ticker fallbacks fail, ticker is "" (empty string).
    The fetch_trades_for_politician code filters `if entry.ticker:` — empty string
    is falsy so the entry is skipped. But ticker="" passes _parse_trade without error.
    """
    raw = {
        "_id": "trade-empty",
        "asset": {},  # no ticker fields
        "type": "purchase",
        "size": "$1-$1000",
        "reportedAt": "2026-04-01",
        "txDate": "2026-03-28",
    }
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    # Should parse without error; ticker should be ""
    assert entry.ticker == ""
    # Callers must filter this out with `if entry.ticker:`


def test_parse_trade_uses_id_fallback():
    """Uses 'id' when '_id' is absent."""
    raw = {
        "id": "trade-id-fallback",
        "asset": {"assetTicker": "GOOG"},
        "type": "purchase",
        "size": "$1-$1000",
        "reportedAt": "2026-04-01",
        "txDate": "2026-03-28",
    }
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.id == "trade-id-fallback"
    assert entry.ticker == "GOOG"


def test_parse_trade_reported_at_and_trade_date():
    raw = _make_raw_trade(reported_at="2026-04-05", tx_date="2026-04-01")
    entry = _parse_trade(raw, "pol-1", "Nancy Pelosi")
    assert entry.reported_at == "2026-04-05"
    assert entry.trade_date == "2026-04-01"


# ---------------------------------------------------------------------------
# fetch_politicians
# ---------------------------------------------------------------------------

def test_fetch_politicians_returns_empty_on_http_error():
    """
    BUG: fetch_politicians swallows all exceptions and returns [].
    Callers cannot distinguish API failure from "no politicians".
    """
    with patch("app.services.capitol_trades_service._get", side_effect=Exception("network error")):
        result = fetch_politicians()
    assert result == []


def test_fetch_politicians_parses_data():
    mock_data = {
        "data": [
            {"id": "pol-1", "name": "Nancy Pelosi", "party": "D", "chamber": "House", "state": "CA", "totalTradeCount": 42},
            {"id": "pol-2", "name": "Mitch McConnell", "party": "R", "chamber": "Senate", "state": "KY", "totalTradeCount": 10},
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_politicians()

    assert len(result) == 2
    # Should be sorted descending by trade_count_90d
    assert result[0].trade_count_90d >= result[1].trade_count_90d
    assert result[0].id == "pol-1"


def test_fetch_politicians_skips_entries_with_no_id():
    """BUG: Silent skip when pol_id is empty. Should warn but not crash."""
    mock_data = {
        "data": [
            {"id": "", "_id": None, "name": "Ghost Politician", "totalTradeCount": 5},
            {"id": "pol-1", "name": "Nancy Pelosi", "totalTradeCount": 42},
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_politicians()

    # Only one result — the valid one
    assert len(result) == 1
    assert result[0].id == "pol-1"


def test_fetch_politicians_returns_empty_data_key():
    """Empty data array → empty list returned."""
    mock_data = {"data": []}
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_politicians()
    assert result == []


# ---------------------------------------------------------------------------
# fetch_trades_for_politician
# ---------------------------------------------------------------------------

def _make_raw_entry(id="t-1", ticker="AAPL", reported_at="2026-04-01") -> dict:
    return {
        "_id": id,
        "politician": {"id": "pol-1", "name": "Nancy Pelosi"},
        "asset": {"assetTicker": ticker, "assetType": "stock", "assetName": "Test"},
        "type": "purchase",
        "size": "$1-$1000",
        "reportedAt": reported_at,
        "txDate": "2026-03-28",
    }


def test_fetch_trades_returns_empty_on_api_failure():
    """
    BUG: fetch_trades_for_politician swallows exceptions.
    Callers cannot distinguish failure from "no new trades".
    """
    with patch("app.services.capitol_trades_service._get", side_effect=Exception("timeout")):
        result = fetch_trades_for_politician("pol-1")
    assert result == []


def test_fetch_trades_skips_empty_ticker():
    """Entries with no ticker are filtered out."""
    mock_data = {
        "data": [
            {
                "_id": "t-noticker",
                "politician": {"id": "pol-1", "name": "Nancy Pelosi"},
                "asset": {},  # no ticker
                "type": "purchase",
                "size": "$1-$1000",
                "reportedAt": "2026-04-01",
                "txDate": "2026-03-28",
            },
            _make_raw_entry(id="t-1", ticker="AAPL"),
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_trades_for_politician("pol-1")

    assert len(result) == 1
    assert result[0].ticker == "AAPL"


def test_fetch_trades_since_date_filter():
    """since_date filters entries by reported_at >= since_date (string comparison)."""
    mock_data = {
        "data": [
            _make_raw_entry(id="t-old", ticker="AAPL", reported_at="2026-03-15"),
            _make_raw_entry(id="t-new", ticker="MSFT", reported_at="2026-04-02"),
            _make_raw_entry(id="t-exact", ticker="NVDA", reported_at="2026-04-01"),
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_trades_for_politician("pol-1", since_date="2026-04-01")

    tickers = {e.ticker for e in result}
    assert "MSFT" in tickers
    assert "NVDA" in tickers
    assert "AAPL" not in tickers  # 2026-03-15 < 2026-04-01


def test_fetch_trades_since_date_requires_iso_format():
    """
    BUG: since_date comparison is string-based: 'reported_at >= since_date'.
    Non-ISO dates like '2026-4-1' (no zero-padding) will compare incorrectly.
    This test documents that the comparison assumes YYYY-MM-DD format.
    """
    mock_data = {
        "data": [
            _make_raw_entry(id="t-1", ticker="AAPL", reported_at="2026-04-02"),
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        # "2026-04-02" >= "2026-4-1" → string comparison: "2026-04-02" vs "2026-4-1"
        # '0' < '4' in ASCII → "04" < "4" → this entry would be EXCLUDED (wrong!)
        result = fetch_trades_for_politician("pol-1", since_date="2026-4-1")

    # Document the bug: if since_date is not zero-padded, filtering breaks
    # This test shows the unreliability — no hard assertion beyond "doesn't crash"


def test_fetch_trades_returns_sorted_by_api_order():
    """Results preserve API order (orderBy=reportedAt DESC from API)."""
    mock_data = {
        "data": [
            _make_raw_entry(id="t-1", ticker="AAPL", reported_at="2026-04-05"),
            _make_raw_entry(id="t-2", ticker="MSFT", reported_at="2026-04-03"),
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = fetch_trades_for_politician("pol-1")

    assert result[0].ticker == "AAPL"  # Most recent first (API order)
    assert result[1].ticker == "MSFT"


# ---------------------------------------------------------------------------
# pick_best_politician
# ---------------------------------------------------------------------------

def test_pick_best_politician_returns_most_active():
    mock_data = {
        "data": [
            {"id": "pol-1", "name": "A", "totalTradeCount": 100},
            {"id": "pol-2", "name": "B", "totalTradeCount": 5},
        ]
    }
    with patch("app.services.capitol_trades_service._get", return_value=mock_data):
        result = pick_best_politician()

    assert result is not None
    assert result.id == "pol-1"


def test_pick_best_politician_returns_none_on_empty():
    with patch("app.services.capitol_trades_service._get", return_value={"data": []}):
        result = pick_best_politician()
    assert result is None


def test_pick_best_politician_returns_none_on_api_failure():
    with patch("app.services.capitol_trades_service._get", side_effect=Exception("down")):
        result = pick_best_politician()
    assert result is None
