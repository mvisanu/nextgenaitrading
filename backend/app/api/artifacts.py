from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.core.security import assert_ownership
from app.db.session import get_db
from app.models.artifact import WinningStrategyArtifact
from app.models.user import User
from app.schemas.artifact import ArtifactOut, PineScriptOut

router = APIRouter(prefix="/artifacts", tags=["artifacts"])


async def _get_artifact(
    artifact_id: int, db: AsyncSession, current_user: User
) -> WinningStrategyArtifact:
    result = await db.execute(
        select(WinningStrategyArtifact).where(WinningStrategyArtifact.id == artifact_id)
    )
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found."
        )
    assert_ownership(artifact.user_id, current_user.id)
    return artifact


@router.get("", response_model=list[ArtifactOut])
async def list_artifacts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = 50,
) -> list[ArtifactOut]:
    result = await db.execute(
        select(WinningStrategyArtifact)
        .where(WinningStrategyArtifact.user_id == current_user.id)
        .order_by(WinningStrategyArtifact.created_at.desc())
        .limit(limit)
    )
    artifacts = result.scalars().all()
    return [ArtifactOut.model_validate(a) for a in artifacts]


@router.get("/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ArtifactOut:
    artifact = await _get_artifact(artifact_id, db, current_user)
    return ArtifactOut.model_validate(artifact)


@router.get("/{artifact_id}/pine-script", response_model=PineScriptOut)
async def get_pine_script(
    artifact_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> PineScriptOut:
    """Return the raw Pine Script v5 code for an artifact."""
    artifact = await _get_artifact(artifact_id, db, current_user)
    return PineScriptOut(
        id=artifact.id,
        variant_name=artifact.variant_name,
        symbol=artifact.symbol,
        pine_script_version=artifact.pine_script_version,
        pine_script_code=artifact.pine_script_code,
    )
