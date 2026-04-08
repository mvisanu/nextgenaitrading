from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CreateSessionRequest(BaseModel):
    copy_amount_usd: float = Field(default=300.0, gt=0, description="USD per copied trade")
    dry_run: bool = True
    target_politician_id: Optional[str] = Field(
        default=None,
        description="BioGuideID to pin; null = auto-rank",
    )
    credential_id: Optional[int] = None


class CopyTradingSessionOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    status: str
    dry_run: bool
    copy_amount_usd: float
    target_politician_id: Optional[str]
    target_politician_name: Optional[str]
    activated_at: str
    cancelled_at: Optional[str]
    credential_id: Optional[int]

    @classmethod
    def from_orm(cls, s: object) -> "CopyTradingSessionOut":
        return cls(
            id=s.id,
            status=s.status,
            dry_run=s.dry_run,
            copy_amount_usd=s.copy_amount_usd,
            target_politician_id=s.target_politician_id,
            target_politician_name=s.target_politician_name,
            activated_at=s.activated_at.isoformat() if s.activated_at else "",
            cancelled_at=s.cancelled_at.isoformat() if s.cancelled_at else None,
            credential_id=s.credential_id,
        )


class CopiedTradeOut(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    session_id: int
    trade_id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_type: str
    trade_type: str
    trade_date: Optional[str]
    disclosure_date: Optional[str]
    amount_low: Optional[float]
    amount_high: Optional[float]
    alpaca_order_id: Optional[str]
    alpaca_status: str
    copy_amount_usd: Optional[float]
    dry_run: bool
    created_at: str
    notes: Optional[str]

    @classmethod
    def from_orm(cls, t: object) -> "CopiedTradeOut":
        return cls(
            id=t.id,
            session_id=t.session_id,
            trade_id=t.trade_id,
            politician_id=t.politician_id,
            politician_name=t.politician_name,
            ticker=t.ticker,
            asset_type=t.asset_type,
            trade_type=t.trade_type,
            trade_date=t.trade_date.isoformat() if t.trade_date else None,
            disclosure_date=t.disclosure_date.isoformat() if t.disclosure_date else None,
            amount_low=t.amount_low,
            amount_high=t.amount_high,
            alpaca_order_id=t.alpaca_order_id,
            alpaca_status=t.alpaca_status,
            copy_amount_usd=t.copy_amount_usd,
            dry_run=t.dry_run,
            created_at=t.created_at.isoformat() if t.created_at else "",
            notes=t.notes,
        )


class PoliticianRankingOut(BaseModel):
    politician_id: str
    politician_name: str
    total_trades: int
    buy_trades: int
    win_rate: float
    avg_excess_return: float
    recent_trade_count: int
    score: float
    best_trades: list[str]
