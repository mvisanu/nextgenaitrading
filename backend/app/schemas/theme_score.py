"""Pydantic v2 schemas for Theme Score endpoints."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ThemeScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticker: str
    theme_score_total: float = Field(ge=0.0, le=1.0)
    theme_scores_by_category: dict = Field(
        description="Per-theme scores e.g. {\"ai\": 0.85, \"semiconductors\": 0.60}"
    )
    narrative_momentum_score: float = Field(ge=0.0, le=1.0)
    sector_tailwind_score: float = Field(ge=0.0, le=1.0)
    macro_alignment_score: float = Field(ge=0.0, le=1.0)
    explanation: list[str]
    updated_at: datetime

    @classmethod
    def from_orm_model(cls, ts: object, explanation: list[str]) -> "ThemeScoreOut":
        return cls(
            id=ts.id,  # type: ignore[attr-defined]
            ticker=ts.ticker,  # type: ignore[attr-defined]
            theme_score_total=ts.theme_score_total,  # type: ignore[attr-defined]
            theme_scores_by_category=ts.theme_scores_json,  # type: ignore[attr-defined]
            narrative_momentum_score=ts.narrative_momentum_score,  # type: ignore[attr-defined]
            sector_tailwind_score=ts.sector_tailwind_score,  # type: ignore[attr-defined]
            macro_alignment_score=ts.macro_alignment_score,  # type: ignore[attr-defined]
            explanation=explanation,
            updated_at=ts.updated_at,  # type: ignore[attr-defined]
        )
