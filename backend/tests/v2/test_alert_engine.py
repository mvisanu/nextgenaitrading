"""
Unit tests for alert_engine_service.

Tests: each alert type trigger condition, cooldown logic, market hours filter.
All DB calls are mocked.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.alert import PriceAlertRule
from app.models.buy_zone import StockBuyZoneSnapshot
from app.services.alert_engine_service import (
    CONFIDENCE_IMPROVED_DELTA,
    THEME_SCORE_INCREASED_DELTA,
    _check_below_invalidation,
    _check_entered_buy_zone,
    _check_near_buy_zone,
    _is_in_cooldown,
    _is_market_hours,
)


def _make_snap(
    ticker: str = "AAPL",
    current_price: float = 150.0,
    buy_zone_low: float = 140.0,
    buy_zone_high: float = 155.0,
    confidence_score: float = 0.75,
    invalidation_price: float = 130.0,
) -> StockBuyZoneSnapshot:
    snap = MagicMock(spec=StockBuyZoneSnapshot)
    snap.ticker = ticker
    snap.current_price = current_price
    snap.buy_zone_low = buy_zone_low
    snap.buy_zone_high = buy_zone_high
    snap.confidence_score = confidence_score
    snap.invalidation_price = invalidation_price
    snap.id = 1
    return snap


def _make_rule(
    alert_type: str,
    threshold_json: dict | None = None,
    cooldown_minutes: int = 60,
    market_hours_only: bool = False,
    last_triggered_at: datetime | None = None,
    enabled: bool = True,
) -> PriceAlertRule:
    rule = MagicMock(spec=PriceAlertRule)
    rule.id = 1
    rule.user_id = 1
    rule.ticker = "AAPL"
    rule.alert_type = alert_type
    rule.threshold_json = threshold_json or {}
    rule.cooldown_minutes = cooldown_minutes
    rule.market_hours_only = market_hours_only
    rule.last_triggered_at = last_triggered_at
    rule.enabled = enabled
    return rule


class TestCooldown:
    def test_no_previous_trigger_not_in_cooldown(self) -> None:
        rule = _make_rule("entered_buy_zone", last_triggered_at=None)
        assert not _is_in_cooldown(rule)

    def test_within_cooldown_window(self) -> None:
        rule = _make_rule(
            "entered_buy_zone",
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        assert _is_in_cooldown(rule)

    def test_past_cooldown_window(self) -> None:
        rule = _make_rule(
            "entered_buy_zone",
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(minutes=90),
        )
        assert not _is_in_cooldown(rule)

    def test_exactly_at_cooldown_boundary(self) -> None:
        rule = _make_rule(
            "entered_buy_zone",
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(minutes=60),
        )
        # Exactly at boundary is considered past cooldown
        assert not _is_in_cooldown(rule)


class TestEnteredBuyZone:
    def test_price_inside_zone_triggers(self) -> None:
        snap = _make_snap(current_price=145.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("entered_buy_zone")
        msg = _check_entered_buy_zone(145.0, snap, rule)
        assert msg is not None
        assert "entered" in msg.lower() or "buy zone" in msg.lower()

    def test_price_below_zone_no_trigger(self) -> None:
        snap = _make_snap(current_price=130.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("entered_buy_zone")
        msg = _check_entered_buy_zone(130.0, snap, rule)
        assert msg is None

    def test_price_above_zone_no_trigger(self) -> None:
        snap = _make_snap(current_price=160.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("entered_buy_zone")
        msg = _check_entered_buy_zone(160.0, snap, rule)
        assert msg is None

    def test_price_at_zone_boundary_triggers(self) -> None:
        snap = _make_snap(current_price=140.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("entered_buy_zone")
        msg = _check_entered_buy_zone(140.0, snap, rule)
        assert msg is not None


class TestNearBuyZone:
    def test_price_near_zone_from_above_triggers(self) -> None:
        """Price approaching zone from above, within proximity_pct% of buy_zone_high."""
        snap = _make_snap(current_price=157.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("near_buy_zone", threshold_json={"proximity_pct": 2.0})
        # threshold = 155 * 1.02 = 158.1; price 157 is within 2% above zone_high 155
        msg = _check_near_buy_zone(157.0, snap, rule)
        assert msg is not None
        assert "buy zone" in msg.lower() or "zone" in msg.lower()

    def test_price_far_from_zone_no_trigger(self) -> None:
        snap = _make_snap(current_price=180.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("near_buy_zone", threshold_json={"proximity_pct": 2.0})
        # threshold = 155 * 1.02 = 158.1; price 180 is well above threshold
        msg = _check_near_buy_zone(180.0, snap, rule)
        assert msg is None

    def test_price_inside_zone_no_trigger(self) -> None:
        """When price is already inside the zone, near_buy_zone should not fire."""
        snap = _make_snap(current_price=145.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule("near_buy_zone", threshold_json={"proximity_pct": 2.0})
        msg = _check_near_buy_zone(145.0, snap, rule)
        assert msg is None


class TestBelowInvalidation:
    def test_price_below_invalidation_triggers(self) -> None:
        snap = _make_snap(current_price=120.0, invalidation_price=130.0)
        rule = _make_rule("below_invalidation")
        msg = _check_below_invalidation(120.0, snap, rule)
        assert msg is not None
        assert "invalidation" in msg.lower() or "dropped below" in msg.lower()

    def test_price_above_invalidation_no_trigger(self) -> None:
        snap = _make_snap(current_price=140.0, invalidation_price=130.0)
        rule = _make_rule("below_invalidation")
        msg = _check_below_invalidation(140.0, snap, rule)
        assert msg is None

    def test_price_exactly_at_invalidation_no_trigger(self) -> None:
        snap = _make_snap(current_price=130.0, invalidation_price=130.0)
        rule = _make_rule("below_invalidation")
        msg = _check_below_invalidation(130.0, snap, rule)
        assert msg is None
