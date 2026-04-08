from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WheelBotSession(Base):
    __tablename__ = "wheel_bot_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Config
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, default="TSLA")
    dry_run: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Stage state machine: sell_put → assigned → sell_call → called_away
    stage: Mapped[str] = mapped_column(String(20), default="sell_put", nullable=False)

    # Active contract tracking
    active_contract_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    active_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    active_premium_received: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active_strike: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active_expiry: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Share position (assigned when put is exercised)
    shares_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cost_basis_per_share: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Cumulative premium tracking across all cycles
    total_premium_collected: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Session status: "active" | "cancelled" | "completed"
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)

    # Audit / summary
    last_action: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
