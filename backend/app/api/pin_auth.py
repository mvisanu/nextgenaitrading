"""
PIN-based authentication endpoints.

Flow:
  1. User registers once via magic link (Supabase OTP email).
  2. After first login they set a 4-digit PIN at /pin-setup.
  3. Future logins: POST /auth/pin-login (email + pin)
     → backend verifies PIN → calls Supabase admin generate_link
     → returns token_hash → frontend exchanges for a full session.

Rate limiting: 5 wrong attempts → 15-minute lockout stored in user_pins.
"""
from __future__ import annotations

import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.user_pin import UserPin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["pin-auth"])

_MAX_ATTEMPTS = 5
_LOCKOUT_MINUTES = 15


# ── Request / Response schemas ────────────────────────────────────────────────

class PinLoginRequest(BaseModel):
    email: str
    pin: str

    @field_validator("pin")
    @classmethod
    def _validate_pin(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("PIN must be exactly 4 digits")
        return v


class PinLoginResponse(BaseModel):
    token_hash: str


class SetPinRequest(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def _validate_pin(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 4:
            raise ValueError("PIN must be exactly 4 digits")
        return v


class HasPinResponse(BaseModel):
    has_pin: bool


class CodeLoginRequest(BaseModel):
    email: str
    code: str


class CodeLoginResponse(BaseModel):
    token_hash: str


# ── Supabase admin helper ─────────────────────────────────────────────────────

async def _supabase_generate_token(email: str) -> str:
    """
    Call Supabase admin generate_link for the given email and return
    the hashed_token the frontend can pass to supabase.auth.verifyOtp().
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service not configured.",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.supabase_url}/auth/v1/admin/generate_link",
                json={"type": "magiclink", "email": email},
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
    except httpx.RequestError as exc:
        # Supabase unreachable (DNS failure, timeout, connection reset) — e.g. the
        # project is paused. Surface it as a clear 503 rather than an opaque 500.
        logger.error("Supabase admin API unreachable: %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The sign-in service is temporarily unavailable. Please try again shortly.",
        ) from exc

    if resp.status_code != 200:
        logger.error(
            "Supabase generate_link failed: status=%s body=%s",
            resp.status_code,
            resp.text[:400],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create session. Please try again.",
        )

    data = resp.json()
    # Support both old (top-level) and new (nested under 'properties') formats
    token_hash = (
        data.get("properties", {}).get("hashed_token")
        or data.get("hashed_token")
    )
    if not token_hash:
        logger.error("Supabase generate_link missing hashed_token: %s", list(data.keys()))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create session. Please try again.",
        )

    return token_hash


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/pin-login", response_model=PinLoginResponse)
async def pin_login(
    body: PinLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PinLoginResponse:
    """
    Verify email + 4-digit PIN. On success, returns a Supabase token_hash
    the client exchanges for a session via supabase.auth.verifyOtp().
    This endpoint is public (no Bearer token required).
    """
    _generic_err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or PIN.",
    )

    # Find active user
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise _generic_err

    # Find PIN record
    pin_result = await db.execute(
        select(UserPin).where(UserPin.user_id == user.id)
    )
    user_pin = pin_result.scalar_one_or_none()
    if user_pin is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No PIN set for this account. Please sign in via magic link first.",
        )

    # Lockout check
    now = datetime.now(timezone.utc)
    if user_pin.locked_until and user_pin.locked_until > now:
        wait = int((user_pin.locked_until - now).total_seconds() / 60) + 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again in {wait} minute(s).",
        )

    # Verify PIN
    correct = bcrypt.checkpw(body.pin.encode(), user_pin.pin_hash.encode())
    if not correct:
        user_pin.attempt_count = (user_pin.attempt_count or 0) + 1
        if user_pin.attempt_count >= _MAX_ATTEMPTS:
            user_pin.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)
            logger.warning("PIN locked for user_id=%s (too many failed attempts)", user.id)
        await db.commit()
        raise _generic_err

    # Reset attempt counter on success
    user_pin.attempt_count = 0
    user_pin.locked_until = None
    await db.commit()

    token_hash = await _supabase_generate_token(body.email)
    return PinLoginResponse(token_hash=token_hash)


@router.post("/code-login", response_model=CodeLoginResponse)
async def code_login(
    body: CodeLoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CodeLoginResponse:
    """
    Bypass login: email + a shared access code from BYPASS_LOGIN_CODE (.env).
    On success, returns a Supabase token_hash the client exchanges for a
    session via supabase.auth.verifyOtp() — same as PIN login, but gated on a
    single shared secret instead of a per-user PIN.

    Disabled (404) unless BYPASS_LOGIN_CODE is configured. Public — no Bearer
    token required. The shared secret must be kept private; anyone with it can
    sign in as any existing, active user by email.
    """
    configured = settings.bypass_login_code
    if not configured:
        # Feature disabled — behave as if the route does not exist.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")

    _generic_err = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or code.",
    )

    # Constant-time comparison to avoid leaking the code via timing.
    if not hmac.compare_digest(body.code.strip(), configured):
        logger.warning("Bypass code-login failed for email=%s", body.email)
        raise _generic_err

    # Only allow sign-in for an existing, active user.
    result = await db.execute(
        select(User).where(User.email == body.email, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise _generic_err

    logger.info("Bypass code-login success for user_id=%s", user.id)
    token_hash = await _supabase_generate_token(body.email)
    return CodeLoginResponse(token_hash=token_hash)


@router.post("/set-pin")
async def set_pin(
    body: SetPinRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Set or replace the authenticated user's 4-digit PIN."""
    pin_hash = bcrypt.hashpw(body.pin.encode(), bcrypt.gensalt()).decode()

    result = await db.execute(
        select(UserPin).where(UserPin.user_id == current_user.id)
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.pin_hash = pin_hash
        existing.attempt_count = 0
        existing.locked_until = None
    else:
        db.add(UserPin(user_id=current_user.id, pin_hash=pin_hash))

    await db.commit()
    logger.info("PIN set/updated for user_id=%s", current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/has-pin", response_model=HasPinResponse)
async def has_pin(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> HasPinResponse:
    """Return whether the authenticated user has a PIN configured."""
    result = await db.execute(
        select(UserPin.id).where(UserPin.user_id == current_user.id)
    )
    return HasPinResponse(has_pin=result.scalar_one_or_none() is not None)
