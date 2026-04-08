"""Wheel Strategy Bot API endpoints.

Routes (all under /api/v1/wheel-bot):
  POST   /setup             → create session, attempt first put sale (201)
  GET    /sessions          → list user's sessions newest-first
  GET    /sessions/{id}     → single session detail
  DELETE /sessions/{id}     → cancel session (204)
  GET    /sessions/{id}/summary → latest daily summary
"""
from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.broker.wheel_alpaca_client import WheelAlpacaClient
from app.db.session import get_db
from app.models.user import User
from app.models.wheel_bot import WheelBotSession
from app.schemas.wheel_bot import WheelBotSetupRequest, WheelBotSessionResponse, WheelBotSummaryResponse
from app.services.wheel_bot_service import check_and_act, generate_daily_summary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wheel-bot", tags=["wheel-bot"])


def _assert_ownership(session: WheelBotSession, user: User) -> None:
    if session.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")


def _get_client() -> WheelAlpacaClient:
    return WheelAlpacaClient()


@router.post("/setup", response_model=WheelBotSessionResponse, status_code=201)
async def setup_wheel_bot(
    payload: WheelBotSetupRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WheelBotSessionResponse:
    """Create a Wheel Bot session and attempt to sell the first put."""
    session = WheelBotSession(
        user_id=current_user.id,
        symbol=payload.symbol,
        dry_run=payload.dry_run,
        stage="sell_put",
        shares_qty=0,
        total_premium_collected=0.0,
        status="active",
    )
    db.add(session)
    await db.flush()

    try:
        client = _get_client()
        await check_and_act(session, client, db)
    except Exception as exc:
        logger.error("wheel_bot setup error for user=%d: %s", current_user.id, exc)
        session.last_action = f"Setup error: {exc}"

    await db.commit()
    await db.refresh(session)
    return WheelBotSessionResponse.from_orm_session(session)


@router.get("/sessions", response_model=list[WheelBotSessionResponse])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=50, ge=1, le=200),
) -> list[WheelBotSessionResponse]:
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
    result = await db.execute(
        select(WheelBotSession).where(WheelBotSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_ownership(session, current_user)
    return WheelBotSessionResponse.from_orm_session(session)


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    result = await db.execute(
        select(WheelBotSession).where(WheelBotSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_ownership(session, current_user)
    session.status = "cancelled"
    await db.commit()
    return Response(status_code=204)


@router.get("/sessions/{session_id}/summary", response_model=WheelBotSummaryResponse)
async def get_session_summary(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WheelBotSummaryResponse:
    result = await db.execute(
        select(WheelBotSession).where(WheelBotSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    _assert_ownership(session, current_user)

    if session.last_summary_json:
        try:
            data = json.loads(session.last_summary_json)
            return WheelBotSummaryResponse(**data)
        except Exception:
            pass

    try:
        client = _get_client()
        summary = await generate_daily_summary(session, client)
        return WheelBotSummaryResponse(**summary)
    except Exception as exc:
        logger.error("wheel_bot summary error session=%d: %s", session_id, exc)
        raise HTTPException(status_code=502, detail="Could not fetch summary from broker")
