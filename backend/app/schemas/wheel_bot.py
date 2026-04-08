from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator


class WheelBotSetupRequest(BaseModel):
    symbol: str = Field(default="TSLA", min_length=1, max_length=20)
    dry_run: bool = True
    credential_id: Optional[int] = None

    @field_validator("symbol")
    @classmethod
    def normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


class WheelBotSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    user_id: int
    symbol: str
    dry_run: bool
    credential_id: Optional[int]
    stage: str
    active_contract_symbol: Optional[str]
    active_order_id: Optional[str]
    active_premium_received: Optional[float]
    active_strike: Optional[float]
    active_expiry: Optional[str]
    shares_qty: int
    cost_basis_per_share: Optional[float]
    total_premium_collected: float
    status: str
    last_action: Optional[str]
    created_at: str
    updated_at: Optional[str]

    @classmethod
    def from_orm_session(cls, s: object) -> "WheelBotSessionResponse":
        created_at = getattr(s, "created_at", None)
        updated_at = getattr(s, "updated_at", None)
        return cls(
            id=s.id,
            user_id=s.user_id,
            symbol=s.symbol,
            dry_run=s.dry_run,
            credential_id=getattr(s, "credential_id", None),
            stage=s.stage,
            active_contract_symbol=s.active_contract_symbol,
            active_order_id=s.active_order_id,
            active_premium_received=s.active_premium_received,
            active_strike=s.active_strike,
            active_expiry=s.active_expiry,
            shares_qty=s.shares_qty,
            cost_basis_per_share=s.cost_basis_per_share,
            total_premium_collected=s.total_premium_collected,
            status=s.status,
            last_action=s.last_action,
            created_at=created_at.isoformat() if created_at else "",
            updated_at=updated_at.isoformat() if updated_at else None,
        )


class WheelBotSummaryResponse(BaseModel):
    symbol: str
    stage: str
    total_premium_collected: float
    shares_qty: int
    cost_basis_per_share: Optional[float]
    last_action: Optional[str]
    summary: Optional[str]
