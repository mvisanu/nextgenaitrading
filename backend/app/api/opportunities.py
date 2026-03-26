"""
Opportunities API.

GET /api/opportunities
    V2: Aggregated view of all tickers from the user's watchlist ideas,
    enriched with buy zone scores, theme scores, and alert status.
    Capped at 100 results, sorted by composite rank score descending.

GET /api/opportunities/watchlist
    V3: Enriched table for the user's V3 user_watchlist — shows buy zone,
    latest buy signal status, and all 10 condition flags per ticker.

Filtering via query params:
  - theme: filter by theme tag
  - min_confidence: minimum confidence score
  - alert_active: only show tickers with active alerts
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.alert import PriceAlertRule
from app.models.buy_signal import BuyNowSignal
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.theme_score import StockThemeScore
from app.models.user import User
from app.models.user_watchlist import UserWatchlist
from app.schemas.auto_buy import OpportunityOut
from app.schemas.watchlist import WatchlistOpportunityOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/opportunities", tags=["opportunities"])


@router.get("", response_model=list[OpportunityOut])
async def get_opportunities(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    theme: Optional[str] = Query(default=None, description="Filter by theme tag"),
    min_confidence: Optional[float] = Query(default=None, ge=0.0, le=1.0),
    alert_active: Optional[bool] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=100),
) -> list[OpportunityOut]:
    """
    Return ranked opportunity list for all tickers in the user's watchlist ideas.
    Each entry shows current buy zone status, confidence, theme alignment, and alert state.
    """
    # Collect all unique tickers across user's ideas
    tickers_result = await db.execute(
        select(WatchlistIdeaTicker)
        .join(WatchlistIdea, WatchlistIdea.id == WatchlistIdeaTicker.idea_id)
        .where(WatchlistIdea.user_id == current_user.id)
    )
    ticker_rows = list(tickers_result.scalars().all())

    if not ticker_rows:
        return []

    # Get parent idea data for theme filtering
    ideas_result = await db.execute(
        select(WatchlistIdea).where(WatchlistIdea.user_id == current_user.id)
    )
    ideas = {idea.id: idea for idea in ideas_result.scalars().all()}

    # Apply theme filter
    if theme:
        filtered_tickers = []
        for tr in ticker_rows:
            parent = ideas.get(tr.idea_id)
            if parent and theme in (parent.tags_json or []):
                filtered_tickers.append(tr)
        ticker_rows = filtered_tickers

    # Deduplicate tickers
    seen: set[str] = set()
    unique_tickers: list[str] = []
    for tr in ticker_rows:
        if tr.ticker not in seen:
            seen.add(tr.ticker)
            unique_tickers.append(tr.ticker)

    opportunities: list[OpportunityOut] = []

    for ticker in unique_tickers[:limit]:
        # Buy zone snapshot
        bz_result = await db.execute(
            select(StockBuyZoneSnapshot)
            .where(StockBuyZoneSnapshot.ticker == ticker)
            .order_by(desc(StockBuyZoneSnapshot.created_at))
            .limit(1)
        )
        bz = bz_result.scalar_one_or_none()

        # Theme score
        ts_result = await db.execute(
            select(StockThemeScore).where(StockThemeScore.ticker == ticker)
        )
        ts = ts_result.scalar_one_or_none()

        # Active alerts
        alert_result = await db.execute(
            select(PriceAlertRule).where(
                PriceAlertRule.user_id == current_user.id,
                PriceAlertRule.ticker == ticker,
                PriceAlertRule.enabled.is_(True),
            ).limit(1)
        )
        alert = alert_result.scalar_one_or_none()

        current_price = float(bz.current_price) if bz else 0.0
        confidence = float(bz.confidence_score) if bz else None
        entry_quality = float(bz.entry_quality_score) if bz else None
        theme_score = float(ts.theme_score_total) if ts else None
        alert_active_flag = alert is not None
        auto_buy_eligible = bool(bz and bz.confidence_score >= 0.70) if bz else False

        # Distance to zone
        distance_pct: Optional[float] = None
        if bz and current_price > 0 and bz.buy_zone_high > 0:
            distance_pct = round((current_price - bz.buy_zone_high) / bz.buy_zone_high * 100, 2)

        # Apply filters
        if min_confidence is not None and (confidence is None or confidence < min_confidence):
            continue
        if alert_active is not None and alert_active_flag != alert_active:
            continue

        # Rank score
        rank = (
            (theme_score or 0.0) * 0.35
            + (entry_quality or 0.0) * 0.35
            + 0.5 * 0.20  # default conviction
            + (1.0 if alert_active_flag else 0.0) * 0.10
        )

        opportunities.append(
            OpportunityOut(
                ticker=ticker,
                current_price=current_price,
                buy_zone_low=float(bz.buy_zone_low) if bz else None,
                buy_zone_high=float(bz.buy_zone_high) if bz else None,
                distance_pct=distance_pct,
                confidence_score=confidence,
                entry_quality_score=entry_quality,
                theme_score=theme_score,
                alert_active=alert_active_flag,
                auto_buy_eligible=auto_buy_eligible,
                last_updated=bz.created_at if bz else None,
                rank_score=round(min(1.0, rank), 4),
            )
        )

    # Sort by rank_score descending
    opportunities.sort(key=lambda x: x.rank_score, reverse=True)
    return opportunities[:limit]


# ── V3: Watchlist Opportunities ────────────────────────────────────────────────

@router.get("/watchlist", response_model=list[WatchlistOpportunityOut])
async def get_watchlist_opportunities(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WatchlistOpportunityOut]:
    """
    Return the V3 watchlist for the authenticated user, enriched with:
    - Latest buy zone data (StockBuyZoneSnapshot)
    - Latest buy signal evaluation (BuyNowSignal) including all 10 condition flags
    - Distance to zone percentage
    - Alert enabled status

    Sorted: STRONG_BUY first, then by backtest_confidence descending.
    """
    wl_result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == current_user.id)
        .order_by(UserWatchlist.created_at.desc())
    )
    watchlist_rows = list(wl_result.scalars().all())

    if not watchlist_rows:
        return []

    output: list[WatchlistOpportunityOut] = []

    for row in watchlist_rows:
        ticker = row.ticker

        # Latest buy zone snapshot
        bz_result = await db.execute(
            select(StockBuyZoneSnapshot)
            .where(StockBuyZoneSnapshot.ticker == ticker)
            .order_by(desc(StockBuyZoneSnapshot.created_at))
            .limit(1)
        )
        bz = bz_result.scalar_one_or_none()

        # Latest buy signal evaluation for this user+ticker
        sig_result = await db.execute(
            select(BuyNowSignal)
            .where(BuyNowSignal.user_id == current_user.id, BuyNowSignal.ticker == ticker)
            .order_by(desc(BuyNowSignal.created_at))
            .limit(1)
        )
        sig = sig_result.scalar_one_or_none()

        current_price = float(sig.current_price) if sig else (float(bz.current_price) if bz else None)
        buy_zone_low = float(sig.buy_zone_low) if sig else (float(bz.buy_zone_low) if bz else None)
        buy_zone_high = float(sig.buy_zone_high) if sig else (float(bz.buy_zone_high) if bz else None)

        distance_pct: Optional[float] = None
        if current_price and buy_zone_high and buy_zone_high > 0:
            distance_pct = round((current_price - buy_zone_high) / buy_zone_high * 100, 2)

        output.append(
            WatchlistOpportunityOut(
                ticker=ticker,
                alert_enabled=row.alert_enabled,
                created_at=row.created_at,
                buy_zone_low=buy_zone_low,
                buy_zone_high=buy_zone_high,
                ideal_entry_price=float(sig.ideal_entry_price) if sig else None,
                current_price=current_price,
                distance_to_zone_pct=distance_pct,
                backtest_confidence=float(sig.backtest_confidence) if sig else (float(bz.confidence_score) if bz else None),
                backtest_win_rate_90d=float(sig.backtest_win_rate_90d) if sig else None,
                signal_strength=sig.signal_strength if sig else None,
                all_conditions_pass=sig.all_conditions_pass if sig else False,
                suppressed_reason=sig.suppressed_reason if sig else None,
                price_in_zone=sig.price_in_zone if sig else None,
                above_50d_ma=sig.above_50d_ma if sig else None,
                above_200d_ma=sig.above_200d_ma if sig else None,
                rsi_value=float(sig.rsi_value) if sig else None,
                rsi_confirms=sig.rsi_confirms if sig else None,
                volume_confirms=sig.volume_confirms if sig else None,
                near_support=sig.near_support if sig else None,
                trend_regime_bullish=sig.trend_regime_bullish if sig else None,
                not_near_earnings=sig.not_near_earnings if sig else None,
                no_duplicate_in_cooldown=sig.no_duplicate_in_cooldown if sig else None,
                invalidation_price=float(sig.invalidation_price) if sig else None,
                expected_drawdown=float(sig.expected_drawdown) if sig else None,
                last_signal_at=sig.created_at if sig else None,
            )
        )

    # Sort: STRONG_BUY first, then by confidence descending
    output.sort(
        key=lambda x: (
            0 if x.signal_strength == "STRONG_BUY" else 1,
            -(x.backtest_confidence or 0.0),
        )
    )
    return output
