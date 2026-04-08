"""ORM model for the Wheel Strategy bot sessions."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WheelBotSession(Base):
    __tablename__ = "wheel_bot_sessions_wheel"

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

    def __init__(
        self,
        user_id: int,
        symbol: str = "TSLA",
        dry_run: bool = True,
        stage: str = "sell_put",
        active_contract_symbol: Optional[str] = None,
        active_order_id: Optional[str] = None,
        active_premium_received: Optional[float] = None,
        active_strike: Optional[float] = None,
        active_expiry: Optional[str] = None,
        shares_qty: int = 0,
        cost_basis_per_share: Optional[float] = None,
        total_premium_collected: float = 0.0,
        status: str = "active",
        last_action: Optional[str] = None,
        last_summary_json: Optional[str] = None,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self.user_id = user_id
        self.symbol = symbol
        self.dry_run = dry_run
        self.stage = stage
        self.active_contract_symbol = active_contract_symbol
        self.active_order_id = active_order_id
        self.active_premium_received = active_premium_received
        self.active_strike = active_strike
        self.active_expiry = active_expiry
        self.shares_qty = shares_qty
        self.cost_basis_per_share = cost_basis_per_share
        self.total_premium_collected = total_premium_collected
        self.status = status
        self.last_action = last_action
        self.last_summary_json = last_summary_json
