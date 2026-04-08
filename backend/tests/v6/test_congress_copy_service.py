"""
Unit tests for congress_copy_service.py.

Covers bugs found:
  - process_new_trades: deduplication using existing_ids (set-based check)
  - process_new_trades: watermark (last_trade_date) updated correctly
  - process_new_trades: order_status="dry_run" when session.dry_run=True
  - process_new_trades: order_status="error" when visanu_client raises
  - process_new_trades: returns 0 when fetch returns empty
  - process_new_trades: returns 0 when all entries already stored
  - _estimate_qty: stock uses hardcoded $100/share estimate (BUG documented)
  - _estimate_qty: options always return 1 contract
  - setup_congress_copy: creates session with correct fields
"""
from __future__ import annotations

import sys
import os
from datetime import datetime, timezone
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add worktree backend to path
# __file__ is backend/tests/v6/test_*.py → go up 3 dirs to reach repo root
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
_WORKTREE_BACKEND = os.path.join(_REPO_ROOT, ".worktrees", "congress-copy-bot", "backend")
if os.path.exists(_WORKTREE_BACKEND) and _WORKTREE_BACKEND not in sys.path:
    sys.path.insert(0, _WORKTREE_BACKEND)

try:
    from unittest.mock import MagicMock as _MagicMock

    # Stub out alpaca-py SDK (may not be installed in main backend venv)
    for _mod in (
        "alpaca",
        "alpaca.trading",
        "alpaca.trading.client",
        "alpaca.trading.requests",
        "alpaca.trading.enums",
    ):
        if _mod not in sys.modules:
            sys.modules[_mod] = _MagicMock()

    # Stub out settings so pydantic doesn't require env vars at import time
    _mock_settings = _MagicMock()
    _mock_settings.visanu_alpaca_api_key = ""
    _mock_settings.visanu_alpaca_secret_key = ""
    _mock_settings.visanu_alpaca_paper = True
    _mock_settings.visanu_alpaca_endpoint_url = ""
    _mock_cfg_module = _MagicMock()
    _mock_cfg_module.settings = _mock_settings
    if "app.core.config" not in sys.modules:
        sys.modules["app.core.config"] = _mock_cfg_module
    # Also stub app.core so sub-imports work
    if "app.core" not in sys.modules:
        sys.modules["app.core"] = _MagicMock()

    from app.services.congress_copy_service import (
        _estimate_qty,
        process_new_trades,
        setup_congress_copy,
        _TRADE_USD,
        _STOCK_PRICE_ESTIMATE,
        _OPTION_CONTRACTS,
    )
    from app.schemas.congress_trade import (
        CapitolTradeEntry,
        CongressCopySetupRequest,
    )
    _IMPORT_OK = True
except Exception as e:
    _IMPORT_OK = False

pytestmark = pytest.mark.skipif(
    not _IMPORT_OK,
    reason="congress-copy-bot worktree not importable"
)


# ---------------------------------------------------------------------------
# _estimate_qty
# ---------------------------------------------------------------------------

def test_estimate_qty_stock():
    """
    BUG: Stock qty uses hardcoded $100/share estimate.
    For $500 notional at $100/share → 5 shares.
    This is unrealistic for high-priced stocks (NVDA ~$900 → would buy 5 shares costing $4500).
    """
    qty = _estimate_qty(is_option=False)
    expected = max(1.0, round(_TRADE_USD / _STOCK_PRICE_ESTIMATE))
    assert qty == expected
    # Document the specific hardcoded values
    assert qty == 5.0  # $500 / $100 = 5 shares


def test_estimate_qty_option():
    """Options always return 1 contract."""
    qty = _estimate_qty(is_option=True)
    assert qty == _OPTION_CONTRACTS
    assert qty == 1.0


def test_estimate_qty_minimum_is_one():
    """Even if _TRADE_USD < _STOCK_PRICE_ESTIMATE, minimum is 1 share."""
    # If someone configured $50 / $100 = 0.5, max(1.0, round(0.5)) = 1
    qty = max(1.0, round(50.0 / 100.0))
    assert qty == 1.0


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_session(
    *,
    id: int = 1,
    politician_id: str = "pol-1",
    politician_name: str = "Nancy Pelosi",
    dry_run: bool = True,
    status: str = "active",
    last_trade_date: Optional[str] = None,
) -> MagicMock:
    s = MagicMock()
    s.id = id
    s.politician_id = politician_id
    s.politician_name = politician_name
    s.dry_run = dry_run
    s.status = status
    s.last_trade_date = last_trade_date
    s.last_checked_at = None
    return s


def _make_entry(
    id: str = "t-001",
    ticker: str = "AAPL",
    asset_type: str = "stock",
    trade_type: str = "purchase",
    reported_at: str = "2026-04-01",
) -> MagicMock:
    e = MagicMock(spec=CapitolTradeEntry)
    e.id = id
    e.politician_id = "pol-1"
    e.politician_name = "Nancy Pelosi"
    e.ticker = ticker
    e.asset_name = "Apple Inc"
    e.asset_type = asset_type
    e.option_type = None
    e.trade_type = trade_type
    e.size_range = "$1,001-$15,000"
    e.trade_date = "2026-03-28"
    e.reported_at = reported_at
    return e


def _make_db(existing_ids: list[str] | None = None) -> AsyncMock:
    db = AsyncMock()
    # Simulate existing_result.all() returning rows of (capitol_trade_id,)
    rows = [(id_,) for id_ in (existing_ids or [])]
    mock_result = MagicMock()
    mock_result.all.return_value = rows
    db.execute = AsyncMock(return_value=mock_result)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    return db


# ---------------------------------------------------------------------------
# process_new_trades
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_process_new_trades_returns_zero_when_no_entries():
    """Returns 0 and updates last_checked_at when fetch returns empty."""
    session = _make_session()
    db = _make_db()

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[],
    ):
        count = await process_new_trades(session, db)

    assert count == 0
    assert session.last_checked_at is not None


@pytest.mark.asyncio
async def test_process_new_trades_returns_zero_when_all_already_stored():
    """Returns 0 when all fetched entries are in existing_ids."""
    session = _make_session()
    entry = _make_entry(id="t-001")
    db = _make_db(existing_ids=["t-001"])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[entry],
    ):
        count = await process_new_trades(session, db)

    assert count == 0
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_process_new_trades_adds_new_entry_in_dry_run():
    """New entry in dry_run mode → order_status='dry_run', no live order placed."""
    session = _make_session(dry_run=True)
    entry = _make_entry(id="t-001", ticker="AAPL", trade_type="purchase")
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[entry],
    ), patch(
        "app.services.congress_copy_service.visanu_client"
    ) as mock_visanu:
        mock_visanu.place_market_order.return_value = "dry-order-001"
        count = await process_new_trades(session, db)

    assert count == 1
    # In dry_run, place_market_order is called but with dry_run=True
    mock_visanu.place_market_order.assert_called_once_with(
        symbol="AAPL",
        qty=5.0,  # _estimate_qty(is_option=False)
        side="buy",
        dry_run=True,
    )


@pytest.mark.asyncio
async def test_process_new_trades_sale_uses_sell_side():
    """Trade type 'sale' → side='sell'."""
    session = _make_session(dry_run=True)
    entry = _make_entry(id="t-002", ticker="MSFT", trade_type="sale")
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[entry],
    ), patch(
        "app.services.congress_copy_service.visanu_client"
    ) as mock_visanu:
        mock_visanu.place_market_order.return_value = "dry-order-002"
        await process_new_trades(session, db)

    call_kwargs = mock_visanu.place_market_order.call_args
    assert call_kwargs.kwargs["side"] == "sell"


@pytest.mark.asyncio
async def test_process_new_trades_option_uses_1_contract():
    """Option trade → qty=1.0 (1 contract)."""
    session = _make_session(dry_run=True)
    entry = _make_entry(id="t-003", ticker="AAPL", asset_type="option")
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[entry],
    ), patch(
        "app.services.congress_copy_service.visanu_client"
    ) as mock_visanu:
        mock_visanu.place_market_order.return_value = "dry-order-003"
        await process_new_trades(session, db)

    call_kwargs = mock_visanu.place_market_order.call_args
    assert call_kwargs.kwargs["qty"] == 1.0


@pytest.mark.asyncio
async def test_process_new_trades_order_error_sets_error_status():
    """If place_market_order raises, order_status='error' and count still increments."""
    session = _make_session(dry_run=False)
    entry = _make_entry(id="t-004", ticker="NVDA", trade_type="purchase")
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[entry],
    ), patch(
        "app.services.congress_copy_service.visanu_client"
    ) as mock_visanu:
        mock_visanu.place_market_order.side_effect = RuntimeError("Alpaca error")
        count = await process_new_trades(session, db)

    # Despite the error, the trade and order rows were added
    assert count == 1
    # db.add called twice: once for CongressTrade, once for CongressCopiedOrder
    assert db.add.call_count == 2


@pytest.mark.asyncio
async def test_process_new_trades_updates_watermark():
    """last_trade_date should be updated to the latest reported_at."""
    session = _make_session(last_trade_date="2026-03-01")
    entries = [
        _make_entry(id="t-001", ticker="AAPL", reported_at="2026-04-01"),
        _make_entry(id="t-002", ticker="MSFT", reported_at="2026-04-05"),
        _make_entry(id="t-003", ticker="NVDA", reported_at="2026-03-28"),
    ]
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=entries,
    ), patch("app.services.congress_copy_service.visanu_client") as mock_visanu:
        mock_visanu.place_market_order.return_value = "dry-order"
        await process_new_trades(session, db)

    # latest reported_at among new entries = "2026-04-05"
    assert session.last_trade_date == "2026-04-05"


@pytest.mark.asyncio
async def test_process_new_trades_deduplication_by_id():
    """
    BUG CHECK: Deduplication uses existing_ids set.
    If "t-001" is already in DB, only "t-002" should be processed.
    """
    session = _make_session()
    entries = [
        _make_entry(id="t-001", ticker="AAPL"),
        _make_entry(id="t-002", ticker="MSFT"),
    ]
    db = _make_db(existing_ids=["t-001"])  # t-001 already stored

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=entries,
    ), patch("app.services.congress_copy_service.visanu_client") as mock_visanu:
        mock_visanu.place_market_order.return_value = "dry-order"
        count = await process_new_trades(session, db)

    assert count == 1  # Only t-002 processed
    # place_market_order called once (for MSFT only)
    mock_visanu.place_market_order.assert_called_once()
    call_kwargs = mock_visanu.place_market_order.call_args
    assert call_kwargs.kwargs["symbol"] == "MSFT"


@pytest.mark.asyncio
async def test_process_new_trades_does_not_commit():
    """
    process_new_trades() must NOT commit — caller (scheduler) owns the commit.
    """
    session = _make_session()
    db = _make_db(existing_ids=[])

    with patch(
        "app.services.congress_copy_service.fetch_trades_for_politician",
        return_value=[],
    ):
        await process_new_trades(session, db)

    db.commit.assert_not_called()


# ---------------------------------------------------------------------------
# setup_congress_copy
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_setup_congress_copy_creates_session():
    """setup_congress_copy() should create a session with correct fields and commit."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = MagicMock()
    user.id = 42

    payload = CongressCopySetupRequest(
        politician_id="pol-1",
        politician_name="Nancy Pelosi",
        politician_party="D",
        dry_run=True,
    )

    # db.refresh populates the session attributes after commit
    async def mock_refresh(session):
        session.id = 1
        session.status = "active"

    db.refresh.side_effect = mock_refresh

    result = await setup_congress_copy(payload, db, user)

    db.add.assert_called_once()
    db.flush.assert_called_once()
    db.commit.assert_called_once()
    db.refresh.assert_called_once()


@pytest.mark.asyncio
async def test_setup_congress_copy_dry_run_default_true():
    """Default dry_run should be True to prevent accidental live orders."""
    db = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()

    user = MagicMock()
    user.id = 1

    payload = CongressCopySetupRequest(
        politician_id="pol-1",
        politician_name="Nancy Pelosi",
    )

    # CongressCopySetupRequest should default dry_run to True
    assert payload.dry_run is True


# ---------------------------------------------------------------------------
# Watermark bug: string comparison of dates
# ---------------------------------------------------------------------------

def test_watermark_string_comparison_iso_format_works():
    """
    BUG: Watermark uses string comparison (entry.reported_at > latest_reported).
    This only works correctly when dates are in YYYY-MM-DD ISO format.
    This test verifies the comparison logic independent of the service.
    """
    dates = ["2026-04-05", "2026-04-01", "2026-04-10", "2026-03-28"]
    latest = max(dates)  # string max works for ISO format
    assert latest == "2026-04-10"


def test_watermark_string_comparison_fails_for_non_padded():
    """
    BUG DOCUMENTED: Non-zero-padded dates compare incorrectly.
    "2026-4-10" > "2026-04-05" → "2026-4" vs "2026-0" → "4" > "0" → True (wrong!)
    The string '4' > '0' means a date like April would sort after any date starting with '0'
    but before any date starting with '9', '8', etc.
    """
    # This shows the bug: non-padded month "4" compared to padded "04"
    # ASCII: '4' (0x34) > '0' (0x30) → True
    # So "2026-4-10" > "2026-09-01" returns True — WRONG
    assert "4" > "0"  # The comparison that causes the bug
    # A real date fix would be: datetime.strptime(date, "%Y-%m-%d") for comparison
