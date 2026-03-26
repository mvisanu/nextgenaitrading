"""
CRUD and encryption service for BrokerCredential records.
All encryption/decryption uses Fernet (app.core.security).
Decrypted values are never returned via this service — only used internally.
"""
from __future__ import annotations

import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import assert_ownership, decrypt_value, encrypt_value
from app.models.broker import BrokerCredential
from app.models.user import User
from app.schemas.broker import CredentialCreate, CredentialOut, CredentialUpdate

logger = logging.getLogger(__name__)


async def list_credentials(db: AsyncSession, current_user: User) -> list[CredentialOut]:
    result = await db.execute(
        select(BrokerCredential).where(BrokerCredential.user_id == current_user.id)
    )
    creds = result.scalars().all()
    return [CredentialOut.from_orm_masked(c) for c in creds]


async def create_credential(
    payload: CredentialCreate, db: AsyncSession, current_user: User
) -> CredentialOut:
    cred = BrokerCredential(
        user_id=current_user.id,
        provider=payload.provider,
        profile_name=payload.profile_name,
        api_key=encrypt_value(payload.api_key),
        encrypted_secret_key=encrypt_value(payload.secret_key),
        paper_trading=payload.paper_trading,
        base_url=payload.base_url,
    )
    db.add(cred)
    await db.commit()
    await db.refresh(cred)
    return CredentialOut.from_orm_masked(cred)


async def get_credential(
    cred_id: int, db: AsyncSession, current_user: User
) -> BrokerCredential:
    """Load a credential and verify ownership. Returns ORM object for internal use."""
    result = await db.execute(
        select(BrokerCredential).where(BrokerCredential.id == cred_id)
    )
    cred = result.scalar_one_or_none()
    if not cred:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found.")
    assert_ownership(cred.user_id, current_user.id)
    return cred


async def update_credential(
    cred_id: int,
    payload: CredentialUpdate,
    db: AsyncSession,
    current_user: User,
) -> CredentialOut:
    cred = await get_credential(cred_id, db, current_user)

    if payload.profile_name is not None:
        cred.profile_name = payload.profile_name  # type: ignore[assignment]
    if payload.api_key is not None:
        cred.api_key = encrypt_value(payload.api_key)  # type: ignore[assignment]
    if payload.secret_key is not None:
        cred.encrypted_secret_key = encrypt_value(payload.secret_key)  # type: ignore[assignment]
    if payload.paper_trading is not None:
        cred.paper_trading = payload.paper_trading  # type: ignore[assignment]
    if payload.base_url is not None:
        cred.base_url = payload.base_url  # type: ignore[assignment]
    if payload.is_active is not None:
        cred.is_active = payload.is_active  # type: ignore[assignment]

    await db.commit()
    await db.refresh(cred)
    return CredentialOut.from_orm_masked(cred)


async def delete_credential(
    cred_id: int, db: AsyncSession, current_user: User
) -> None:
    cred = await get_credential(cred_id, db, current_user)
    await db.delete(cred)
    await db.commit()


async def test_credential(
    cred_id: int, db: AsyncSession, current_user: User
) -> dict:
    """Call broker.ping() and return {ok: bool}. Never returns decrypted keys."""
    from app.broker.factory import get_broker_client

    cred = await get_credential(cred_id, db, current_user)
    try:
        client = get_broker_client(cred)
        ok = client.ping()
        return {"ok": ok, "detail": None if ok else "Broker did not respond to ping."}
    except Exception as exc:
        logger.warning("Credential test failed for cred_id=%d: %s", cred_id, exc)
        return {"ok": False, "detail": "Connection test failed. Please check your API key and secret."}
