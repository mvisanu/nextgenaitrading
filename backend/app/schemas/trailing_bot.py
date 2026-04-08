# backend/app/schemas/trailing_bot.py
from __future__ import annotations

import json
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class LadderRule(BaseModel):
    drop_pct: float = Field(..., gt=0, le=90, description="% drop from entry price to trigger this level")
    buy_amount_usd: float = Field(..., gt=0, description="USD notional to buy at this level")


class TrailingBotSetupRequest(BaseModel):
    credential_id: int
    symbol: str = Field(..., min_length=1, max_length=20)
    buy_amount_usd: float = Field(..., gt=0, description="USD notional for initial market buy")
    floor_pct: float = Field(default=10.0, gt=0, le=50, description="Hard stop: sell all if price drops this % from entry")
    ladder_rules: list[LadderRule] = Field(default_factory=list, max_length=5)
    dry_run: bool = True

    @field_validator("symbol")
    @classmethod
    def normalise_symbol(cls, v: str) -> str:
        return v.strip().upper()


class LadderRuleOut(BaseModel):
    price: float
    qty: float
    drop_pct: float = 0.0
    buy_amount_usd: float = 0.0
    order_id: str
    filled: bool


class TrailingBotSessionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    symbol: str
    buy_amount_usd: float
    initial_qty: float
    entry_price: Optional[float]
    initial_order_id: Optional[str]
    stop_order_id: Optional[str]
    floor_price: float
    floor_pct: float
    trailing_trigger_pct: float
    trailing_trail_pct: float
    trailing_step_pct: float
    trailing_active: bool
    current_floor: Optional[float]
    ladder_rules: list[LadderRuleOut]
    dry_run: bool
    status: str
    created_at: str

    @classmethod
    def from_orm_session(cls, s: object) -> "TrailingBotSessionOut":
        try:
            ladder_rules_raw = json.loads(getattr(s, "ladder_rules_json", None) or "[]")
        except json.JSONDecodeError:
            ladder_rules_raw = []
        buy_amount_usd = getattr(s, "buy_amount_usd", None) or 0.0
        floor_pct = getattr(s, "floor_pct", None) or 10.0
        return cls(
            id=s.id,
            symbol=s.symbol,
            buy_amount_usd=buy_amount_usd,
            initial_qty=s.initial_qty,
            entry_price=s.entry_price,
            initial_order_id=s.initial_order_id,
            stop_order_id=s.stop_order_id,
            floor_price=s.floor_price,
            floor_pct=floor_pct,
            trailing_trigger_pct=s.trailing_trigger_pct,
            trailing_trail_pct=s.trailing_trail_pct,
            trailing_step_pct=s.trailing_step_pct,
            trailing_active=s.trailing_active,
            current_floor=s.current_floor,
            ladder_rules=[LadderRuleOut(**r) for r in ladder_rules_raw],
            dry_run=s.dry_run,
            status=s.status,
            created_at=s.created_at.isoformat() if s.created_at else "",
        )
