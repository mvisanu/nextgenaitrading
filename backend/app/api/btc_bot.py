from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.broker.btc_bot_client import BtcBotClient
from app.core.config import settings
from app.core.security import decrypt_value
from app.db.session import get_db
from app.models.broker import BrokerCredential
from app.models.btc_bot import BtcBotAction, BtcBotSession
from app.models.user import User
from app.schemas.btc_bot import (
    BtcBotActionResponse,
    BtcBotSessionCreateRequest,
    BtcBotSessionDetailResponse,
    BtcBotSessionResponse,
)

router = APIRouter(prefix="/btc-bot", tags=["btc-bot"])


# ── Read endpoints ─────────────────────────────────────────────────────────────


@router.get("/session", response_model=Optional[BtcBotSessionResponse])
async def get_current_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the user's currently active or cooldown session (or null)."""
    result = await db.execute(
        select(BtcBotSession)
        .where(
            BtcBotSession.user_id == user.id,
            BtcBotSession.status.in_(("active", "cooldown")),
        )
        .limit(1)
    )
    return result.scalars().first()


@router.get("/sessions", response_model=list[BtcBotSessionResponse])
async def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List the user's session history, newest first."""
    result = await db.execute(
        select(BtcBotSession)
        .where(BtcBotSession.user_id == user.id)
        .order_by(BtcBotSession.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}", response_model=BtcBotSessionDetailResponse)
async def get_session_detail(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """One session + its full action history."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")

    actions_result = await db.execute(
        select(BtcBotAction)
        .where(BtcBotAction.session_id == session_id)
        .order_by(BtcBotAction.created_at.desc())
    )
    actions = list(actions_result.scalars().all())
    return {"session": session, "actions": actions}


@router.get("/actions", response_model=list[BtcBotActionResponse])
async def list_actions(
    action: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cross-session action history (paginated). Optional ?action=<type> filter."""
    stmt = select(BtcBotAction).where(BtcBotAction.user_id == user.id)
    if action is not None:
        stmt = stmt.where(BtcBotAction.action == action)
    stmt = stmt.order_by(BtcBotAction.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ── Helper ─────────────────────────────────────────────────────────────────────


async def _build_client_for_session(
    session: BtcBotSession, db: AsyncSession, user: User
) -> BtcBotClient:
    """Resolve creds + build BtcBotClient for an existing session row."""
    cred: Optional[BrokerCredential] = None
    if session.credential_id is not None:
        result = await db.execute(
            select(BrokerCredential).where(BrokerCredential.id == session.credential_id)
        )
        cred = result.scalars().first()

    if cred:
        api = decrypt_value(cred.api_key)
        secret = decrypt_value(cred.encrypted_secret_key)
    elif (
        settings.btc_bot_bootstrap_user_email
        and user.email
        and user.email.lower() == settings.btc_bot_bootstrap_user_email.lower()
    ):
        api = settings.visanu_alpaca_api_key
        secret = settings.visanu_alpaca_secret_key
    else:
        api, secret = "", ""

    if not api or not secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No Alpaca credentials available for this session",
        )
    return BtcBotClient(api_key=api, secret_key=secret, paper=True)


# ── Mutation endpoints ─────────────────────────────────────────────────────────


@router.post("/sessions", response_model=BtcBotSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: BtcBotSessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually open a new session. Returns 409 if active/cooldown already exists."""
    existing = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.user_id == user.id,
            BtcBotSession.status.in_(("active", "cooldown")),
        )
    )
    if existing.scalars().first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active or cooldown session already exists",
        )

    initial = body.initial_buy_usd or Decimal(str(settings.btc_bot_initial_usd))
    session = BtcBotSession(
        user_id=user.id,
        status="active",
        initial_buy_usd=initial,
        total_qty=Decimal("0"),
        last_action_at=datetime.now(timezone.utc),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/close", response_model=BtcBotSessionResponse)
async def close_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manual close: market-sell all + status=ended (no cooldown). Only valid when active."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    if session.status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot close session in status={session.status}",
        )

    proceeds = Decimal("0")
    fill_price: Optional[Decimal] = None
    order_id: Optional[str] = None
    qty_sold = session.total_qty or Decimal("0")
    if qty_sold > 0:
        client = await _build_client_for_session(session, db, user)
        fill = await asyncio.to_thread(client.market_sell_all, qty=qty_sold)
        proceeds = fill["filled_qty"] * fill["filled_price"]
        fill_price = fill["filled_price"]
        order_id = fill["order_id"]
        if session.blended_entry_price:
            cost_basis = qty_sold * session.blended_entry_price
            session.realized_pnl = (proceeds - cost_basis).quantize(Decimal("0.01"))

    now = datetime.now(timezone.utc)
    session.status = "ended"
    session.ended_at = now
    session.total_qty = Decimal("0")
    session.last_action_at = now

    db.add(
        BtcBotAction(
            session_id=session.id,
            user_id=user.id,
            action="manual_close",
            btc_price=fill_price,
            qty_delta=-qty_sold if qty_sold else None,
            usd_delta=proceeds if proceeds > 0 else None,
            alpaca_order_id=order_id,
            notes="Manually closed via API",
        )
    )
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/sessions/{session_id}/cancel-cooldown", response_model=BtcBotSessionResponse)
async def cancel_cooldown(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Cancel a session in cooldown. Soft-end (preserves audit history)."""
    result = await db.execute(
        select(BtcBotSession).where(
            BtcBotSession.id == session_id,
            BtcBotSession.user_id == user.id,
        )
    )
    session = result.scalars().first()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    if session.status != "cooldown":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"cannot cancel-cooldown on status={session.status}",
        )

    now = datetime.now(timezone.utc)
    session.status = "ended"
    session.ended_at = now
    session.cooldown_until = None
    session.last_action_at = now
    db.add(
        BtcBotAction(
            session_id=session.id,
            user_id=user.id,
            action="manual_close",
            notes="Cooldown cancelled via API",
        )
    )
    await db.commit()
    await db.refresh(session)
    return session
