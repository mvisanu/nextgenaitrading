"""
Auto-Buy API endpoints.

GET    /api/auto-buy/settings           get user's auto-buy settings
PATCH  /api/auto-buy/settings           update settings
GET    /api/auto-buy/decision-log       paginated log of all decisions
POST   /api/auto-buy/dry-run/{ticker}   simulate full pipeline, return result without executing
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.auto_buy import AutoBuyDecisionLog, AutoBuySettings
from app.models.user import User
from app.schemas.auto_buy import (
    AutoBuyDecisionLogOut,
    AutoBuySettingsOut,
    AutoBuySettingsUpdate,
    DryRunRequest,
)
from app.services.auto_buy_engine import evaluate_auto_buy, _get_or_create_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auto-buy", tags=["auto-buy"])


@router.get("/settings", response_model=AutoBuySettingsOut)
async def get_settings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AutoBuySettingsOut:
    """Return the current user's auto-buy settings. Creates defaults if none exist."""
    settings_row = await _get_or_create_settings(current_user.id, db)
    return AutoBuySettingsOut.from_orm(settings_row)


@router.patch("/settings", response_model=AutoBuySettingsOut)
async def update_settings(
    payload: AutoBuySettingsUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AutoBuySettingsOut:
    """
    Update auto-buy settings. Partial update — only provided fields are changed.

    WARNING: Setting enabled=True may result in real orders being placed
    if paper_mode=False. The frontend must present a confirmation dialog before
    calling this endpoint with enabled=True.
    """
    settings_row = await _get_or_create_settings(current_user.id, db)

    # Require explicit confirmation to enable real (non-paper) trading.
    # With Supabase auth (magic links, no passwords), the valid Bearer token
    # already proves the user's identity. The frontend must send
    # confirm_live_trading=True as an explicit opt-in.
    if payload.paper_mode is False:
        if not payload.confirm_live_trading:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Explicit confirmation required to enable real trading mode. "
                       "Send confirm_live_trading=true.",
            )

    if payload.enabled is not None:
        settings_row.enabled = payload.enabled
        if payload.enabled:
            logger.warning(
                "Auto-buy ENABLED for user_id=%d (paper_mode=%s)",
                current_user.id,
                settings_row.paper_mode,
            )
    if payload.paper_mode is not None:
        settings_row.paper_mode = payload.paper_mode
    if payload.confidence_threshold is not None:
        settings_row.confidence_threshold = payload.confidence_threshold
    if payload.max_trade_amount is not None:
        settings_row.max_trade_amount = payload.max_trade_amount
    if payload.max_position_percent is not None:
        settings_row.max_position_percent = payload.max_position_percent
    if payload.max_expected_drawdown is not None:
        settings_row.max_expected_drawdown = payload.max_expected_drawdown
    if payload.allow_near_earnings is not None:
        settings_row.allow_near_earnings = payload.allow_near_earnings
    if payload.allowed_account_ids is not None:
        settings_row.allowed_account_ids_json = payload.allowed_account_ids
    if payload.execution_timeframe is not None:
        settings_row.execution_timeframe = payload.execution_timeframe
    if payload.start_date is not None:
        settings_row.start_date = payload.start_date
    if payload.end_date is not None:
        settings_row.end_date = payload.end_date
    if payload.target_buy_price is not None:
        settings_row.target_buy_price = payload.target_buy_price
    if payload.target_sell_price is not None:
        settings_row.target_sell_price = payload.target_sell_price

    settings_row.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(settings_row)
    return AutoBuySettingsOut.from_orm(settings_row)


@router.get("/decision-log", response_model=list[AutoBuyDecisionLogOut])
async def get_decision_log(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> list[AutoBuyDecisionLogOut]:
    """Return paginated auto-buy decision log for the current user, most recent first."""
    offset = (page - 1) * page_size
    result = await db.execute(
        select(AutoBuyDecisionLog)
        .where(AutoBuyDecisionLog.user_id == current_user.id)
        .order_by(desc(AutoBuyDecisionLog.created_at))
        .offset(offset)
        .limit(page_size)
    )
    logs = result.scalars().all()
    return [AutoBuyDecisionLogOut.from_orm(log) for log in logs]


@router.post(
    "/dry-run/{ticker}",
    response_model=AutoBuyDecisionLogOut,
    status_code=status.HTTP_200_OK,
)
async def dry_run(
    ticker: str,
    payload: DryRunRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AutoBuyDecisionLogOut:
    """
    Simulate the full auto-buy decision pipeline for a ticker.
    Returns a complete breakdown of all nine safeguards with PASSED/FAILED results.
    No order is submitted — this is always a dry run.
    """
    decision = await evaluate_auto_buy(
        ticker=ticker,
        user=current_user,
        db=db,
        dry_run=True,
        credential_id=payload.credential_id,
    )

    # Fetch the persisted log entry
    result = await db.execute(
        select(AutoBuyDecisionLog)
        .where(
            AutoBuyDecisionLog.user_id == current_user.id,
            AutoBuyDecisionLog.ticker == ticker.upper(),
        )
        .order_by(desc(AutoBuyDecisionLog.created_at))
        .limit(1)
    )
    log_entry = result.scalar_one()
    return AutoBuyDecisionLogOut.from_orm(log_entry)
