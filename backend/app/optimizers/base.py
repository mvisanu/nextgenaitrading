from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import pandas as pd

from app.backtesting.engine import BacktestResult


@dataclass
class VariantResult:
    variant_name: str
    family_name: str
    parameters: dict
    backtest: BacktestResult


class BaseOptimizer(ABC):
    """Abstract base for AI Pick and Buy Low / Sell High optimizers."""

    MAX_VARIANTS: int = 12

    @abstractmethod
    def generate_variants(self) -> list[dict]:
        """Return a list of parameter dicts, one per variant."""
        ...

    @abstractmethod
    def run_variant(self, df: pd.DataFrame, params: dict, variant_name: str) -> VariantResult:
        """Run backtest for one variant and return VariantResult."""
        ...

    def run_all(self, df: pd.DataFrame) -> list[VariantResult]:
        """
        Run all variants, rank by validation_score, return sorted list.
        Caps at MAX_VARIANTS.
        """
        variants = self.generate_variants()[: self.MAX_VARIANTS]
        results: list[VariantResult] = []
        for i, params in enumerate(variants):
            name = f"{self.family_name}_v{i+1}"
            try:
                r = self.run_variant(df, params, name)
                results.append(r)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("Variant %s failed: %s", name, exc)

        # Sort descending by validation_score
        results.sort(key=lambda r: r.backtest.validation_score, reverse=True)
        return results

    @property
    def family_name(self) -> str:
        return self.__class__.__name__.replace("Optimizer", "").lower()
