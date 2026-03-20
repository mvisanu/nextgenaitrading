from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ArtifactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    strategy_run_id: int
    created_at: datetime
    mode_name: str
    variant_name: str
    symbol: str
    pine_script_version: str
    notes: str | None
    selected_winner: bool


class PineScriptOut(BaseModel):
    id: int = Field(description="Artifact primary key")
    variant_name: str = Field(description="Winning variant name")
    symbol: str = Field(description="Symbol the strategy was optimized for")
    pine_script_version: str = Field(description="Pine Script version (always v5)")
    pine_script_code: str = Field(description="Complete Pine Script v5 source code")
