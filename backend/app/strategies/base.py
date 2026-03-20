from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import pandas as pd


@dataclass
class SignalResult:
    """Output from a strategy's signal generation."""
    regime: str          # "bull" | "bear" | "unknown"
    signal: str          # "buy" | "sell" | "hold"
    confirmation_count: int
    entry_eligible: bool
    cooldown_active: bool
    reason_summary: str
    bull_state_id: int = 0
    bear_state_id: int = 1
    current_state_id: int = 0
    bar_timestamps: list = field(default_factory=list)
    signals_per_bar: list = field(default_factory=list)


class BaseStrategy(ABC):
    """Abstract base for Conservative and Aggressive strategy modes."""

    leverage: float = 1.0
    min_confirmations: int = 7
    trailing_stop_pct: float | None = None

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> SignalResult:
        """
        Run the full strategy on a OHLCV DataFrame.
        Returns the current-bar signal result.
        """
        ...
