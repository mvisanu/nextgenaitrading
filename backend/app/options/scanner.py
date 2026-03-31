"""Options chain screener with configurable filters."""
from __future__ import annotations

import logging
from typing import Literal, Optional

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from .broker.base import OptionContract, OptionsBrokerBase
from .greeks import compute_greeks
from .iv import compute_iv_rank, compute_iv_percentile, get_iv_history, store_iv_snapshot
from datetime import date

logger = logging.getLogger(__name__)


class OptionsScannerFilter(BaseModel):
    symbol: str
    expiration: date
    min_delta: float = Field(default=0.10, ge=0.0, le=1.0)
    max_delta: float = Field(default=0.50, ge=0.0, le=1.0)
    min_oi: int = Field(default=100, ge=0)
    min_volume: int = Field(default=0, ge=0)
    min_iv_rank: float = Field(default=0.0, ge=0.0, le=100.0)
    strategy_bias: Literal["bullish", "bearish", "neutral", "any"] = "any"


async def run_scan(
    filter: OptionsScannerFilter,
    broker: OptionsBrokerBase,
    underlying_price: float,
    db: AsyncSession,
) -> list[OptionContract]:
    """Fetch chain, compute Greeks + IV, apply filters, return sorted results."""
    chain = await broker.get_options_chain(filter.symbol, filter.expiration)
    if not chain:
        return []

    # Enrich with Greeks
    chain = compute_greeks(chain, underlying_price)

    # Compute IV rank/percentile for symbol — store current snapshot
    sample_iv = next((c.implied_volatility for c in chain if c.implied_volatility > 0), None)
    iv_rank = 0.0
    if sample_iv:
        try:
            await store_iv_snapshot(filter.symbol, sample_iv, db)
            history = await get_iv_history(filter.symbol, db)
            iv_rank = compute_iv_rank(sample_iv, history)
        except Exception as exc:
            logger.debug("IV rank computation failed for %s: %s", filter.symbol, exc)

    # Apply filters
    results: list[OptionContract] = []
    for c in chain:
        # Exclude illiquid
        if c.illiquid:
            continue
        # OI filter
        if c.open_interest < filter.min_oi:
            continue
        # Volume filter
        if c.volume < filter.min_volume:
            continue
        # Delta filter (use abs for puts)
        abs_delta = abs(c.delta)
        if abs_delta < filter.min_delta or abs_delta > filter.max_delta:
            continue
        # IV rank filter
        if iv_rank < filter.min_iv_rank:
            continue
        # Strategy bias filter
        if filter.strategy_bias == "bullish" and c.option_type != "put":
            continue  # bullish = focus on puts for CSP/bull spreads
        elif filter.strategy_bias == "bearish" and c.option_type != "call":
            continue
        results.append(c)

    # Sort by IV desc, then OI desc
    results.sort(key=lambda c: (c.implied_volatility, c.open_interest), reverse=True)
    return results
