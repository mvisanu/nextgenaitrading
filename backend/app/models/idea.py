"""
ORM models for the Idea Pipeline and Conviction Watchlist.

WatchlistIdea — user-owned investment thesis cards.
WatchlistIdeaTicker — tickers linked to an idea (one idea can have many tickers).

Non-tradable tickers (e.g. "SpaceX when public") can be stored with
tradable=False and watch_only=True. The auto-buy engine skips these entirely.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WatchlistIdea(Base):
    __tablename__ = "watchlist_ideas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    thesis: Mapped[str] = mapped_column(Text, nullable=False, default="")
    conviction_score: Mapped[int] = mapped_column(Integer, nullable=False, default=5)  # 1–10
    watch_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tradable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # List of theme strings e.g. ["ai", "semiconductors"]
    tags_json: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    # Arbitrary metadata for extensibility
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    tickers: Mapped[list["WatchlistIdeaTicker"]] = relationship(
        "WatchlistIdeaTicker", back_populates="idea", cascade="all, delete-orphan"
    )


class WatchlistIdeaTicker(Base):
    __tablename__ = "watchlist_idea_tickers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    idea_id: Mapped[int] = mapped_column(
        ForeignKey("watchlist_ideas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # OQ-02: manual earnings proximity flag (live earnings calendar deferred to v3)
    near_earnings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationships
    idea: Mapped["WatchlistIdea"] = relationship("WatchlistIdea", back_populates="tickers")
