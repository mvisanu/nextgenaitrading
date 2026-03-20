"""
FastAPI dependencies for authenticated routes.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> User:
    """
    Read the access_token cookie, validate the JWT, and return the User ORM object.
    Raises HTTP 401 on any failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not access_token:
        raise credentials_exception

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exception
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        logger.warning("Invalid access token presented")
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception

    return user


async def optional_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> User | None:
    """Like get_current_user but returns None instead of raising 401."""
    if not access_token:
        return None
    try:
        return await get_current_user(db=db, access_token=access_token)
    except HTTPException:
        return None
