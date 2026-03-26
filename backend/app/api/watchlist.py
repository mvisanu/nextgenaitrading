"""
V3 Watchlist API.

POST   /api/watchlist                   — add ticker to user's watchlist
DELETE /api/watchlist/{ticker}          — remove ticker from watchlist
PATCH  /api/watchlist/{ticker}/alert    — toggle alert on/off per ticker
GET    /api/watchlist                   — list user's watchlist (lightweight)

This router owns CRUD for the user_watchlist table.
The enriched view (buy zone + signal status) lives in GET /api/opportunities/watchlist.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.alert import PriceAlertRule
from app.models.user import User
from app.models.user_watchlist import UserWatchlist
from app.schemas.watchlist import (
    WatchlistAddRequest,
    WatchlistAlertToggleRequest,
    WatchlistItemOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


async def _trigger_buy_zone_background(ticker: str, user_id: int) -> None:
    """
    Fire buy zone calculation in the background after a ticker is added.
    Uses a fresh session to avoid transaction conflicts.
    """
    from app.db.session import AsyncSessionLocal
    from app.services.buy_zone_service import calculate_buy_zone

    try:
        async with AsyncSessionLocal() as db:
            await calculate_buy_zone(ticker, db, user_id=user_id)
        logger.info("watchlist: background buy zone complete for %s user_id=%d", ticker, user_id)
    except Exception as exc:
        logger.error("watchlist: background buy zone failed for %s user_id=%d: %s", ticker, user_id, exc)


@router.get("", response_model=list[WatchlistItemOut])
async def list_watchlist(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[WatchlistItemOut]:
    """List all tickers in the authenticated user's V3 watchlist."""
    result = await db.execute(
        select(UserWatchlist)
        .where(UserWatchlist.user_id == current_user.id)
        .order_by(UserWatchlist.created_at.desc())
    )
    rows = list(result.scalars().all())
    return [WatchlistItemOut.model_validate(r) for r in rows]


@router.post("", response_model=WatchlistItemOut, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    payload: WatchlistAddRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WatchlistItemOut:
    """
    Add a ticker to the authenticated user's watchlist.

    Returns HTTP 409 if the ticker is already present.
    Triggers buy zone calculation as a background task.
    """
    ticker = payload.ticker

    # Check for existing row
    existing = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == current_user.id,
            UserWatchlist.ticker == ticker,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        logger.info("watchlist: %s already in watchlist for user_id=%d", ticker, current_user.id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticker already in watchlist.",
        )

    new_row = UserWatchlist(
        user_id=current_user.id,
        ticker=ticker,
        alert_enabled=True,
    )
    db.add(new_row)
    await db.commit()
    await db.refresh(new_row)

    logger.info("watchlist: added %s for user_id=%d", ticker, current_user.id)

    # Trigger buy zone calculation in the background
    background_tasks.add_task(_trigger_buy_zone_background, ticker, current_user.id)

    return WatchlistItemOut.model_validate(new_row)


@router.delete("/{ticker}")
async def remove_from_watchlist(
    ticker: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """
    Remove a ticker from the authenticated user's watchlist.

    BuyNowSignal rows are retained for audit purposes (not cascaded).
    """
    ticker = ticker.upper().strip()
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == current_user.id,
            UserWatchlist.ticker == ticker,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker {ticker} not found in your watchlist.",
        )

    await db.delete(row)
    await db.commit()
    logger.info("watchlist: removed %s for user_id=%d", ticker, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{ticker}/alert", response_model=WatchlistItemOut)
async def toggle_alert(
    ticker: str,
    payload: WatchlistAlertToggleRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WatchlistItemOut:
    """
    Toggle per-ticker alert on or off.

    When disabled, the live scanner still evaluates the ticker and persists
    the signal, but notifications are suppressed.
    """
    ticker = ticker.upper().strip()
    result = await db.execute(
        select(UserWatchlist).where(
            UserWatchlist.user_id == current_user.id,
            UserWatchlist.ticker == ticker,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker {ticker} not found in your watchlist.",
        )

    row.alert_enabled = payload.enabled
    await db.commit()
    await db.refresh(row)
    logger.info(
        "watchlist: alert %s for %s user_id=%d",
        "enabled" if payload.enabled else "disabled",
        ticker,
        current_user.id,
    )
    return WatchlistItemOut.model_validate(row)
