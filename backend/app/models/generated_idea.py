"""
ORM model for auto-generated idea cards — V3 idea engine output.

Rows are system-wide (no user_id) and visible to all authenticated users.
The idea generator job replaces the full batch each run and purges rows
older than 24 hours.  added_to_watchlist is flipped to True when any
user adds the idea to their personal watchlist.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GeneratedIdea(Base):
    __tablename__ = "generated_ideas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)

    # ── Why flagged ───────────────────────────────────────────────────────────
    # "news" | "theme" | "technical"
    source: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    reason_summary: Mapped[str] = mapped_column(Text, nullable=False)
    news_headline: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    news_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    news_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # "earnings" | "policy" | "sector_rotation" | "technical" | None
    catalyst_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # ── Price / zone ──────────────────────────────────────────────────────────
    current_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    buy_zone_low: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    buy_zone_high: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)
    ideal_entry_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 4), nullable=True)

    # ── Scores ────────────────────────────────────────────────────────────────
    confidence_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False)
    historical_win_rate_90d: Mapped[Optional[float]] = mapped_column(Numeric(6, 4), nullable=True)
    theme_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    megatrend_tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    moat_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.0)
    moat_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    financial_quality_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.0)
    financial_flags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    near_52w_low: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    at_weekly_support: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"
    entry_priority: Mapped[str] = mapped_column(String(20), nullable=False, default="STANDARD")
    idea_score: Mapped[float] = mapped_column(Numeric(6, 4), nullable=False, default=0.0, index=True)

    # ── Lifecycle ─────────────────────────────────────────────────────────────
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    # Ideas expire 24 hours after generation.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    # Flipped to True when a user clicks "Add to Watchlist" on this card.
    added_to_watchlist: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
