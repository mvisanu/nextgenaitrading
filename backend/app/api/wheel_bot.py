from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.db.session import get_db
from app.models.user import User
from app.models.wheel_bot import WheelBotSession
from app.schemas.wheel_bot import (
    WheelBotSessionResponse,
    WheelBotSetupRequest,
    WheelBotSummaryResponse,
)
from app.services.wheel_bot_service import generate_daily_summary, setup_wheel_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wheel-bot", tags=["wheel-bot"])


@router.post("/setup", response_model=WheelBotSessionResponse, status_code=status.HTTP_201_CREATED)
async def setup_bot(
    payload: WheelBotSetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WheelBotSessionResponse:
    """Create a new Wheel Strategy Bot session."""
    try:
        session = await setup_wheel_bot(payload, db, current_user)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "setup_wheel_bot failed for user %s: %s", current_user.id, exc
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to set up wheel bot. Please try again.",
        ) from exc
    return WheelBotSessionResponse.from_orm_session(session)


@router.get("/sessions", response_model=list[WheelBotSessionResponse])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[WheelBotSessionResponse]:
    """List all wheel bot sessions for the current user (newest first)."""
    result = await db.execute(
        select(WheelBotSession)
        .where(WheelBotSession.user_id == current_user.id)
        .order_by(WheelBotSession.created_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    return [WheelBotSessionResponse.from_orm_session(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=WheelBotSessionResponse)
async def get_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WheelBotSessionResponse:
    """Get a single wheel bot session by ID."""
    result = await db.execute(
        select(WheelBotSession).where(
            WheelBotSession.id == session_id,
            WheelBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return WheelBotSessionResponse.from_orm_session(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Cancel a wheel bot session and any active Alpaca orders."""
    result = await db.execute(
        select(WheelBotSession).where(
            WheelBotSession.id == session_id,
            WheelBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    # Attempt to cancel any active Alpaca order
    if session.active_order_id and session.active_order_id != "dry-run":
        try:
            client = WheelAlpacaClient()
            client.cancel_order(session.active_order_id)
        except Exception as exc:
            logger.warning(
                "wheel_bot: could not cancel Alpaca order %s for session %d: %s",
                session.active_order_id,
                session_id,
                exc,
            )

    session.status = "cancelled"
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/sessions/{session_id}/summary", response_model=WheelBotSummaryResponse)
async def get_session_summary(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WheelBotSummaryResponse:
    """Get daily summary for a wheel bot session."""
    result = await db.execute(
        select(WheelBotSession).where(
            WheelBotSession.id == session_id,
            WheelBotSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    client = WheelAlpacaClient()
    return await generate_daily_summary(session, client, db)
