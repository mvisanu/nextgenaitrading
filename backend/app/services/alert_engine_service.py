"""
Alert Engine Service.

Evaluates all enabled PriceAlertRule records against current buy zone
snapshots and theme scores. Called by the scheduler every N minutes.

Alert types:
  entered_buy_zone     — current price moved inside buy_zone_low..buy_zone_high
  near_buy_zone        — current price within proximity_pct% of buy_zone_low
  below_invalidation   — current price dropped below invalidation_price
  confidence_improved  — confidence_score increased by >= 0.10 since last snapshot
  theme_score_increased — theme_score_total increased by >= 0.15
  macro_deterioration  — theme score dropped by >= 0.15

All evaluation is idempotent. Cooldown logic prevents re-firing within
the configured window. Market-hours filtering respects NYSE hours 09:30–16:00 ET.
"""
from __future__ import annotations

import logging
from datetime import datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import PriceAlertRule
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.theme_score import StockThemeScore
from app.services.notification_service import dispatch_notification

logger = logging.getLogger(__name__)

# NYSE market hours in ET
_NYSE_OPEN = time(9, 30)
_NYSE_CLOSE = time(16, 0)

# Minimum delta for confidence_improved alert
CONFIDENCE_IMPROVED_DELTA = 0.10

# Minimum delta for theme_score_increased alert
THEME_SCORE_INCREASED_DELTA = 0.15

# Maximum delta for macro_deterioration alert (score dropped by this much)
MACRO_DETERIORATION_DELTA = 0.15


def _is_market_hours() -> bool:
    """Return True if current time is within NYSE market hours (Mon–Fri, 09:30–16:00 ET)."""
    from zoneinfo import ZoneInfo
    now_et = datetime.now(ZoneInfo("America/New_York"))
    if now_et.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    return _NYSE_OPEN <= now_et.time() <= _NYSE_CLOSE


def _is_in_cooldown(rule: PriceAlertRule) -> bool:
    """Return True if the rule is within its cooldown window."""
    if rule.last_triggered_at is None:
        return False
    now = datetime.now(timezone.utc)
    cooldown_end = rule.last_triggered_at + timedelta(minutes=rule.cooldown_minutes)
    return now < cooldown_end


def _check_entered_buy_zone(price: float, snap: StockBuyZoneSnapshot, rule: PriceAlertRule) -> Optional[str]:
    """Fire if current price is inside the buy zone range."""
    if snap.buy_zone_low <= price <= snap.buy_zone_high:
        return (
            f"{rule.ticker} entered the historically favorable buy zone "
            f"[{snap.buy_zone_low:.2f} – {snap.buy_zone_high:.2f}] "
            f"at current price {price:.2f} (confidence: {snap.confidence_score:.0%})"
        )
    return None


def _check_near_buy_zone(price: float, snap: StockBuyZoneSnapshot, rule: PriceAlertRule) -> Optional[str]:
    """
    Fire if current price is within proximity_pct% ABOVE the buy_zone_low
    but has not yet entered the zone (i.e., still above buy_zone_high).

    Scenario: price is approaching from above, closing in on the top of the zone.
    """
    proximity_pct = rule.threshold_json.get("proximity_pct", 2.0)
    # The alert fires when price is within proximity_pct% of buy_zone_high (approaching from above)
    threshold_price = snap.buy_zone_high * (1 + proximity_pct / 100)

    # Already inside the zone — entered_buy_zone alert handles this
    if price <= snap.buy_zone_high:
        return None

    # Price is approaching the zone from above
    if price <= threshold_price:
        distance_pct = (price - snap.buy_zone_high) / snap.buy_zone_high * 100
        return (
            f"{rule.ticker} is within {distance_pct:.1f}% of the buy zone upper bound "
            f"({snap.buy_zone_high:.2f}); current price: {price:.2f} — "
            f"zone entry may be imminent"
        )
    return None


def _check_below_invalidation(price: float, snap: StockBuyZoneSnapshot, rule: PriceAlertRule) -> Optional[str]:
    """Fire if current price dropped below the invalidation level."""
    if price < snap.invalidation_price:
        return (
            f"{rule.ticker} dropped below the invalidation level "
            f"({snap.invalidation_price:.2f}); current price: {price:.2f}. "
            f"Thesis may need to be reassessed."
        )
    return None


async def _check_confidence_improved(
    ticker: str, current_confidence: float, db: AsyncSession
) -> Optional[str]:
    """Fire if confidence_score increased by >= 0.10 vs the previous snapshot."""
    result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker)
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .offset(1)  # second most recent
        .limit(1)
    )
    prev = result.scalar_one_or_none()
    if prev and (current_confidence - prev.confidence_score) >= CONFIDENCE_IMPROVED_DELTA:
        return (
            f"{ticker} confidence score improved from {prev.confidence_score:.0%} "
            f"to {current_confidence:.0%} (+{(current_confidence - prev.confidence_score):.0%})"
        )
    return None



async def evaluate_rule(
    rule: PriceAlertRule,
    db: AsyncSession,
) -> bool:
    """
    Evaluate a single alert rule against the latest buy zone snapshot.
    Returns True if the alert fired.
    """
    if not rule.enabled:
        return False

    if rule.market_hours_only and not _is_market_hours():
        logger.debug("Alert %d skipped: outside market hours", rule.id)
        return False

    if _is_in_cooldown(rule):
        logger.debug("Alert %d skipped: within cooldown window", rule.id)
        return False

    # Fetch latest buy zone snapshot for this ticker
    snap_result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == rule.ticker)
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    snap = snap_result.scalar_one_or_none()

    if snap is None:
        logger.debug("Alert %d: no buy zone snapshot for %s", rule.id, rule.ticker)
        return False

    current_price = snap.current_price
    message: Optional[str] = None

    if rule.alert_type == "entered_buy_zone":
        message = _check_entered_buy_zone(current_price, snap, rule)
    elif rule.alert_type == "near_buy_zone":
        message = _check_near_buy_zone(current_price, snap, rule)
    elif rule.alert_type == "below_invalidation":
        message = _check_below_invalidation(current_price, snap, rule)
    elif rule.alert_type == "confidence_improved":
        message = await _check_confidence_improved(rule.ticker, snap.confidence_score, db)
    elif rule.alert_type == "theme_score_increased":
        # Simplified: always fetch and compare — in v3, add history table.
        # prev_theme_score defaults to 0.0 (not the current score) so that rules
        # created without an explicit baseline can still fire once the score rises
        # above the THEME_SCORE_INCREASED_DELTA threshold.
        ts_result = await db.execute(
            select(StockThemeScore).where(StockThemeScore.ticker == rule.ticker)
        )
        ts = ts_result.scalar_one_or_none()
        if ts:
            prev_score = rule.threshold_json.get("prev_theme_score", 0.0)
            if (ts.theme_score_total - prev_score) >= THEME_SCORE_INCREASED_DELTA:
                message = (
                    f"{rule.ticker} theme score increased from {prev_score:.0%} "
                    f"to {ts.theme_score_total:.0%}"
                )
    elif rule.alert_type == "macro_deterioration":
        # prev_theme_score defaults to 1.0 (maximum) so that rules created without
        # an explicit baseline can fire once the score deteriorates enough from a
        # high starting point.
        ts_result = await db.execute(
            select(StockThemeScore).where(StockThemeScore.ticker == rule.ticker)
        )
        ts = ts_result.scalar_one_or_none()
        if ts:
            prev_score = rule.threshold_json.get("prev_theme_score", 1.0)
            if (prev_score - ts.theme_score_total) >= MACRO_DETERIORATION_DELTA:
                message = (
                    f"{rule.ticker} macro/theme score deteriorated from {prev_score:.0%} "
                    f"to {ts.theme_score_total:.0%} — thesis conditions may have changed"
                )

    if message:
        logger.info("Alert fired: rule_id=%d user_id=%d type=%s", rule.id, rule.user_id, rule.alert_type)
        await dispatch_notification(
            user_id=rule.user_id,
            subject=f"NextGenStock Alert: {rule.ticker} — {rule.alert_type}",
            body=message,
            metadata={
                "alert_rule_id": rule.id,
                "alert_type": rule.alert_type,
                "ticker": rule.ticker,
                "snapshot_id": snap.id,
            },
        )
        # Update last_triggered_at
        rule.last_triggered_at = datetime.now(timezone.utc)
        await db.commit()
        return True

    logger.debug("Alert %d: condition not met (type=%s ticker=%s)", rule.id, rule.alert_type, rule.ticker)
    return False


async def evaluate_all_alerts(db: AsyncSession) -> dict:
    """
    Evaluate all enabled alert rules. Called by the scheduler.

    Returns a summary dict with counts for audit logging.
    """
    logger.info("Alert evaluation cycle starting")
    result = await db.execute(
        select(PriceAlertRule).where(PriceAlertRule.enabled.is_(True))
    )
    rules = list(result.scalars().all())
    logger.info("Found %d enabled alert rules", len(rules))

    fired = skipped = errors = 0

    for rule in rules:
        try:
            did_fire = await evaluate_rule(rule, db)
            if did_fire:
                fired += 1
            else:
                skipped += 1
        except Exception as exc:
            errors += 1
            logger.exception("Error evaluating alert rule %d: %s", rule.id, exc)

    summary = {"rules_evaluated": len(rules), "fired": fired, "skipped": skipped, "errors": errors}
    logger.info("Alert evaluation complete: %s", summary)
    return summary
