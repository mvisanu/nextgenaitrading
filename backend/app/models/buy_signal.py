"""
ORM model for buy now signals — V3 audit trail.

Every invocation of the 10-condition gate writes one row regardless of
whether the gate passes or fails.  This gives users full transparency
into which conditions caused suppression and provides a historical record
for review and backtesting.

Rows older than settings.signal_prune_days are pruned by the
prune_old_signals scheduler task.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BuyNowSignal(Base):
    __tablename__ = "buy_now_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # ── Backtest layer ────────────────────────────────────────────────────────
    buy_zone_low: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    buy_zone_high: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    ideal_entry_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    backtest_confidence: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    backtest_win_rate_90d: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    # ── Live technical layer ──────────────────────────────────────────────────
    current_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    price_in_zone: Mapped[bool] = mapped_column(Boolean, nullable=False)
    above_50d_ma: Mapped[bool] = mapped_column(Boolean, nullable=False)
    above_200d_ma: Mapped[bool] = mapped_column(Boolean, nullable=False)
    rsi_value: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    rsi_confirms: Mapped[bool] = mapped_column(Boolean, nullable=False)   # RSI 30–55
    volume_confirms: Mapped[bool] = mapped_column(Boolean, nullable=False) # declining on pullback
    near_support: Mapped[bool] = mapped_column(Boolean, nullable=False)    # within 1.5x ATR
    trend_regime_bullish: Mapped[bool] = mapped_column(Boolean, nullable=False)
    not_near_earnings: Mapped[bool] = mapped_column(Boolean, nullable=False)
    no_duplicate_in_cooldown: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # ── Final decision ────────────────────────────────────────────────────────
    all_conditions_pass: Mapped[bool] = mapped_column(Boolean, nullable=False, index=True)
    # "STRONG_BUY" only when all_conditions_pass=True; "SUPPRESSED" otherwise
    signal_strength: Mapped[str] = mapped_column(String(20), nullable=False)
    # First failing condition name, or None when all pass
    suppressed_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # ── Risk metadata ─────────────────────────────────────────────────────────
    invalidation_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    expected_drawdown: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
