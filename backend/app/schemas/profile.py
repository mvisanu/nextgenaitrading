from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Profile primary key")
    user_id: int = Field(description="Owning user ID")
    display_name: str | None = Field(default=None, description="Display name")
    timezone: str = Field(description="IANA timezone string, e.g. 'America/New_York'")
    default_symbol: str = Field(description="Default trading symbol, e.g. 'BTC-USD'")
    default_mode: str = Field(description="Default strategy mode")


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, description="New display name")
    timezone: str | None = Field(default=None, description="New timezone")
    default_symbol: str | None = Field(default=None, description="New default symbol")
    default_mode: Literal["conservative", "aggressive", "ai-pick", "buy-low-sell-high"] | None = Field(
        default=None, description="New default strategy mode"
    )
