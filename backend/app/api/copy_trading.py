# backend/app/api/copy_trading.py
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.copy_trading import CopiedPoliticianTrade, CopyTradingSession
from app.models.user import User
from app.schemas.copy_trading import (
    CopiedTradeOut,
    CopyTradingSessionOut,
    CreateSessionRequest,
    PoliticianRankingOut,
)
from app.services.copy_trading_service import create_session
from app.services.politician_ranker_service import rank_politicians
from app.services.politician_scraper_service import fetch_congressional_trades

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copy-trading", tags=["copy-trading"])

# In-process rankings cache — 15-min TTL
_RANKINGS_TTL = 15 * 60
_rankings_cache: list[PoliticianRankingOut] = []
_rankings_cache_at: float = 0.0


@router.get("/rankings", response_model=list[PoliticianRankingOut])
async def get_rankings(
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=10, ge=1, le=50),
) -> list[PoliticianRankingOut]:
    """Return platform-wide politician rankings (15-min cached)."""
    global _rankings_cache, _rankings_cache_at
    now = time.monotonic()
    if not _rankings_cache or (now - _rankings_cache_at) > _RANKINGS_TTL:
        all_trades = await fetch_congressional_trades()
        scores = rank_politicians(all_trades, lookback_days=90, min_trades=5, top_n=50)
        _rankings_cache = [
            PoliticianRankingOut(
                politician_id=s.politician_id,
                politician_name=s.politician_name,
                total_trades=s.total_trades,
                buy_trades=s.buy_trades,
                win_rate=round(s.win_rate, 1),
                avg_excess_return=round(s.avg_excess_return, 2),
                recent_trade_count=s.recent_trade_count,
                score=round(s.score, 1),
                best_trades=s.best_trades,
            )
            for s in scores
        ]
        _rankings_cache_at = now
    return _rankings_cache[:limit]


@router.post("/sessions", response_model=CopyTradingSessionOut, status_code=status.HTTP_201_CREATED)
async def create_copy_session(
    payload: CreateSessionRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CopyTradingSessionOut:
    """Create and activate a copy-trading session."""
    session = await create_session(payload, db, current_user)
    return CopyTradingSessionOut.from_orm(session)


@router.get("/sessions", response_model=list[CopyTradingSessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopyTradingSessionOut]:
    result = await db.execute(
        select(CopyTradingSession)
        .where(CopyTradingSession.user_id == current_user.id)
        .order_by(CopyTradingSession.activated_at.desc())
        .limit(limit)
    )
    return [CopyTradingSessionOut.from_orm(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=CopyTradingSessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CopyTradingSessionOut:
    result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return CopyTradingSessionOut.from_orm(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    session.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions/{session_id}/trades", response_model=list[CopiedTradeOut])
async def get_session_trades(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopiedTradeOut]:
    sess_result = await db.execute(
        select(CopyTradingSession).where(
            CopyTradingSession.id == session_id,
            CopyTradingSession.user_id == current_user.id,
        )
    )
    if not sess_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    result = await db.execute(
        select(CopiedPoliticianTrade)
        .where(
            CopiedPoliticianTrade.session_id == session_id,
            CopiedPoliticianTrade.user_id == current_user.id,
        )
        .order_by(CopiedPoliticianTrade.created_at.desc())
        .limit(limit)
    )
    return [CopiedTradeOut.from_orm(t) for t in result.scalars().all()]


@router.get("/trades", response_model=list[CopiedTradeOut])
async def get_all_trades(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CopiedTradeOut]:
    result = await db.execute(
        select(CopiedPoliticianTrade)
        .where(
            CopiedPoliticianTrade.user_id == current_user.id,
            CopiedPoliticianTrade.alpaca_status != "pre_existing",
        )
        .order_by(CopiedPoliticianTrade.created_at.desc())
        .limit(limit)
    )
    return [CopiedTradeOut.from_orm(t) for t in result.scalars().all()]
