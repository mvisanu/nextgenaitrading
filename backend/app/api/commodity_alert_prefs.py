"""
API endpoints for commodity alert preferences.

GET  /commodity-alerts/prefs     — get current user's prefs (creates defaults if missing)
PUT  /commodity-alerts/prefs     — update prefs
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.commodity_alert_prefs import CommodityAlertPrefs
from app.models.user import User
from app.schemas.commodity_alert_prefs import CommodityAlertPrefsOut, CommodityAlertPrefsUpdate

router = APIRouter(prefix="/commodity-alerts", tags=["commodity-alerts"])


async def _get_or_create_prefs(user_id: int, db: AsyncSession) -> CommodityAlertPrefs:
    result = await db.execute(
        select(CommodityAlertPrefs).where(CommodityAlertPrefs.user_id == user_id)
    )
    prefs = result.scalar_one_or_none()
    if prefs is None:
        prefs = CommodityAlertPrefs(
            user_id=user_id,
            symbols=["XAUUSD"],
        )
        db.add(prefs)
        await db.commit()
        await db.refresh(prefs)
    return prefs


@router.get("/prefs", response_model=CommodityAlertPrefsOut)
async def get_prefs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommodityAlertPrefs:
    return await _get_or_create_prefs(current_user.id, db)


@router.patch("/prefs", response_model=CommodityAlertPrefsOut)
async def update_prefs(
    body: CommodityAlertPrefsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CommodityAlertPrefs:
    prefs = await _get_or_create_prefs(current_user.id, db)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prefs, field, value)

    await db.commit()
    await db.refresh(prefs)
    return prefs
