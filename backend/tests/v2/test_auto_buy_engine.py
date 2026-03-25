"""
Unit tests for auto_buy_engine safeguards.

Tests: each safeguard independently, full pipeline pass, full pipeline block.
DB interactions are mocked via AsyncMock.
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.auto_buy import AutoBuySettings
from app.models.buy_zone import StockBuyZoneSnapshot
from app.services.auto_buy_engine import (
    SafeguardResult,
    run_safeguards,
)


def _make_settings(
    enabled: bool = True,
    paper_mode: bool = True,
    confidence_threshold: float = 0.70,
    max_trade_amount: float = 1000.0,
    max_position_percent: float = 0.05,
    max_expected_drawdown: float = -0.10,
    allow_near_earnings: bool = False,
) -> AutoBuySettings:
    s = MagicMock(spec=AutoBuySettings)
    s.enabled = enabled
    s.paper_mode = paper_mode
    s.confidence_threshold = confidence_threshold
    s.max_trade_amount = max_trade_amount
    s.max_position_percent = max_position_percent
    s.max_expected_drawdown = max_expected_drawdown
    s.allow_near_earnings = allow_near_earnings
    s.allowed_account_ids_json = [1]
    return s


def _make_snap(
    current_price: float = 148.0,
    buy_zone_low: float = 140.0,
    buy_zone_high: float = 155.0,
    confidence_score: float = 0.75,
    expected_drawdown: float = -0.05,
    invalidation_price: float = 130.0,
) -> StockBuyZoneSnapshot:
    snap = MagicMock(spec=StockBuyZoneSnapshot)
    snap.ticker = "AAPL"
    snap.current_price = current_price
    snap.buy_zone_low = buy_zone_low
    snap.buy_zone_high = buy_zone_high
    snap.confidence_score = confidence_score
    snap.expected_drawdown = expected_drawdown
    snap.invalidation_price = invalidation_price
    snap.id = 1
    snap.created_at = datetime.now(timezone.utc)
    return snap


def _get_check(results: list[SafeguardResult], check_name: str) -> SafeguardResult:
    return next(r for r in results if r.check == check_name)


class TestPriceInsideBuyZone:
    def test_price_inside_passes(self) -> None:
        snap = _make_snap(current_price=148.0, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert check.passed

    def test_price_below_zone_fails(self) -> None:
        snap = _make_snap(current_price=130.0, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert not check.passed
        assert "FAILED" in check.result

    def test_price_above_zone_fails(self) -> None:
        snap = _make_snap(current_price=165.0, buy_zone_low=140.0, buy_zone_high=155.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "price_inside_buy_zone")
        assert not check.passed


class TestConfidenceThreshold:
    def test_above_threshold_passes(self) -> None:
        snap = _make_snap(confidence_score=0.80)
        settings = _make_settings(confidence_threshold=0.70)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "confidence_above_threshold")
        assert check.passed

    def test_below_threshold_fails(self) -> None:
        snap = _make_snap(confidence_score=0.60)
        settings = _make_settings(confidence_threshold=0.70)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "confidence_above_threshold")
        assert not check.passed
        assert "FAILED" in check.result

    def test_exactly_at_threshold_passes(self) -> None:
        snap = _make_snap(confidence_score=0.70)
        settings = _make_settings(confidence_threshold=0.70)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "confidence_above_threshold")
        assert check.passed


class TestDrawdownWithinLimit:
    def test_drawdown_within_limit_passes(self) -> None:
        snap = _make_snap(expected_drawdown=-0.05)
        settings = _make_settings(max_expected_drawdown=-0.10)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "drawdown_within_limit")
        assert check.passed

    def test_drawdown_exceeds_limit_fails(self) -> None:
        snap = _make_snap(expected_drawdown=-0.15)
        settings = _make_settings(max_expected_drawdown=-0.10)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "drawdown_within_limit")
        assert not check.passed

    def test_zero_drawdown_passes(self) -> None:
        snap = _make_snap(expected_drawdown=0.0)
        settings = _make_settings(max_expected_drawdown=-0.10)
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "drawdown_within_limit")
        assert check.passed


class TestLiquidityFilter:
    def test_price_above_one_dollar_passes(self) -> None:
        snap = _make_snap(current_price=150.0)
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "liquidity_filter")
        assert check.passed

    def test_price_below_one_dollar_fails(self) -> None:
        snap = _make_snap(
            current_price=0.50,
            buy_zone_low=0.40,
            buy_zone_high=0.60,
        )
        settings = _make_settings()
        results = run_safeguards("AAPL", snap, settings)
        check = _get_check(results, "liquidity_filter")
        assert not check.passed


class TestNearEarnings:
    def test_near_earnings_blocked_when_not_allowed(self) -> None:
        snap = _make_snap()
        settings = _make_settings(allow_near_earnings=False)
        results = run_safeguards("AAPL", snap, settings, near_earnings=True)
        check = _get_check(results, "not_near_earnings")
        assert not check.passed
        assert "FAILED" in check.result

    def test_near_earnings_allowed_when_setting_true(self) -> None:
        snap = _make_snap()
        settings = _make_settings(allow_near_earnings=True)
        results = run_safeguards("AAPL", snap, settings, near_earnings=True)
        check = _get_check(results, "not_near_earnings")
        assert check.passed

    def test_not_near_earnings_always_passes(self) -> None:
        snap = _make_snap()
        settings = _make_settings(allow_near_earnings=False)
        results = run_safeguards("AAPL", snap, settings, near_earnings=False)
        check = _get_check(results, "not_near_earnings")
        assert check.passed


class TestAllSafeguardsPass:
    def test_all_pass_scenario(self) -> None:
        """When all conditions are ideal, all synchronous safeguards should pass."""
        snap = _make_snap(
            current_price=148.0,
            buy_zone_low=140.0,
            buy_zone_high=155.0,
            confidence_score=0.80,
            expected_drawdown=-0.05,
        )
        settings = _make_settings(
            confidence_threshold=0.70,
            max_expected_drawdown=-0.10,
            allow_near_earnings=False,
        )
        results = run_safeguards("AAPL", snap, settings, near_earnings=False)
        sync_checks = [
            "price_inside_buy_zone",
            "confidence_above_threshold",
            "drawdown_within_limit",
            "liquidity_filter",
            "not_near_earnings",
            "position_size_limit",
        ]
        for check_name in sync_checks:
            check = _get_check(results, check_name)
            assert check.passed, f"{check_name} should PASS but got: {check.result}"


class TestAllSafeguardsFail:
    def test_all_fail_scenario(self) -> None:
        """When all conditions are poor, all safeguards should fail."""
        snap = _make_snap(
            current_price=200.0,  # above zone
            buy_zone_low=140.0,
            buy_zone_high=155.0,
            confidence_score=0.40,  # below threshold
            expected_drawdown=-0.25,  # exceeds limit
        )
        settings = _make_settings(
            confidence_threshold=0.70,
            max_expected_drawdown=-0.10,
            allow_near_earnings=False,
        )
        results = run_safeguards("AAPL", snap, settings, near_earnings=True)

        zone_check = _get_check(results, "price_inside_buy_zone")
        confidence_check = _get_check(results, "confidence_above_threshold")
        drawdown_check = _get_check(results, "drawdown_within_limit")
        earnings_check = _get_check(results, "not_near_earnings")

        assert not zone_check.passed
        assert not confidence_check.passed
        assert not drawdown_check.passed
        assert not earnings_check.passed
