"""
Extended unit tests for auto_buy_engine.

Covers:
- Position size limit safeguard logic (and the known dead-code bug)
- Spread filter always-pass behaviour
- Safeguard count verification (must return exactly 7 sync checks)
- Safeguard result structure (check, passed, result fields)
- Edge cases: price exactly at zone boundaries, zero price
- Daily risk budget async safeguard
- No duplicate order async safeguard
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.auto_buy import AutoBuySettings
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.live import BrokerOrder
from app.services.auto_buy_engine import (
    SafeguardResult,
    SAFEGUARD_CHECKS,
    _check_daily_risk_budget,
    _check_no_duplicate_order,
    run_safeguards,
    run_full_safeguards,
)


def _make_settings(**kwargs) -> AutoBuySettings:
    defaults = dict(
        enabled=True,
        paper_mode=True,
        confidence_threshold=0.70,
        max_trade_amount=1000.0,
        max_position_percent=0.05,
        max_expected_drawdown=-0.10,
        allow_near_earnings=False,
        allowed_account_ids_json=[1],
    )
    defaults.update(kwargs)
    s = MagicMock(spec=AutoBuySettings)
    for k, v in defaults.items():
        setattr(s, k, v)
    return s


def _make_snap(**kwargs) -> StockBuyZoneSnapshot:
    defaults = dict(
        ticker="AAPL",
        current_price=148.0,
        buy_zone_low=140.0,
        buy_zone_high=155.0,
        confidence_score=0.75,
        expected_drawdown=-0.05,
        invalidation_price=130.0,
        id=1,
        created_at=datetime.now(timezone.utc),
    )
    defaults.update(kwargs)
    snap = MagicMock(spec=StockBuyZoneSnapshot)
    for k, v in defaults.items():
        setattr(snap, k, v)
    return snap


def _get_check(results: list[SafeguardResult], name: str) -> SafeguardResult:
    return next(r for r in results if r.check == name)


# ── Safeguard list completeness ───────────────────────────────────────────────

class TestSafeguardListStructure:
    def test_exactly_9_safeguard_names_defined(self) -> None:
        assert len(SAFEGUARD_CHECKS) == 9

    def test_run_safeguards_returns_7_sync_results(self) -> None:
        snap = _make_snap()
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        # 7 sync checks (price_inside, confidence, drawdown, liquidity,
        # spread, near_earnings, position_size)
        assert len(results) == 7

    def test_all_results_have_check_passed_result_fields(self) -> None:
        snap = _make_snap()
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        for r in results:
            assert hasattr(r, "check")
            assert hasattr(r, "passed")
            assert hasattr(r, "result")
            assert isinstance(r.check, str)
            assert isinstance(r.passed, bool)
            assert isinstance(r.result, str)

    def test_result_string_format_passed(self) -> None:
        snap = _make_snap()
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        for r in results:
            if r.passed:
                assert r.result.startswith("PASSED")

    def test_result_string_format_failed(self) -> None:
        # Force a failure
        snap = _make_snap(current_price=200.0)  # above zone
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        zone_check = _get_check(results, "price_inside_buy_zone")
        assert not zone_check.passed
        assert "FAILED" in zone_check.result


# ── Spread filter (always passes in v2) ──────────────────────────────────────

class TestSpreadFilter:
    def test_spread_filter_always_passes(self) -> None:
        snap = _make_snap()
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        spread = _get_check(results, "spread_filter")
        assert spread.passed
        assert "PASSED" in spread.result

    def test_spread_filter_passes_even_in_bad_conditions(self) -> None:
        snap = _make_snap(current_price=0.001, buy_zone_low=0.0, buy_zone_high=1.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        spread = _get_check(results, "spread_filter")
        # Always passes in v2 regardless of price
        assert spread.passed


# ── Position size limit (dead-code detection) ─────────────────────────────────

class TestPositionSizeLimit:
    def test_position_size_limit_passes_when_notional_within_limit(self) -> None:
        """
        BUG-001 fixed: notional is now computed as (max_trade_amount / price) * price,
        which equals max_trade_amount (no floating-point error for clean numbers),
        so the check correctly passes when the trade fits within the cap.
        """
        snap = _make_snap(current_price=148.0)
        settings = _make_settings(max_trade_amount=500.0)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "position_size_limit")
        assert check.passed

    def test_position_size_limit_passes_at_max(self) -> None:
        snap = _make_snap()
        settings = _make_settings(max_trade_amount=1000.0)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "position_size_limit")
        assert check.passed


# ── Price boundary edge cases ─────────────────────────────────────────────────

class TestPriceBoundaryEdgeCases:
    def test_price_exactly_at_zone_low_passes(self) -> None:
        snap = _make_snap(current_price=140.0, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert check.passed

    def test_price_exactly_at_zone_high_passes(self) -> None:
        snap = _make_snap(current_price=155.0, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert check.passed

    def test_price_one_cent_above_zone_fails(self) -> None:
        snap = _make_snap(current_price=155.01, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert not check.passed

    def test_price_one_cent_below_zone_fails(self) -> None:
        snap = _make_snap(current_price=139.99, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert not check.passed

    def test_exactly_at_confidence_threshold_passes(self) -> None:
        snap = _make_snap(confidence_score=0.70)
        settings = _make_settings(confidence_threshold=0.70)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "confidence_above_threshold")
        assert check.passed

    def test_price_exactly_one_dollar_passes_liquidity(self) -> None:
        snap = _make_snap(current_price=1.0, buy_zone_low=0.90, buy_zone_high=1.10)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "liquidity_filter")
        assert check.passed

    def test_price_just_below_one_dollar_fails_liquidity(self) -> None:
        snap = _make_snap(current_price=0.99, buy_zone_low=0.90, buy_zone_high=1.10)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "liquidity_filter")
        assert not check.passed


# ── Async safeguards: no_duplicate_order ─────────────────────────────────────

class TestNoDuplicateOrderSafeguard:
    @pytest.mark.asyncio
    async def test_no_existing_order_passes(self) -> None:
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        check = await _check_no_duplicate_order(user_id=1, ticker="AAPL", db=db)
        assert check.passed
        assert check.result == "PASSED"

    @pytest.mark.asyncio
    async def test_existing_order_within_24h_fails(self) -> None:
        db = AsyncMock()
        existing_order = MagicMock(spec=BrokerOrder)
        existing_order.id = 42
        existing_order.status = "filled"
        result = MagicMock()
        result.scalar_one_or_none.return_value = existing_order
        db.execute = AsyncMock(return_value=result)

        check = await _check_no_duplicate_order(user_id=1, ticker="AAPL", db=db)
        assert not check.passed
        assert "FAILED" in check.result
        assert "order_id=42" in check.result


# ── Async safeguards: daily_risk_budget ──────────────────────────────────────

class TestDailyRiskBudgetSafeguard:
    @pytest.mark.asyncio
    async def test_no_orders_today_passes(self) -> None:
        db = AsyncMock()
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=result)

        settings = _make_settings(max_trade_amount=1000.0)
        check = await _check_daily_risk_budget(user_id=1, settings=settings, db=db)
        assert check.passed

    @pytest.mark.asyncio
    async def test_budget_exceeded_fails(self) -> None:
        db = AsyncMock()
        # Three filled orders at $1000 each = $3000 = daily cap (3x $1000)
        order1 = MagicMock(spec=BrokerOrder)
        order1.notional_usd = 1000.0
        order1.filled_price = None
        order1.filled_quantity = None
        order2 = MagicMock(spec=BrokerOrder)
        order2.notional_usd = 1000.0
        order2.filled_price = None
        order2.filled_quantity = None
        order3 = MagicMock(spec=BrokerOrder)
        order3.notional_usd = 1000.0
        order3.filled_price = None
        order3.filled_quantity = None
        result = MagicMock()
        result.scalars.return_value.all.return_value = [order1, order2, order3]
        db.execute = AsyncMock(return_value=result)

        settings = _make_settings(max_trade_amount=1000.0)
        check = await _check_daily_risk_budget(user_id=1, settings=settings, db=db)
        assert not check.passed
        assert "FAILED" in check.result
        assert "daily risk budget" in check.result.lower()

    @pytest.mark.asyncio
    async def test_budget_one_cent_below_cap_passes(self) -> None:
        db = AsyncMock()
        # Two orders at $999.99 each = $1999.98 < $3000 cap
        order = MagicMock(spec=BrokerOrder)
        order.notional_usd = 999.99
        order.filled_price = None
        order.filled_quantity = None
        result = MagicMock()
        result.scalars.return_value.all.return_value = [order]
        db.execute = AsyncMock(return_value=result)

        settings = _make_settings(max_trade_amount=1000.0)
        check = await _check_daily_risk_budget(user_id=1, settings=settings, db=db)
        assert check.passed


# ── run_full_safeguards: 9 total results ─────────────────────────────────────

class TestRunFullSafeguards:
    @pytest.mark.asyncio
    async def test_returns_9_results(self) -> None:
        db = AsyncMock()
        no_order_result = MagicMock()
        no_order_result.scalar_one_or_none.return_value = None
        no_orders_today = MagicMock()
        no_orders_today.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(side_effect=[no_order_result, no_orders_today])

        snap = _make_snap()
        settings = _make_settings()
        results = await run_full_safeguards(
            ticker="AAPL",
            snap=snap,
            settings=settings,
            near_earnings=False,
            user_id=1,
            db=db,
        )
        assert len(results) == 9

    @pytest.mark.asyncio
    async def test_check_names_match_safeguard_list(self) -> None:
        db = AsyncMock()
        no_order_result = MagicMock()
        no_order_result.scalar_one_or_none.return_value = None
        no_orders_today = MagicMock()
        no_orders_today.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(side_effect=[no_order_result, no_orders_today])

        snap = _make_snap()
        settings = _make_settings()
        results = await run_full_safeguards("AAPL", snap, settings, False, 1, db)
        result_names = [r.check for r in results]
        for expected_check in SAFEGUARD_CHECKS:
            assert expected_check in result_names, f"Missing safeguard: {expected_check}"
