"""Pydantic v2 schemas for Watchlist Idea endpoints."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SUPPORTED_THEMES = [
    "ai",
    "renewable_energy",
    "power_infrastructure",
    "data_centers",
    "space_economy",
    "aerospace",
    "defense",
    "robotics",
    "semiconductors",
    "cybersecurity",
]


class TickerIn(BaseModel):
    ticker: str = Field(min_length=1, max_length=20)
    is_primary: bool = False
    near_earnings: bool = False


class TickerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    idea_id: int
    ticker: str
    is_primary: bool
    near_earnings: bool


class IdeaCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    thesis: str = Field(default="", max_length=10_000)
    conviction_score: int = Field(default=5, ge=1, le=10)
    watch_only: bool = False
    tradable: bool = True
    # Accept both "tags_json" (test/frontend convention) and "tags" (internal name)
    tags_json: list[str] = Field(default_factory=list, description="Theme tags for this idea")
    tags: list[str] | None = Field(default=None, exclude=True)
    tickers: list[TickerIn] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def coerce_tags(cls, values: dict) -> dict:
        """If only 'tags' (legacy name) is supplied, copy it to tags_json."""
        if isinstance(values, dict):
            if "tags" in values and "tags_json" not in values:
                values["tags_json"] = values["tags"]
        return values

    @field_validator("tags_json")
    @classmethod
    def validate_tags(cls, v: list[str]) -> list[str]:
        for tag in v:
            if tag not in SUPPORTED_THEMES:
                raise ValueError(
                    f"Tag '{tag}' is not a supported theme. "
                    f"Supported: {', '.join(SUPPORTED_THEMES)}"
                )
        return v


class IdeaUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    thesis: str | None = Field(default=None, max_length=10_000)
    conviction_score: int | None = Field(default=None, ge=1, le=10)
    watch_only: bool | None = None
    tradable: bool | None = None
    # Accept both "tags_json" (test/frontend convention) and "tags" (legacy)
    tags_json: list[str] | None = None
    tags: list[str] | None = Field(default=None, exclude=True)
    tickers: list[TickerIn] | None = None
    metadata: dict | None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_tags(cls, values: dict) -> dict:
        if isinstance(values, dict):
            if "tags" in values and "tags_json" not in values:
                values["tags_json"] = values["tags"]
        return values

    @field_validator("tags_json")
    @classmethod
    def validate_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        for tag in v:
            if tag not in SUPPORTED_THEMES:
                raise ValueError(
                    f"Tag '{tag}' is not a supported theme. "
                    f"Supported: {', '.join(SUPPORTED_THEMES)}"
                )
        return v


class IdeaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    thesis: str
    conviction_score: int
    watch_only: bool
    tradable: bool
    # Return as tags_json (matches test/frontend expectations)
    tags_json: list[str]
    tickers: list[TickerOut]
    metadata: dict
    rank_score: float = Field(
        default=0.0,
        description="Composite auto-rank score: theme*0.35 + entry*0.35 + conviction*0.20 + alert*0.10",
    )
    created_at: datetime
    updated_at: datetime
