from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VariantBacktestResult(Base):
    __tablename__ = "variant_backtest_results"

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
    mode_name: Mapped[str] = mapped_column(String(50), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    family_name: Mapped[str] = mapped_column(String(50), nullable=False)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    parameter_json: Mapped[str] = mapped_column(Text, nullable=False)  # JSON string
    train_return: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    validation_return: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    test_return: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    validation_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_drawdown: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sharpe_like: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    trade_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    selected_winner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class BacktestTrade(Base):
    __tablename__ = "backtest_trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy_run_id: Mapped[int] = mapped_column(
        ForeignKey("strategy_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    exit_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[float] = mapped_column(Float, nullable=False)
    return_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    leveraged_return_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    holding_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exit_reason: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mode_name: Mapped[str] = mapped_column(String(50), nullable=False)
