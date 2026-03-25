"""
Price Alert Rules API.

GET    /api/alerts              list user's alert rules
POST   /api/alerts              create new alert rule
PATCH  /api/alerts/{id}         update rule (enable/disable, threshold)
DELETE /api/alerts/{id}         remove rule

All endpoints scoped by current_user.id. Returns 403 on ownership mismatch.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.security import assert_ownership
from app.db.session import get_db
from app.models.alert import PriceAlertRule
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertOut, AlertUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/alerts", tags=["alerts"])


async def _get_rule(rule_id: int, db: AsyncSession, current_user: User) -> PriceAlertRule:
    result = await db.execute(
        select(PriceAlertRule).where(PriceAlertRule.id == rule_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found.")
    assert_ownership(rule.user_id, current_user.id)
    return rule


@router.get("", response_model=list[AlertOut])
async def list_alerts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[AlertOut]:
    """List all alert rules for the current user, most recent first."""
    result = await db.execute(
        select(PriceAlertRule)
        .where(PriceAlertRule.user_id == current_user.id)
        .order_by(PriceAlertRule.created_at.desc())
    )
    rules = result.scalars().all()
    return [AlertOut.from_orm(r) for r in rules]


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
async def create_alert(
    payload: AlertCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertOut:
    """Create a new price alert rule for the authenticated user."""
    rule = PriceAlertRule(
        user_id=current_user.id,
        ticker=payload.ticker.upper(),
        alert_type=payload.alert_type,
        threshold_json=payload.threshold_json,
        cooldown_minutes=payload.cooldown_minutes,
        market_hours_only=payload.market_hours_only,
        enabled=True,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    logger.info("Alert rule created: id=%d user_id=%d ticker=%s type=%s",
                rule.id, current_user.id, rule.ticker, rule.alert_type)
    return AlertOut.from_orm(rule)


@router.get("/{rule_id}", response_model=AlertOut)
async def get_alert(
    rule_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertOut:
    """Get a single alert rule by ID. Returns 404 if not found, 403 if not owned."""
    rule = await _get_rule(rule_id, db, current_user)
    return AlertOut.from_orm(rule)


@router.patch("/{rule_id}", response_model=AlertOut)
async def update_alert(
    rule_id: int,
    payload: AlertUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> AlertOut:
    """Update an alert rule. Partial update — only provided fields are changed."""
    rule = await _get_rule(rule_id, db, current_user)

    if payload.enabled is not None:
        rule.enabled = payload.enabled
    if payload.cooldown_minutes is not None:
        rule.cooldown_minutes = payload.cooldown_minutes
    if payload.market_hours_only is not None:
        rule.market_hours_only = payload.market_hours_only
    if payload.threshold_json is not None:
        rule.threshold_json = payload.threshold_json

    rule.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(rule)
    return AlertOut.from_orm(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    rule_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Permanently delete an alert rule."""
    rule = await _get_rule(rule_id, db, current_user)
    await db.delete(rule)
    await db.commit()
    logger.info("Alert rule deleted: id=%d user_id=%d", rule_id, current_user.id)
