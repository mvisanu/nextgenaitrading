from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    user = await service.register(payload, db, response, request)
    return TokenResponse(message="Registered", user_id=user.id, email=user.email)


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    user = await service.login(payload, db, response, request)
    return TokenResponse(message="Authenticated", user_id=user.id, email=user.email)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie()] = None,
) -> TokenResponse:
    user = await service.refresh(db, response, request, refresh_token)
    return TokenResponse(message="Refreshed", user_id=user.id, email=user.email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    refresh_token: Annotated[Optional[str], Cookie()] = None,
) -> None:
    await service.logout(db, response, refresh_token)


@router.get("/me", response_model=UserOut)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    return UserOut.model_validate(current_user)
