"""
FastAPI dependencies for authenticated routes.

Supabase JWT authentication: reads the Authorization header (Bearer token),
decodes the Supabase-issued JWT, and loads/creates the corresponding User
from the database.
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import PyJWTError as JWTError
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

_credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated.",
    headers={"WWW-Authenticate": "Bearer"},
)

# HTTPBearer extracts the token from the Authorization: Bearer <token> header
_bearer_scheme = HTTPBearer(auto_error=False)


def _decode_supabase_token(token: str) -> dict:
    """
    Decode and validate a Supabase-issued JWT.
    Uses the Supabase JWT secret for HMAC verification.
    Falls back to the legacy secret_key if supabase_jwt_secret is not configured.
    """
    secret = settings.supabase_jwt_secret or settings.secret_key
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[settings.jwt_algorithm],
            audience="authenticated",
            options={"verify_aud": bool(settings.supabase_jwt_secret)},
        )
        return payload
    except JWTError:
        # If Supabase secret fails, try legacy secret_key as fallback
        if settings.supabase_jwt_secret and settings.secret_key:
            try:
                return jwt.decode(
                    token,
                    settings.secret_key,
                    algorithms=[settings.jwt_algorithm],
                )
            except JWTError:
                pass
        raise


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(_bearer_scheme)
    ] = None,
) -> User:
    """
    Validate the Bearer token and return the authenticated User.
    Raises HTTP 401 if the token is missing, invalid, or expired.

    For Supabase tokens, the `sub` claim contains the Supabase user UUID.
    We look up the user by email from the token, creating one if needed
    (auto-provisioning on first API call after Supabase auth).

    In debug mode, also accepts a `dev_token` cookie as a fallback Bearer token
    (used by Playwright E2E tests to avoid the Supabase magic-link flow).
    """
    # Resolve the token: prefer Authorization header, fall back to dev_token cookie (debug only)
    raw_token: Optional[str] = None
    if credentials:
        raw_token = credentials.credentials
    elif settings.debug:
        raw_token = request.cookies.get("dev_token")

    if not raw_token:
        raise _credentials_exception

    try:
        payload = _decode_supabase_token(raw_token)
        # Supabase tokens have `sub` (user UUID) and `email` in the payload
        user_email = payload.get("email")
        user_sub = payload.get("sub")
        if not user_email and not user_sub:
            raise _credentials_exception
    except (JWTError, KeyError, ValueError):
        raise _credentials_exception

    # Look up user by email (Supabase tokens always include email)
    if user_email:
        result = await db.execute(
            select(User).where(User.email == user_email, User.is_active.is_(True))
        )
        user = result.scalar_one_or_none()

        # Auto-provision user on first API call if they authenticated via Supabase
        if user is None and user_email:
            user = User(
                email=user_email,
                password_hash="supabase_managed",  # No local password — Supabase handles auth
                is_active=True,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            logger.info("Auto-provisioned user %s from Supabase token", user_email)
    else:
        # Fallback: look up by legacy integer ID (for old tokens during migration)
        try:
            user_id = int(user_sub)
            result = await db.execute(
                select(User).where(User.id == user_id, User.is_active.is_(True))
            )
            user = result.scalar_one_or_none()
        except (ValueError, TypeError):
            user = None

    if user is None:
        raise _credentials_exception

    return user


async def optional_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    credentials: Annotated[
        Optional[HTTPAuthorizationCredentials], Depends(_bearer_scheme)
    ] = None,
) -> User | None:
    """
    Like get_current_user but returns None instead of raising on missing/invalid token.
    """
    if not credentials and not (settings.debug and request.cookies.get("dev_token")):
        return None

    try:
        return await get_current_user(request, db, credentials)
    except HTTPException:
        return None
