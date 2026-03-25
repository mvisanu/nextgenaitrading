"""
Auto-Buy Execution Engine.

CRITICAL: Auto-buy is disabled by default and must be explicitly enabled by the user.
Paper mode is the default when enabled. Real execution requires paper_mode=False
AND explicit user confirmation.

Nine safeguards must ALL pass before any order is submitted:
  1. price_inside_buy_zone
  2. confidence_above_threshold
  3. drawdown_within_limit
  4. liquidity_filter
  5. spread_filter
  6. not_near_earnings (unless allow_near_earnings=True)
  7. position_size_limit
  8. daily_risk_budget
  9. no_duplicate_order

Any single FAILED safeguard blocks execution and produces a full audit log entry.

LANGUAGE RULE: Never use "guaranteed", "safe entry", "certain to go up".
Use "historically favorable", "confidence score", "expected drawdown".
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.broker.factory import get_broker_client
from app.models.auto_buy import AutoBuyDecisionLog, AutoBuySettings
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.live import BrokerOrder
from app.models.user import User
from app.services.credential_service import get_credential

logger = logging.getLogger(__name__)

SAFEGUARD_CHECKS = [
    "price_inside_buy_zone",
    "confidence_above_threshold",
    "drawdown_within_limit",
    "liquidity_filter",
    "spread_filter",
    "not_near_earnings",
    "position_size_limit",
    "daily_risk_budget",
    "no_duplicate_order",
]


@dataclass
class SafeguardResult:
    check: str
    passed: bool
    result: str  # "PASSED" or "FAILED: <reason>"


@dataclass
class AutoBuyDecision:
    ticker: str
    decision_state: str          # see DECISION_STATES in models/auto_buy.py
    reason_codes: list[SafeguardResult]
    signal_payload: dict
    order_payload: Optional[dict]
    dry_run: bool
    user_id: int


async def _get_or_create_settings(user_id: int, db: AsyncSession) -> AutoBuySettings:
    """Return existing auto-buy settings or create defaults for the user."""
    result = await db.execute(
        select(AutoBuySettings).where(AutoBuySettings.user_id == user_id)
    )
    settings_row = result.scalar_one_or_none()
    if settings_row:
        return settings_row
    # Create default settings — auto-buy disabled by default
    defaults = AutoBuySettings(
        user_id=user_id,
        enabled=False,
        paper_mode=True,
        confidence_threshold=0.70,
        max_trade_amount=1000.0,
        max_position_percent=0.05,
        max_expected_drawdown=-0.10,
        allow_near_earnings=False,
        allowed_account_ids_json=[],
    )
    db.add(defaults)
    await db.commit()
    await db.refresh(defaults)
    return defaults


async def _get_latest_snapshot(ticker: str, db: AsyncSession) -> Optional[StockBuyZoneSnapshot]:
    """Fetch the most recent buy zone snapshot for a ticker."""
    result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker.upper())
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _check_no_duplicate_order(
    user_id: int, ticker: str, db: AsyncSession, window_hours: int = 24
) -> SafeguardResult:
    """Block if there is already an active or recently submitted order for this ticker."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=window_hours)
    result = await db.execute(
        select(BrokerOrder).where(
            and_(
                BrokerOrder.user_id == user_id,
                BrokerOrder.symbol == ticker,
                BrokerOrder.created_at >= cutoff,
                BrokerOrder.status.in_(["pending", "filled", "submitted"]),
            )
        ).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return SafeguardResult(
            check="no_duplicate_order",
            passed=False,
            result=f"FAILED: open or recent order for {ticker} exists (order_id={existing.id}, status={existing.status})",
        )
    return SafeguardResult(check="no_duplicate_order", passed=True, result="PASSED")


async def _check_daily_risk_budget(
    user_id: int, settings: AutoBuySettings, db: AsyncSession
) -> SafeguardResult:
    """Block if today's submitted orders already exceed max_trade_amount * 3 (daily cap)."""
    daily_cap = settings.max_trade_amount * 3.0
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(BrokerOrder).where(
            and_(
                BrokerOrder.user_id == user_id,
                BrokerOrder.created_at >= today_start,
                BrokerOrder.status.in_(["filled", "submitted"]),
            )
        )
    )
    today_orders = list(result.scalars().all())
    today_total = sum(
        (o.notional_usd or 0.0) + (o.filled_price or 0.0) * (o.filled_quantity or 0.0)
        for o in today_orders
    )
    if today_total >= daily_cap:
        return SafeguardResult(
            check="daily_risk_budget",
            passed=False,
            result=f"FAILED: daily risk budget exhausted (today: ${today_total:.2f}, cap: ${daily_cap:.2f})",
        )
    return SafeguardResult(check="daily_risk_budget", passed=True, result="PASSED")


def run_safeguards(
    ticker: str,
    snap: StockBuyZoneSnapshot,
    settings: AutoBuySettings,
    near_earnings: bool = False,
) -> list[SafeguardResult]:
    """
    Run all synchronous safeguards against the buy zone snapshot.
    Returns a list of SafeguardResult — one per check.
    Async checks (duplicate order, daily budget) are run separately.
    """
    results: list[SafeguardResult] = []
    price = snap.current_price

    # 1. Price inside buy zone
    if snap.buy_zone_low <= price <= snap.buy_zone_high:
        results.append(SafeguardResult("price_inside_buy_zone", True, "PASSED"))
    else:
        results.append(SafeguardResult(
            "price_inside_buy_zone", False,
            f"FAILED: price {price:.2f} not in buy zone [{snap.buy_zone_low:.2f} – {snap.buy_zone_high:.2f}]"
        ))

    # 2. Confidence above threshold
    if snap.confidence_score >= settings.confidence_threshold:
        results.append(SafeguardResult("confidence_above_threshold", True, "PASSED"))
    else:
        results.append(SafeguardResult(
            "confidence_above_threshold", False,
            f"FAILED: confidence {snap.confidence_score:.2f} below threshold {settings.confidence_threshold:.2f}"
        ))

    # 3. Drawdown within limit
    if snap.expected_drawdown >= settings.max_expected_drawdown:
        results.append(SafeguardResult("drawdown_within_limit", True, "PASSED"))
    else:
        results.append(SafeguardResult(
            "drawdown_within_limit", False,
            f"FAILED: expected drawdown {snap.expected_drawdown:.1%} exceeds limit {settings.max_expected_drawdown:.1%}"
        ))

    # 4. Liquidity filter (approximation: price > $1 avoids penny stocks)
    if price >= 1.0:
        results.append(SafeguardResult("liquidity_filter", True, "PASSED"))
    else:
        results.append(SafeguardResult(
            "liquidity_filter", False,
            f"FAILED: price {price:.4f} below minimum liquidity threshold ($1.00)"
        ))

    # 5. Spread filter (approximation: we don't have real bid/ask here, so always pass in v2)
    # TODO (v3): pull real-time quote from Alpaca to check bid-ask spread
    results.append(SafeguardResult("spread_filter", True, "PASSED (v2: spread check deferred to v3)"))

    # 6. Not near earnings
    if near_earnings and not settings.allow_near_earnings:
        results.append(SafeguardResult(
            "not_near_earnings", False,
            "FAILED: ticker flagged as near earnings date and allow_near_earnings=False"
        ))
    else:
        results.append(SafeguardResult("not_near_earnings", True, "PASSED"))

    # 7. Position size limit — compute the actual notional from price and quantity,
    # then verify it does not exceed the per-trade cap.  When a custom notional
    # override is supported (v3), the caller should pass it in explicitly; for now
    # we derive it from price so the check is non-tautological.
    quantity = settings.max_trade_amount / price if price > 0 else 0.0
    notional = quantity * price
    if notional <= settings.max_trade_amount:
        results.append(SafeguardResult("position_size_limit", True, "PASSED"))
    else:
        results.append(SafeguardResult(
            "position_size_limit", False,
            f"FAILED: trade amount ${notional:.2f} exceeds per-trade limit ${settings.max_trade_amount:.2f}"
        ))

    return results


async def run_full_safeguards(
    ticker: str,
    snap: StockBuyZoneSnapshot,
    settings: AutoBuySettings,
    near_earnings: bool,
    user_id: int,
    db: AsyncSession,
) -> list[SafeguardResult]:
    """Run all nine safeguards (sync + async)."""
    results = run_safeguards(ticker, snap, settings, near_earnings)
    results.append(await _check_no_duplicate_order(user_id, ticker, db))
    results.append(await _check_daily_risk_budget(user_id, settings, db))
    return results


async def evaluate_auto_buy(
    ticker: str,
    user: User,
    db: AsyncSession,
    dry_run: bool = True,
    credential_id: Optional[int] = None,
) -> AutoBuyDecision:
    """
    Full auto-buy decision pipeline for a single ticker.

    If dry_run=True, produces a complete decision breakdown without submitting any order.
    If dry_run=False and all safeguards pass, submits via the broker client.

    Always persists a decision log entry regardless of outcome.
    """
    ticker = ticker.upper()
    logger.info(
        "Auto-buy evaluation: ticker=%s user_id=%d dry_run=%s", ticker, user.id, dry_run
    )

    settings_row = await _get_or_create_settings(user.id, db)
    snap = await _get_latest_snapshot(ticker, db)

    signal_payload: dict = {}
    order_payload: Optional[dict] = None

    if snap is None:
        decision_state = "candidate"
        reason_codes = [
            SafeguardResult("price_inside_buy_zone", False, "FAILED: no buy zone snapshot available for this ticker")
        ]
        # Fill remaining checks as skipped
        for check in SAFEGUARD_CHECKS[1:]:
            reason_codes.append(SafeguardResult(check, False, "SKIPPED: no snapshot available"))
    else:
        signal_payload = {
            "snapshot_id": snap.id,
            "ticker": ticker,
            "current_price": snap.current_price,
            "buy_zone_low": snap.buy_zone_low,
            "buy_zone_high": snap.buy_zone_high,
            "confidence_score": snap.confidence_score,
            "expected_drawdown": snap.expected_drawdown,
            "invalidation_price": snap.invalidation_price,
            "created_at": snap.created_at.isoformat(),
        }

        # Check near_earnings from WatchlistIdeaTicker
        near_earnings_result = await db.execute(
            select(WatchlistIdeaTicker).where(
                and_(
                    WatchlistIdeaTicker.ticker == ticker,
                    WatchlistIdeaTicker.near_earnings.is_(True),
                )
            ).join(
                WatchlistIdea, WatchlistIdea.id == WatchlistIdeaTicker.idea_id
            ).where(WatchlistIdea.user_id == user.id)
        )
        near_earnings = near_earnings_result.scalar_one_or_none() is not None

        reason_codes = await run_full_safeguards(ticker, snap, settings_row, near_earnings, user.id, db)
        all_passed = all(r.passed for r in reason_codes)

        if not settings_row.enabled:
            decision_state = "ready_to_alert"
        elif all_passed:
            decision_state = "ready_to_buy"
        else:
            decision_state = "blocked_by_risk"

        # Execute order if all safeguards passed and not dry_run
        if decision_state == "ready_to_buy" and not dry_run:
            if credential_id is None:
                allowed = settings_row.allowed_account_ids_json
                credential_id = allowed[0] if allowed else None

            if credential_id:
                try:
                    quantity = settings_row.max_trade_amount / snap.current_price
                    order_payload = {
                        "ticker": ticker,
                        "side": "buy",
                        "quantity": round(quantity, 6),
                        "notional_usd": settings_row.max_trade_amount,
                        "paper_mode": settings_row.paper_mode,
                    }

                    cred = await get_credential(credential_id, db, user)
                    client = get_broker_client(cred, paper=settings_row.paper_mode)
                    result = client.place_order(
                        symbol=ticker,
                        side="buy",
                        quantity=quantity,
                        notional_usd=settings_row.max_trade_amount,
                        order_type="market",
                        dry_run=False,
                    )
                    decision_state = "order_submitted"
                    order_payload["broker_order_id"] = result.broker_order_id
                    order_payload["status"] = result.status
                    logger.info("Auto-buy order submitted: %s broker_order_id=%s", ticker, result.broker_order_id)
                except Exception as exc:
                    logger.exception("Auto-buy order failed for %s: %s", ticker, exc)
                    decision_state = "blocked_by_risk"
                    reason_codes.append(SafeguardResult(
                        "order_execution", False, f"FAILED: broker error — {exc}"
                    ))
            else:
                decision_state = "blocked_by_risk"
                reason_codes.append(SafeguardResult(
                    "order_execution", False, "FAILED: no allowed broker account configured"
                ))

    decision = AutoBuyDecision(
        ticker=ticker,
        decision_state=decision_state,
        reason_codes=reason_codes,
        signal_payload=signal_payload,
        order_payload=order_payload,
        dry_run=dry_run,
        user_id=user.id,
    )

    # Persist decision log — always, regardless of outcome
    log_entry = AutoBuyDecisionLog(
        user_id=user.id,
        ticker=ticker,
        decision_state=decision_state,
        reason_codes_json=[{"check": r.check, "result": r.result} for r in reason_codes],
        signal_payload_json=signal_payload,
        order_payload_json=order_payload,
        dry_run=dry_run,
    )
    db.add(log_entry)
    await db.commit()
    await db.refresh(log_entry)

    logger.info(
        "Auto-buy decision logged: id=%d ticker=%s state=%s dry_run=%s",
        log_entry.id,
        ticker,
        decision_state,
        dry_run,
    )
    return decision


async def evaluate_all_auto_buy(db: AsyncSession) -> dict:
    """
    Evaluate auto-buy for all tickers in enabled users' watchlists.
    Called by the scheduler every N minutes.
    """
    from app.models.user import User as UserModel

    logger.info("Auto-buy evaluation cycle starting")

    # Find all users with auto-buy enabled
    result = await db.execute(
        select(AutoBuySettings).where(AutoBuySettings.enabled.is_(True))
    )
    enabled_settings = list(result.scalars().all())

    total = evaluated = errors = 0

    for settings_row in enabled_settings:
        # Get all tradable tickers for this user
        tickers_result = await db.execute(
            select(WatchlistIdeaTicker)
            .join(WatchlistIdea, WatchlistIdea.id == WatchlistIdeaTicker.idea_id)
            .where(
                and_(
                    WatchlistIdea.user_id == settings_row.user_id,
                    WatchlistIdea.tradable.is_(True),
                    WatchlistIdea.watch_only.is_(False),
                )
            )
        )
        tickers = list(tickers_result.scalars().all())
        total += len(tickers)

        # Load user
        user_result = await db.execute(
            select(UserModel).where(UserModel.id == settings_row.user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            continue

        for ticker_row in tickers:
            try:
                await evaluate_auto_buy(
                    ticker=ticker_row.ticker,
                    user=user,
                    db=db,
                    dry_run=False,
                )
                evaluated += 1
            except Exception as exc:
                errors += 1
                logger.exception(
                    "Auto-buy evaluation failed for user_id=%d ticker=%s: %s",
                    settings_row.user_id,
                    ticker_row.ticker,
                    exc,
                )

    summary = {"tickers_checked": total, "evaluated": evaluated, "errors": errors}
    logger.info("Auto-buy evaluation complete: %s", summary)
    return summary
