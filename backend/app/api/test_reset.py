"""
Test reset endpoint — only available when DEBUG=true.

POST /test/reset
    Clears all data for the fixed E2E test user accounts (USER_A and USER_B).
    Deletes users entirely so tests always start from a clean slate.
    Also clears the in-memory login-attempt lockout tracker.

This endpoint must never be exposed in production (DEBUG=false).
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test", tags=["test"])

# E2E test account emails — must match tests/e2e/fixtures/test-data.ts
_TEST_EMAILS = {
    "e2e-user-a@nextgenstock.io",
    "e2e-user-b@nextgenstock.io",
}


def _require_debug() -> None:
    if not settings.debug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Test utilities are only available in debug mode.",
        )


@router.post("/reset", status_code=200)
async def reset_test_data(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """
    Delete all data for the fixed E2E test users (USER_A, USER_B).
    The users themselves are deleted so every test run starts fresh.
    Also clears the in-memory login lockout state for these accounts.
    """
    _require_debug()

    from app.models.user import User, UserProfile, UserSession
    from app.auth.service import _failed_attempts  # in-memory tracker

    # Clear in-memory lockout state for test accounts
    for email in _TEST_EMAILS:
        _failed_attempts.pop(email, None)

    # Find test users
    result = await db.execute(
        select(User).where(User.email.in_(_TEST_EMAILS))
    )
    users = result.scalars().all()
    user_ids = [u.id for u in users]

    deleted_users = len(user_ids)

    if user_ids:
        # Delete all resource data via ORM cascade or explicit deletes.
        # The FK structure uses ON DELETE CASCADE on most tables, so deleting
        # the User row triggers a cascade.  For tables without CASCADE we delete
        # explicitly first.

        # Tables with NO CASCADE (system-wide, no user_id):
        #   StockBuyZoneSnapshot, StockThemeScore — not user-scoped, leave them.

        # Delete users — cascades: UserProfile, UserSession, BrokerCredential,
        # StrategyRun (→ TradeDecision, BrokerOrder, PositionSnapshot, etc.),
        # WatchlistIdea (→ WatchlistIdeaTicker), PriceAlertRule, AutoBuySettings,
        # AutoBuyDecisionLog, UserWatchlist, BuyNowSignal, GeneratedIdea.
        await db.execute(delete(User).where(User.id.in_(user_ids)))
        await db.commit()
        logger.info(
            "test/reset: deleted %d test user(s): %s",
            deleted_users,
            list(_TEST_EMAILS),
        )
    else:
        logger.info("test/reset: no test users found — nothing to delete")

    return {
        "ok": True,
        "deleted_users": deleted_users,
        "emails_cleared": list(_TEST_EMAILS),
    }


@router.post("/token", status_code=200)
async def create_test_token(
    db: Annotated[AsyncSession, Depends(get_db)],
    body: dict,
) -> dict:
    """
    Create a valid JWT for E2E testing. Auto-provisions the user if needed.
    Only available when DEBUG=true. Accepts { "email": "..." }.

    Returns { "access_token": "...", "user_id": ... }
    """
    _require_debug()

    import jwt as pyjwt
    from datetime import datetime, timedelta, timezone
    from app.models.user import User

    email = body.get("email")
    if not email:
        raise HTTPException(status_code=422, detail="email is required")

    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(email=email, password_hash="e2e_test_managed", is_active=True)
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # Sign JWT with the same secret the backend accepts
    secret = settings.supabase_jwt_secret or settings.secret_key
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "aud": "authenticated",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
    }
    token = pyjwt.encode(payload, secret, algorithm=settings.jwt_algorithm)

    return {"access_token": token, "user_id": user.id, "email": user.email}
