from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User, UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


async def _get_or_create_profile(user: User, db: AsyncSession) -> UserProfile:
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


@router.get("", response_model=ProfileOut)
async def get_profile(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    profile = await _get_or_create_profile(current_user, db)
    return ProfileOut.model_validate(profile)


@router.patch("", response_model=ProfileOut)
async def update_profile(
    payload: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ProfileOut:
    profile = await _get_or_create_profile(current_user, db)

    if payload.display_name is not None:
        profile.display_name = payload.display_name  # type: ignore[assignment]
    if payload.timezone is not None:
        profile.timezone = payload.timezone  # type: ignore[assignment]
    if payload.default_symbol is not None:
        profile.default_symbol = payload.default_symbol.strip().upper()  # type: ignore[assignment]
    if payload.default_mode is not None:
        profile.default_mode = payload.default_mode  # type: ignore[assignment]

    await db.commit()
    await db.refresh(profile)
    return ProfileOut.model_validate(profile)
