"""
Auth API routes.

With Supabase handling authentication (magic links), the only backend auth
endpoint we need is GET /auth/me — which validates the Supabase JWT and
returns the current user.

Legacy password-based register/login/refresh/logout routes have been removed;
all auth flows now go through Supabase on the frontend.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    return UserOut.model_validate(current_user)
