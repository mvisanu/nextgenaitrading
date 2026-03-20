from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WinningStrategyArtifact(Base):
    __tablename__ = "winning_strategy_artifacts"

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
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    pine_script_version: Mapped[str] = mapped_column(String(10), nullable=False, default="v5")
    pine_script_code: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    selected_winner: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
