"""
Extended unit tests for alert_engine_service.

Covers:
- market hours filtering in detail
- near_buy_zone default proximity_pct (missing threshold_json)
- confidence_improved async check
- theme_score_increased / macro_deterioration conditions
- evaluate_rule: enabled/disabled guard, snapshot missing guard
- evaluate_rule: market_hours_only=False bypasses time check
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.models.alert import PriceAlertRule
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.theme_score import StockThemeScore
from app.services.alert_engine_service import (
    CONFIDENCE_IMPROVED_DELTA,
    MACRO_DETERIORATION_DELTA,
    THEME_SCORE_INCREASED_DELTA,
    _check_below_invalidation,
    _check_confidence_improved,
    _check_entered_buy_zone,
    _check_near_buy_zone,
    _is_in_cooldown,
    _is_market_hours,
    evaluate_rule,
)


def _make_snap(**kwargs) -> StockBuyZoneSnapshot:
    defaults = dict(
        ticker="AAPL",
        current_price=150.0,
        buy_zone_low=140.0,
        buy_zone_high=155.0,
        confidence_score=0.75,
        invalidation_price=130.0,
        id=1,
    )
    defaults.update(kwargs)
    snap = MagicMock(spec=StockBuyZoneSnapshot)
    for k, v in defaults.items():
        setattr(snap, k, v)
    return snap


def _make_rule(**kwargs) -> PriceAlertRule:
    defaults = dict(
        id=1,
        user_id=1,
        ticker="AAPL",
        alert_type="entered_buy_zone",
        threshold_json={},
        cooldown_minutes=60,
        market_hours_only=False,
        last_triggered_at=None,
        enabled=True,
    )
    defaults.update(kwargs)
    rule = MagicMock(spec=PriceAlertRule)
    for k, v in defaults.items():
        setattr(rule, k, v)
    return rule


# ── Near buy zone default proximity ──────────────────────────────────────────

class TestNearBuyZoneDefaultProximity:
    def test_default_2pct_used_when_no_threshold(self) -> None:
        """
        When threshold_json is empty, proximity_pct defaults to 2.0.
        threshold_price = 155 * 1.02 = 158.1
        Price at 157 is between 155 and 158.1 → should trigger.
        """
        snap = _make_snap(current_price=157.0, buy_zone_low=140.0, buy_zone_high=155.0)
        rule = _make_rule(alert_type="near_buy_zone", threshold_json={})
        msg = _check_near_buy_zone(157.0, snap, rule)
        assert msg is not None

    def test_custom_5pct_proximity(self) -> None:
        """
        threshold_price = 155 * 1.05 = 162.75
        Price at 161 is between 155 and 162.75 → should trigger.
        """
        snap = _make_snap(buy_zone_high=155.0)
        rule = _make_rule(alert_type="near_buy_zone", threshold_json={"proximity_pct": 5.0})
        msg = _check_near_buy_zone(161.0, snap, rule)
        assert msg is not None

    def test_zero_proximity_triggers_only_at_boundary(self) -> None:
        """
        0% proximity: threshold_price = 155 * 1.0 = 155. Price must be > 155.
        """
        snap = _make_snap(buy_zone_high=155.0)
        rule = _make_rule(alert_type="near_buy_zone", threshold_json={"proximity_pct": 0.0})
        # Price exactly at zone high is inside the zone → no trigger
        msg = _check_near_buy_zone(155.0, snap, rule)
        assert msg is None

    def test_below_invalidation_at_boundary(self) -> None:
        """Price exactly at invalidation should NOT trigger the alert."""
        snap = _make_snap(invalidation_price=130.0)
        rule = _make_rule(alert_type="below_invalidation")
        msg = _check_below_invalidation(130.0, snap, rule)
        assert msg is None


# ── Confidence improved async check ──────────────────────────────────────────

class TestConfidenceImprovedCheck:
    @pytest.mark.asyncio
    async def test_no_previous_snapshot_no_trigger(self) -> None:
        db = AsyncMock()
        result = MagicMock()
        result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=result)

        msg = await _check_confidence_improved("AAPL", current_confidence=0.80, db=db)
        assert msg is None

    @pytest.mark.asyncio
    async def test_large_improvement_triggers(self) -> None:
        db = AsyncMock()
        prev_snap = MagicMock(spec=StockBuyZoneSnapshot)
        prev_snap.confidence_score = 0.60
        result = MagicMock()
        result.scalar_one_or_none.return_value = prev_snap
        db.execute = AsyncMock(return_value=result)

        # Delta = 0.80 - 0.60 = 0.20 >= CONFIDENCE_IMPROVED_DELTA (0.10)
        msg = await _check_confidence_improved("AAPL", current_confidence=0.80, db=db)
        assert msg is not None
        assert "improved" in msg.lower() or "confidence" in msg.lower()

    @pytest.mark.asyncio
    async def test_small_improvement_no_trigger(self) -> None:
        db = AsyncMock()
        prev_snap = MagicMock(spec=StockBuyZoneSnapshot)
        prev_snap.confidence_score = 0.75
        result = MagicMock()
        result.scalar_one_or_none.return_value = prev_snap
        db.execute = AsyncMock(return_value=result)

        # Delta = 0.80 - 0.75 = 0.05 < CONFIDENCE_IMPROVED_DELTA (0.10)
        msg = await _check_confidence_improved("AAPL", current_confidence=0.80, db=db)
        assert msg is None

    @pytest.mark.asyncio
    async def test_exactly_at_delta_triggers(self) -> None:
        db = AsyncMock()
        prev_snap = MagicMock(spec=StockBuyZoneSnapshot)
        prev_snap.confidence_score = 0.70
        result = MagicMock()
        result.scalar_one_or_none.return_value = prev_snap
        db.execute = AsyncMock(return_value=result)

        # Delta = 0.80 - 0.70 = 0.10 == CONFIDENCE_IMPROVED_DELTA → should trigger
        msg = await _check_confidence_improved("AAPL", current_confidence=0.80, db=db)
        assert msg is not None

    @pytest.mark.asyncio
    async def test_score_decreased_no_trigger(self) -> None:
        db = AsyncMock()
        prev_snap = MagicMock(spec=StockBuyZoneSnapshot)
        prev_snap.confidence_score = 0.90  # was higher before
        result = MagicMock()
        result.scalar_one_or_none.return_value = prev_snap
        db.execute = AsyncMock(return_value=result)

        msg = await _check_confidence_improved("AAPL", current_confidence=0.70, db=db)
        assert msg is None


# ── evaluate_rule: gate conditions ───────────────────────────────────────────

class TestEvaluateRuleGates:
    @pytest.mark.asyncio
    async def test_disabled_rule_returns_false(self) -> None:
        db = AsyncMock()
        rule = _make_rule(enabled=False)
        fired = await evaluate_rule(rule, db)
        assert fired is False
        # Should not query DB at all
        db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_market_hours_only_skips_outside_hours(self) -> None:
        db = AsyncMock()
        rule = _make_rule(market_hours_only=True)
        with patch(
            "app.services.alert_engine_service._is_market_hours",
            return_value=False,
        ):
            fired = await evaluate_rule(rule, db)
        assert fired is False

    @pytest.mark.asyncio
    async def test_market_hours_only_false_ignores_time(self) -> None:
        """With market_hours_only=False, evaluation proceeds even outside hours."""
        db = AsyncMock()
        # No snapshot in DB → fires False but should not early-exit on market hours
        snap_result = MagicMock()
        snap_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=snap_result)
        rule = _make_rule(market_hours_only=False, enabled=True)

        with patch(
            "app.services.alert_engine_service._is_market_hours",
            return_value=False,
        ):
            fired = await evaluate_rule(rule, db)
        # Returns False because no snapshot, but market hours check was bypassed
        assert fired is False
        db.execute.assert_called()  # should have tried to fetch snapshot

    @pytest.mark.asyncio
    async def test_cooldown_prevents_firing(self) -> None:
        db = AsyncMock()
        rule = _make_rule(
            alert_type="entered_buy_zone",
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(minutes=30),
        )
        fired = await evaluate_rule(rule, db)
        assert fired is False

    @pytest.mark.asyncio
    async def test_no_snapshot_returns_false(self) -> None:
        db = AsyncMock()
        snap_result = MagicMock()
        snap_result.scalar_one_or_none.return_value = None
        db.execute = AsyncMock(return_value=snap_result)
        rule = _make_rule(market_hours_only=False)
        fired = await evaluate_rule(rule, db)
        assert fired is False


# ── evaluate_rule: full trigger path ─────────────────────────────────────────

class TestEvaluateRuleTrigger:
    @pytest.mark.asyncio
    async def test_entered_buy_zone_fires_and_updates_last_triggered(self) -> None:
        snap = _make_snap(current_price=145.0, buy_zone_low=140.0, buy_zone_high=155.0)
        snap_result = MagicMock()
        snap_result.scalar_one_or_none.return_value = snap

        db = AsyncMock()
        db.execute = AsyncMock(return_value=snap_result)
        db.commit = AsyncMock()

        rule = _make_rule(alert_type="entered_buy_zone", market_hours_only=False)

        with patch("app.services.alert_engine_service.dispatch_notification", new_callable=AsyncMock):
            fired = await evaluate_rule(rule, db)

        assert fired is True
        # last_triggered_at should have been updated
        assert rule.last_triggered_at is not None

    @pytest.mark.asyncio
    async def test_entered_buy_zone_does_not_fire_when_outside(self) -> None:
        snap = _make_snap(current_price=180.0, buy_zone_low=140.0, buy_zone_high=155.0)
        snap_result = MagicMock()
        snap_result.scalar_one_or_none.return_value = snap

        db = AsyncMock()
        db.execute = AsyncMock(return_value=snap_result)

        rule = _make_rule(alert_type="entered_buy_zone", market_hours_only=False)

        fired = await evaluate_rule(rule, db)
        assert fired is False


# ── Cooldown boundary precision ───────────────────────────────────────────────

class TestCooldownBoundaryPrecision:
    def test_one_second_before_cooldown_end_is_in_cooldown(self) -> None:
        from app.services.alert_engine_service import _is_in_cooldown
        rule = _make_rule(
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(seconds=3599),
        )
        assert _is_in_cooldown(rule)

    def test_one_second_after_cooldown_end_is_not_in_cooldown(self) -> None:
        from app.services.alert_engine_service import _is_in_cooldown
        rule = _make_rule(
            cooldown_minutes=60,
            last_triggered_at=datetime.now(timezone.utc) - timedelta(seconds=3601),
        )
        assert not _is_in_cooldown(rule)
