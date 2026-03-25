"""
Auth business logic: register, login, refresh, logout.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.models.user import User, UserProfile, UserSession
from app.schemas.auth import RegisterRequest, LoginRequest

logger = logging.getLogger(__name__)

_COOKIE_OPTS: dict = {
    "httponly": True,
    "secure": settings.cookie_secure,
    "samesite": settings.cookie_samesite,
    "path": "/",
}


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        "access_token",
        access_token,
        max_age=settings.access_token_expire_minutes * 60,
        **_COOKIE_OPTS,
    )
    response.set_cookie(
        "refresh_token",
        refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        **_COOKIE_OPTS,
    )


def _clear_auth_cookies(response: Response) -> None:
    # Use set_cookie with Max-Age=0 and matching attributes to ensure browsers
    # and Playwright's APIRequestContext both clear the cookies properly.
    # delete_cookie() may not match original samesite/httponly attrs causing non-deletion.
    response.set_cookie(
        "access_token",
        value="",
        max_age=0,
        expires=0,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )
    response.set_cookie(
        "refresh_token",
        value="",
        max_age=0,
        expires=0,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
    )


async def register(
    payload: RegisterRequest,
    db: AsyncSession,
    response: Response,
    request: Request,
) -> User:
    """Create a new user, issue tokens, and set cookies."""
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()  # get user.id without committing

    # Create default profile
    profile = UserProfile(user_id=user.id)
    db.add(profile)

    # Issue tokens
    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(tz=timezone.utc)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)

    await db.commit()
    await db.refresh(user)

    _set_auth_cookies(response, access_token, refresh_token)
    return user


async def login(
    payload: LoginRequest,
    db: AsyncSession,
    response: Response,
    request: Request,
) -> User:
    """Validate credentials, rotate session, set cookies."""
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    access_token = create_access_token(user.id, user.email)
    refresh_token = create_refresh_token(user.id)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(refresh_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.now(tz=timezone.utc)
        + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    await db.commit()

    _set_auth_cookies(response, access_token, refresh_token)
    return user


async def refresh(
    db: AsyncSession,
    response: Response,
    request: Request,
    refresh_token: str | None,
) -> User:
    """Validate the refresh token hash, rotate it, issue new access token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token.",
    )

    if not refresh_token:
        raise credentials_exception

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exception
        user_id = int(payload["sub"])
    except Exception:
        raise credentials_exception

    token_hash = hash_refresh_token(refresh_token)
    result = await db.execute(
        select(UserSession).where(
            UserSession.user_id == user_id,
            UserSession.refresh_token_hash == token_hash,
            UserSession.revoked_at.is_(None),
        )
    )
    session = result.scalar_one_or_none()
    if not session or session.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
        tz=timezone.utc
    ):
        raise credentials_exception

    # Load user
    user_result = await db.execute(
        select(User).where(User.id == user_id, User.is_active.is_(True))
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise credentials_exception

    # Rotate: revoke old session, create new one
    now = datetime.now(tz=timezone.utc)
    session.revoked_at = now  # type: ignore[assignment]

    new_access_token = create_access_token(user.id, user.email)
    new_refresh_token = create_refresh_token(user.id)

    new_session = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_refresh_token(new_refresh_token),
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
        expires_at=now + timedelta(days=settings.refresh_token_expire_days),
        last_used_at=now,
    )
    db.add(new_session)
    await db.commit()

    _set_auth_cookies(response, new_access_token, new_refresh_token)
    return user


async def logout(
    db: AsyncSession,
    response: Response,
    refresh_token: str | None,
) -> None:
    """Revoke the current session and clear cookies."""
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            user_id = int(payload["sub"])
            token_hash = hash_refresh_token(refresh_token)
            result = await db.execute(
                select(UserSession).where(
                    UserSession.user_id == user_id,
                    UserSession.refresh_token_hash == token_hash,
                    UserSession.revoked_at.is_(None),
                )
            )
            session = result.scalar_one_or_none()
            if session:
                session.revoked_at = datetime.now(tz=timezone.utc)  # type: ignore[assignment]
                await db.commit()
        except Exception:
            pass  # Best-effort revocation

    _clear_auth_cookies(response)
