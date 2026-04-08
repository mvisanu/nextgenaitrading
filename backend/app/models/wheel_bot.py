"""ORM model for the Wheel Strategy bot sessions."""
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

    # ── Config ────────────────────────────────────────────────────────────────
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, default="TSLA")
    dry_run: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # ── Stage state machine ───────────────────────────────────────────────────
    stage: Mapped[str] = mapped_column(String(20), nullable=False, default="sell_put")

    # ── Active contract ───────────────────────────────────────────────────────
    active_contract_symbol: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    active_order_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    active_premium_received: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active_strike: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    active_expiry: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # ── Share position ────────────────────────────────────────────────────────
    shares_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost_basis_per_share: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # ── Cumulative tracking ───────────────────────────────────────────────────
    total_premium_collected: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # ── Status ────────────────────────────────────────────────────────────────
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    last_action: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_summary_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
