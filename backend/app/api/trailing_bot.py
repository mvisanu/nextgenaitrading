from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.trailing_bot import TrailingBotSession
from app.models.user import User
from app.schemas.trailing_bot import TrailingBotSessionOut, TrailingBotSetupRequest
from app.services.trailing_bot_service import setup_trailing_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trailing-bot", tags=["trailing-bot"])


@router.post("/setup", response_model=TrailingBotSessionOut, status_code=status.HTTP_201_CREATED)
async def setup_bot(
    payload: TrailingBotSetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrailingBotSessionOut:
    """Buy shares at market and set up floor + trailing stop + ladder-in rules."""
    session = await setup_trailing_bot(payload, db, current_user)
    return TrailingBotSessionOut.from_orm_session(session)


@router.get("/sessions", response_model=list[TrailingBotSessionOut])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[TrailingBotSessionOut]:
    result = await db.execute(
        select(TrailingBotSession)
        .where(TrailingBotSession.user_id == current_user.id)
        .order_by(TrailingBotSession.created_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [TrailingBotSessionOut.from_orm_session(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=TrailingBotSessionOut)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TrailingBotSessionOut:
    result = await db.execute(
        select(TrailingBotSession).where(
            TrailingBotSession.id == session_id,
            TrailingBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return TrailingBotSessionOut.from_orm_session(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(TrailingBotSession).where(
            TrailingBotSession.id == session_id,
            TrailingBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    session.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
