"""
ORM model for stock theme scores.

No user_id column — theme scores are system-wide and shared across users.
Theme score improves ranking and prioritization but never overrides
price/risk controls.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StockThemeScore(Base):
    __tablename__ = "stock_theme_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    theme_score_total: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Dict of {theme_name: score} e.g. {"ai": 0.85, "semiconductors": 0.60}
    theme_scores_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    narrative_momentum_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sector_tailwind_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    macro_alignment_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
