"""
ORM model for stock buy zone snapshots.

user_id is nullable — a NULL user_id indicates a system-wide snapshot
that may be shared across users to avoid redundant computation.
A per-user force-recalculate always produces a user_id-scoped row.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StockBuyZoneSnapshot(Base):
    __tablename__ = "stock_buy_zone_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    current_price: Mapped[float] = mapped_column(Float, nullable=False)
    buy_zone_low: Mapped[float] = mapped_column(Float, nullable=False)
    buy_zone_high: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    entry_quality_score: Mapped[float] = mapped_column(Float, nullable=False)
    expected_return_30d: Mapped[float] = mapped_column(Float, nullable=False)
    expected_return_90d: Mapped[float] = mapped_column(Float, nullable=False)
    expected_drawdown: Mapped[float] = mapped_column(Float, nullable=False)
    positive_outcome_rate_30d: Mapped[float] = mapped_column(Float, nullable=False)
    positive_outcome_rate_90d: Mapped[float] = mapped_column(Float, nullable=False)
    invalidation_price: Mapped[float] = mapped_column(Float, nullable=False)
    horizon_days: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    explanation_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    # Raw feature inputs kept for post-hoc auditability — never returned in API responses
    feature_payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v2.0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
