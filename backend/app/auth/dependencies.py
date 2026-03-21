"""
FastAPI dependencies for authenticated routes.

DEV MODE: Authentication is bypassed. A dev user is auto-created on first
request and returned for all routes. Remove this shortcut before deploying.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

DEV_EMAIL = "dev@nextgenstock.local"


async def _get_or_create_dev_user(db: AsyncSession) -> User:
    """Return the dev user, creating it on first call."""
    result = await db.execute(select(User).where(User.email == DEV_EMAIL))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            email=DEV_EMAIL,
            password_hash="dev-no-auth",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        logger.info("Created dev user: %s (id=%d)", DEV_EMAIL, user.id)
    return user


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """DEV MODE: Always returns the dev user — no JWT required."""
    return await _get_or_create_dev_user(db)


async def optional_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """DEV MODE: Always returns the dev user."""
    return await _get_or_create_dev_user(db)
