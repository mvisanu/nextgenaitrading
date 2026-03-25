"""
Buy Zone API endpoints.

GET  /api/stocks/{ticker}/buy-zone
     Returns latest snapshot or triggers calculation if stale (>1 hr).

POST /api/stocks/{ticker}/recalculate-buy-zone
     Force recalculate; always runs full pipeline.

GET  /api/stocks/{ticker}/theme-score
     Returns current theme score.

POST /api/stocks/{ticker}/theme-score/recompute
     Force recompute theme score.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.theme_score import StockThemeScore
from app.models.user import User
from app.schemas.buy_zone import BuyZoneOut
from app.schemas.theme_score import ThemeScoreOut
from app.services.buy_zone_service import (
    calculate_buy_zone,
    get_or_calculate_buy_zone,
)
from app.services.theme_scoring_service import compute_theme_score

from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stocks", tags=["buy-zone"])


@router.get("/{ticker}/buy-zone", response_model=BuyZoneOut)
async def get_buy_zone(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuyZoneOut:
    """
    Return the latest buy zone snapshot for a ticker.
    If the snapshot is older than 60 minutes, triggers a recalculation automatically.
    Response language uses only historically favorable / positive outcome rate vocabulary.
    """
    try:
        snap, recalculated = await get_or_calculate_buy_zone(
            ticker=ticker,
            db=db,
            user_id=current_user.id,
            max_age_minutes=60,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return BuyZoneOut.from_snapshot(snap)


@router.post("/{ticker}/recalculate-buy-zone", response_model=BuyZoneOut)
async def recalculate_buy_zone(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BuyZoneOut:
    """
    Force a full recalculation of the buy zone. Always runs the complete pipeline.
    Returns the new snapshot. Persists a user-scoped row.
    """
    try:
        result = await calculate_buy_zone(ticker, db, user_id=current_user.id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # Fetch the freshly persisted snapshot
    from sqlalchemy import select, desc
    from app.models.buy_zone import StockBuyZoneSnapshot

    snap_result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker.upper())
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    snap = snap_result.scalar_one()
    return BuyZoneOut.from_snapshot(snap)


@router.get("/{ticker}/theme-score", response_model=ThemeScoreOut)
async def get_theme_score(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ThemeScoreOut:
    """Return the current theme score for a ticker. Recomputes if no record exists."""
    ts_result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.ticker == ticker.upper())
    )
    ts = ts_result.scalar_one_or_none()

    if ts is None:
        # Auto-compute on first request
        score_result = await compute_theme_score(ticker, current_user.id, db)
        ts_result2 = await db.execute(
            select(StockThemeScore).where(StockThemeScore.ticker == ticker.upper())
        )
        ts = ts_result2.scalar_one()
        return ThemeScoreOut.from_orm_model(ts, score_result.explanation)

    # Build a minimal explanation from stored scores so the response always
    # contains at least one entry (the schema guarantees explanation: list[str]).
    cached_explanation = [
        f"Total theme alignment score: {ts.theme_score_total:.2f}",
        f"Narrative momentum: {ts.narrative_momentum_score:.2f}",
        f"Sector tailwind: {ts.sector_tailwind_score:.2f}",
    ]
    if ts.theme_scores_json:
        top_themes = sorted(ts.theme_scores_json.items(), key=lambda x: x[1], reverse=True)[:3]
        if top_themes:
            cached_explanation.append(
                f"Top themes: {', '.join(f'{k}={v:.2f}' for k, v in top_themes)}"
            )
    return ThemeScoreOut.from_orm_model(ts, cached_explanation)


@router.post("/{ticker}/theme-score/recompute", response_model=ThemeScoreOut)
async def recompute_theme_score(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ThemeScoreOut:
    """Force recompute the theme score for a ticker."""
    score_result = await compute_theme_score(ticker, current_user.id, db)
    ts_result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.ticker == ticker.upper())
    )
    ts = ts_result.scalar_one()
    return ThemeScoreOut.from_orm_model(ts, score_result.explanation)
