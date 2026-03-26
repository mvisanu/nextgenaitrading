"""
Watchlist Ideas API.

GET    /api/ideas              list user's ideas, sorted by rank_score desc
POST   /api/ideas              create new idea
PATCH  /api/ideas/{id}         update idea
DELETE /api/ideas/{id}         delete idea

Ideas are auto-ranked by:
  rank_score = (theme_score_total * 0.35)
             + (entry_quality_score * 0.35)
             + (conviction_score / 10 * 0.20)
             + (alert_readiness_bonus * 0.10)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user
from app.core.security import assert_ownership
from app.db.session import get_db
from app.models.alert import PriceAlertRule
from app.models.buy_zone import StockBuyZoneSnapshot
from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.theme_score import StockThemeScore
from app.models.user import User
from app.schemas.idea import IdeaCreate, IdeaOut, IdeaUpdate, TickerOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ideas", tags=["ideas"])


async def _compute_rank_score(
    idea: WatchlistIdea,
    tickers: list[WatchlistIdeaTicker],
    db: AsyncSession,
) -> float:
    """
    Compute composite rank score for an idea.

    rank_score = (theme_score_total * 0.35)
               + (entry_quality_score * 0.35)
               + (conviction_score / 10 * 0.20)
               + (alert_readiness_bonus * 0.10)
    """
    # Use primary ticker for quality scores, fall back to first ticker
    primary = next((t for t in tickers if t.is_primary), tickers[0] if tickers else None)
    if not primary:
        return float(idea.conviction_score or 5) / 10.0 * 0.20

    ticker = primary.ticker

    # Theme score
    ts_result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.ticker == ticker)
    )
    ts = ts_result.scalar_one_or_none()
    theme_score = float(ts.theme_score_total) if ts else 0.0

    # Entry quality score from latest buy zone snapshot
    from sqlalchemy import desc
    bz_result = await db.execute(
        select(StockBuyZoneSnapshot)
        .where(StockBuyZoneSnapshot.ticker == ticker)
        .order_by(desc(StockBuyZoneSnapshot.created_at))
        .limit(1)
    )
    bz = bz_result.scalar_one_or_none()
    entry_quality = float(bz.entry_quality_score) if bz else 0.0

    # Conviction score (normalised)
    conviction = float(idea.conviction_score or 5) / 10.0

    # Alert readiness bonus: has an active alert that hasn't fired in 24h?
    alert_result = await db.execute(
        select(PriceAlertRule).where(
            PriceAlertRule.user_id == idea.user_id,
            PriceAlertRule.ticker == ticker,
            PriceAlertRule.enabled.is_(True),
        ).limit(1)
    )
    alert = alert_result.scalar_one_or_none()
    alert_readiness = 1.0 if alert else 0.0

    rank = (
        theme_score * 0.35
        + entry_quality * 0.35
        + conviction * 0.20
        + alert_readiness * 0.10
    )
    return round(min(1.0, rank), 4)


async def _build_idea_out(idea: WatchlistIdea, db: AsyncSession) -> IdeaOut:
    tickers = [
        TickerOut(
            id=t.id, idea_id=t.idea_id, ticker=t.ticker,
            is_primary=t.is_primary, near_earnings=t.near_earnings
        )
        for t in idea.tickers
    ]
    rank_score = await _compute_rank_score(idea, idea.tickers, db)
    return IdeaOut(
        id=idea.id,
        user_id=idea.user_id,
        title=idea.title,
        thesis=idea.thesis,
        conviction_score=idea.conviction_score,
        watch_only=idea.watch_only,
        tradable=idea.tradable,
        tags_json=idea.tags_json or [],
        tickers=tickers,
        metadata=idea.metadata_json or {},
        rank_score=rank_score,
        created_at=idea.created_at,
        updated_at=idea.updated_at,
    )


async def _get_idea(idea_id: int, db: AsyncSession, current_user: User) -> WatchlistIdea:
    result = await db.execute(
        select(WatchlistIdea)
        .options(selectinload(WatchlistIdea.tickers))
        .where(WatchlistIdea.id == idea_id)
    )
    idea = result.scalar_one_or_none()
    if not idea:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Idea not found.")
    assert_ownership(idea.user_id, current_user.id)
    return idea


@router.get("", response_model=list[IdeaOut])
async def list_ideas(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[IdeaOut]:
    """List all ideas for the current user, sorted by composite rank score descending."""
    result = await db.execute(
        select(WatchlistIdea)
        .options(selectinload(WatchlistIdea.tickers))
        .where(WatchlistIdea.user_id == current_user.id)
    )
    ideas = list(result.scalars().all())
    out_list = []
    for idea in ideas:
        out_list.append(await _build_idea_out(idea, db))
    # Sort by rank_score descending
    out_list.sort(key=lambda x: x.rank_score, reverse=True)
    return out_list


@router.post("", response_model=IdeaOut, status_code=status.HTTP_201_CREATED)
async def create_idea(
    payload: IdeaCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IdeaOut:
    """Create a new watchlist idea with optional linked tickers."""
    idea = WatchlistIdea(
        user_id=current_user.id,
        title=payload.title,
        thesis=payload.thesis,
        conviction_score=payload.conviction_score,
        watch_only=payload.watch_only,
        tradable=payload.tradable,
        tags_json=payload.tags_json,
        metadata_json=payload.metadata,
    )
    db.add(idea)
    await db.flush()  # get idea.id before adding tickers

    for ticker_in in payload.tickers:
        db.add(WatchlistIdeaTicker(
            idea_id=idea.id,
            ticker=ticker_in.ticker.upper(),
            is_primary=ticker_in.is_primary,
            near_earnings=ticker_in.near_earnings,
        ))

    await db.commit()
    await db.refresh(idea)

    # Reload with tickers
    result = await db.execute(
        select(WatchlistIdea)
        .options(selectinload(WatchlistIdea.tickers))
        .where(WatchlistIdea.id == idea.id)
    )
    idea = result.scalar_one()
    logger.info("Idea created: id=%d user_id=%d title=%s", idea.id, current_user.id, idea.title)
    return await _build_idea_out(idea, db)


@router.patch("/{idea_id}", response_model=IdeaOut)
async def update_idea(
    idea_id: int,
    payload: IdeaUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> IdeaOut:
    """Partial update an idea. When tickers are provided, replaces all linked tickers."""
    idea = await _get_idea(idea_id, db, current_user)

    if payload.title is not None:
        idea.title = payload.title
    if payload.thesis is not None:
        idea.thesis = payload.thesis
    if payload.conviction_score is not None:
        idea.conviction_score = payload.conviction_score
    if payload.watch_only is not None:
        idea.watch_only = payload.watch_only
    if payload.tradable is not None:
        idea.tradable = payload.tradable
    if payload.tags_json is not None:
        idea.tags_json = payload.tags_json
    if payload.metadata is not None:
        idea.metadata_json = payload.metadata

    if payload.tickers is not None:
        # Replace all linked tickers
        for t in idea.tickers:
            await db.delete(t)
        await db.flush()
        for ticker_in in payload.tickers:
            db.add(WatchlistIdeaTicker(
                idea_id=idea.id,
                ticker=ticker_in.ticker.upper(),
                is_primary=ticker_in.is_primary,
                near_earnings=ticker_in.near_earnings,
            ))

    idea.updated_at = datetime.now(timezone.utc)
    await db.commit()

    # Reload with tickers
    result = await db.execute(
        select(WatchlistIdea)
        .options(selectinload(WatchlistIdea.tickers))
        .where(WatchlistIdea.id == idea.id)
    )
    idea = result.scalar_one()
    return await _build_idea_out(idea, db)


@router.delete("/{idea_id}")
async def delete_idea(
    idea_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Delete an idea and all its linked tickers."""
    idea = await _get_idea(idea_id, db, current_user)
    await db.delete(idea)
    await db.commit()
    logger.info("Idea deleted: id=%d user_id=%d", idea_id, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
