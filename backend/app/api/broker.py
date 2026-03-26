from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.broker import (
    CredentialCreate,
    CredentialOut,
    CredentialUpdate,
    TestResult,
)
from app.services import credential_service

router = APIRouter(prefix="/broker/credentials", tags=["broker"])


@router.get("", response_model=list[CredentialOut])
async def list_credentials(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[CredentialOut]:
    return await credential_service.list_credentials(db, current_user)


@router.post("", response_model=CredentialOut, status_code=status.HTTP_201_CREATED)
async def create_credential(
    payload: CredentialCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CredentialOut:
    return await credential_service.create_credential(payload, db, current_user)


@router.patch("/{cred_id}", response_model=CredentialOut)
async def update_credential(
    cred_id: int,
    payload: CredentialUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CredentialOut:
    return await credential_service.update_credential(cred_id, payload, db, current_user)


@router.delete("/{cred_id}")
async def delete_credential(
    cred_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    await credential_service.delete_credential(cred_id, db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{cred_id}/test", response_model=TestResult)
async def test_credential(
    cred_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TestResult:
    result = await credential_service.test_credential(cred_id, db, current_user)
    return TestResult(**result)
