from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.congress_trade import CongressCopySession, CongressTrade, CongressCopiedOrder
from app.models.user import User
from app.schemas.congress_trade import (
    CongressCopySessionOut,
    CongressCopySetupRequest,
    CongressTradeOut,
    CongressCopiedOrderOut,
    PoliticianSummary,
)
from app.services.congress_copy_service import setup_congress_copy
from app.services.capitol_trades_service import fetch_politicians

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/congress-copy", tags=["congress-copy"])


@router.get("/politicians", response_model=list[PoliticianSummary])
async def list_politicians(
    current_user: Annotated[User, Depends(get_current_user)],
    limit: int = Query(default=20, ge=1, le=200),
) -> list[PoliticianSummary]:
    """Return up to limit most-active politicians from Capitol Trades."""
    return fetch_politicians(page_size=limit)


@router.post("/setup", response_model=CongressCopySessionOut, status_code=status.HTTP_201_CREATED)
async def setup(
    payload: CongressCopySetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CongressCopySessionOut:
    session = await setup_congress_copy(payload, db, current_user)
    return CongressCopySessionOut.model_validate(session)


@router.get("/sessions", response_model=list[CongressCopySessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[CongressCopySessionOut]:
    result = await db.execute(
        select(CongressCopySession)
        .where(CongressCopySession.user_id == current_user.id)
        .order_by(CongressCopySession.created_at.desc())
        .limit(limit)
    )
    return [CongressCopySessionOut.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=CongressCopySessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CongressCopySessionOut:
    result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return CongressCopySessionOut.model_validate(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions/{session_id}/trades", response_model=list[CongressTradeOut])
async def list_session_trades(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CongressTradeOut]:
    sess = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    if not sess.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    result = await db.execute(
        select(CongressTrade)
        .where(CongressTrade.session_id == session_id)
        .order_by(CongressTrade.fetched_at.desc())
        .limit(limit)
    )
    return [CongressTradeOut.model_validate(t) for t in result.scalars().all()]


@router.get("/sessions/{session_id}/orders", response_model=list[CongressCopiedOrderOut])
async def list_session_orders(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[CongressCopiedOrderOut]:
    sess = await db.execute(
        select(CongressCopySession).where(
            CongressCopySession.id == session_id,
            CongressCopySession.user_id == current_user.id,
        )
    )
    if not sess.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    result = await db.execute(
        select(CongressCopiedOrder)
        .where(CongressCopiedOrder.session_id == session_id)
        .order_by(CongressCopiedOrder.created_at.desc())
        .limit(limit)
    )
    return [CongressCopiedOrderOut.model_validate(o) for o in result.scalars().all()]
