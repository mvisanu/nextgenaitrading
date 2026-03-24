"""
FastAPI dependencies for authenticated routes.

Real JWT authentication: reads the access_token cookie, decodes it,
and loads the corresponding User from the database.
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

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> User:
    """
    Validate the access_token cookie and return the authenticated User.
    Raises HTTP 401 if the token is missing, invalid, or expired.
    """
    if not access_token:
        raise _credentials_exception

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise _credentials_exception
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _credentials_exception

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise _credentials_exception

    return user


async def optional_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    access_token: Annotated[Optional[str], Cookie()] = None,
) -> User | None:
    """
    Like get_current_user but returns None instead of raising on missing/invalid token.
    Used for endpoints that can serve both authenticated and anonymous users.
    """
    if not access_token:
        return None

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            return None
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active.is_(True))
    )
    return result.scalar_one_or_none()
