"""
Password-based authentication endpoints.

Primary login is now email + password, handled natively by Supabase:
  - Sign in:   frontend calls supabase.auth.signInWithPassword() directly.
  - Register:  POST /auth/register (below) creates a CONFIRMED Supabase user
               with a password via the admin API — no confirmation email, no
               magic link, works immediately.
  - Set/change password for a logged-in user: frontend calls
    supabase.auth.updateUser({ password }) directly — no backend needed.

Magic link, PIN, and access-code login remain as fallbacks (see pin_auth.py).
"""
from __future__ import annotations

import logging
import re

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, field_validator

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["password-auth"])

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_MIN_PASSWORD_LEN = 8


class RegisterRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v

    @field_validator("password")
    @classmethod
    def _validate_password(cls, v: str) -> str:
        if len(v) < _MIN_PASSWORD_LEN:
            raise ValueError(f"Password must be at least {_MIN_PASSWORD_LEN} characters")
        return v


class RegisterResponse(BaseModel):
    email: str


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> RegisterResponse:
    """
    Create a new account with email + password.

    Uses the Supabase admin API with email_confirm=true so the account is
    immediately usable — the user signs in with their password right away,
    with no confirmation email required. Public endpoint.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service not configured.",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.supabase_url}/auth/v1/admin/users",
                json={
                    "email": body.email,
                    "password": body.password,
                    "email_confirm": True,
                },
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
    except httpx.RequestError as exc:
        # Supabase unreachable (DNS failure, timeout, connection reset) — e.g. the
        # project is paused. Without this, the transport error escapes as an opaque
        # 500 and the user is told nothing useful.
        logger.error("Supabase admin API unreachable: %s: %s", type(exc).__name__, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The sign-up service is temporarily unavailable. Please try again shortly.",
        ) from exc

    if resp.status_code in (200, 201):
        logger.info("Registered new password user: %s", body.email)
        return RegisterResponse(email=body.email)

    # Duplicate email — GoTrue returns 422 error_code=email_exists (newer)
    # or 400/422 with "already been registered" (older).
    try:
        err = resp.json()
    except ValueError:
        err = {}
    err_code = str(err.get("error_code", ""))
    err_msg = str(err.get("msg", "") or err.get("message", ""))
    if err_code == "email_exists" or "already" in err_msg.lower():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An account with this email already exists. Sign in instead — "
                "if you don't have a password yet, sign in with your PIN, access "
                "code, or a magic link, then set a password in Profile."
            ),
        )
    if err_code == "weak_password" or "password" in err_msg.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet requirements. Use at least 8 characters.",
        )

    logger.error(
        "Supabase admin create user failed: status=%s body=%s",
        resp.status_code,
        resp.text[:400],
    )
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Failed to create account. Please try again.",
    )
