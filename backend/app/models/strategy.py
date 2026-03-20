from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class StrategyRun(Base):
    __tablename__ = "strategy_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    run_type: Mapped[str] = mapped_column(String(30), nullable=False)  # "backtest" | "signal" | "live"
    mode_name: Mapped[str] = mapped_column(String(50), nullable=False)
    strategy_family: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False, default="1d")
    leverage: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    min_confirmations: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    trailing_stop_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # HMM state info
    bull_state_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    bear_state_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_state_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    current_regime: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    current_signal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    confirmation_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Optimizer winner info
    selected_variant_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    selected_variant_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selected_variant_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    trade_decisions: Mapped[list["TradeDecision"]] = relationship(
        "TradeDecision", back_populates="strategy_run", cascade="all, delete-orphan"
    )


class TradeDecision(Base):
    __tablename__ = "trade_decisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_run_id: Mapped[int] = mapped_column(
        ForeignKey("strategy_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    timestamp_of_bar: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    regime: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    state_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    signal: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    confirmation_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    entry_eligible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    cooldown_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reason_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    strategy_run: Mapped["StrategyRun"] = relationship(
        "StrategyRun", back_populates="trade_decisions"
    )
