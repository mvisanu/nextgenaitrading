"""
Idea generator service.

Scans a curated universe of ~40 popular tickers, runs ConservativeStrategy
on each, scores them by momentum + volume + signal strength, and returns
the top 15 as GeneratedIdeaOut instances.

Results are in-process cached for 30 minutes to avoid redundant yfinance
round-trips when multiple users call GET /api/scanner/ideas in quick succession.

Scoring formula (composite_score, 0–1 range):
  0.40 * signal_score          (buy=1.0, hold=0.5, sell=0.0)
  0.25 * confirmation_ratio    (confirmation_count / 8)
  0.20 * momentum_20d_norm     (capped at ±50 %, normalised to 0–1)
  0.15 * volume_score          (vol_ratio / 2.0, capped at 1.0)

Thesis strings are generated from indicator data so users understand why
a ticker was surfaced — no LLM dependency.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.schemas.scanner import GeneratedIdeaOut
from app.services.market_data import load_ohlcv_for_strategy
from app.strategies.conservative import (
    ConservativeStrategy,
    _add_indicators,
)

logger = logging.getLogger(__name__)

# ── Stock universe ─────────────────────────────────────────────────────────────
STOCK_UNIVERSE: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA",
    # Semiconductors
    "AMD", "INTC", "AVGO", "QCOM", "MU",
    # Software / Cloud
    "CRM", "ADBE", "NOW", "SNOW", "PLTR",
    # Financials
    "JPM", "GS", "BAC", "V", "MA",
    # Healthcare / Biotech
    "UNH", "LLY", "ABBV", "JNJ",
    # Energy / Industrial
    "XOM", "NEE", "CAT", "DE",
    # Streaming / Retail
    "NFLX", "DIS", "COST", "WMT",
    # ETFs
    "SPY", "QQQ", "IWM",
    # Crypto-correlated
    "BTC-USD", "ETH-USD", "SOL-USD",
]

# ── Theme tags by ticker ───────────────────────────────────────────────────────
_TICKER_TAGS: dict[str, list[str]] = {
    "NVDA": ["ai", "semiconductors"],
    "AMD": ["ai", "semiconductors"],
    "INTC": ["semiconductors"],
    "AVGO": ["ai", "semiconductors"],
    "QCOM": ["semiconductors"],
    "MU": ["semiconductors"],
    "MSFT": ["ai", "data_centers"],
    "GOOGL": ["ai", "data_centers"],
    "META": ["ai"],
    "AMZN": ["ai", "data_centers"],
    "CRM": ["ai"],
    "SNOW": ["data_centers"],
    "PLTR": ["ai", "defense"],
    "NEE": ["renewable_energy", "power_infrastructure"],
    "GS": [],
    "BTC-USD": [],
    "ETH-USD": [],
    "SOL-USD": [],
}

# ── In-process cache ───────────────────────────────────────────────────────────
_cache: list[GeneratedIdeaOut] = []
_cache_expires_at: datetime = datetime.min.replace(tzinfo=timezone.utc)
_CACHE_TTL = timedelta(minutes=30)

_strategy = ConservativeStrategy()

# ── Helpers ───────────────────────────────────────────────────────────────────


def _normalise_momentum(pct: float) -> float:
    """Map a ±50 % return to a [0, 1] score. Returns 0.5 at 0 % return."""
    capped = max(-50.0, min(50.0, pct))
    return (capped + 50.0) / 100.0


def _signal_score(signal: str) -> float:
    return {"buy": 1.0, "hold": 0.5, "sell": 0.0}.get(signal, 0.5)


def _build_thesis(
    ticker: str,
    signal: str,
    regime: Optional[str],
    confirmation_count: int,
    momentum_20d: float,
    momentum_60d: float,
    volume_score: float,
) -> str:
    """
    Generate a human-readable thesis from indicator data.
    No LLM dependency — purely rule-based for reliability and speed.
    """
    lines: list[str] = []

    # Signal + regime header
    regime_str = regime or "unknown"
    lines.append(
        f"{ticker} shows a {signal.upper()} signal in a {regime_str} regime "
        f"({confirmation_count}/8 confirmations met)."
    )

    # Momentum commentary
    if momentum_20d > 5:
        lines.append(f"Short-term momentum is strong (+{momentum_20d:.1f}% over 20 days).")
    elif momentum_20d < -5:
        lines.append(f"Short-term momentum is weak ({momentum_20d:.1f}% over 20 days).")
    else:
        lines.append(f"Short-term momentum is neutral ({momentum_20d:.1f}% over 20 days).")

    if momentum_60d > 10:
        lines.append(f"Medium-term trend is bullish (+{momentum_60d:.1f}% over 60 days).")
    elif momentum_60d < -10:
        lines.append(f"Medium-term trend is bearish ({momentum_60d:.1f}% over 60 days).")

    # Volume commentary
    if volume_score >= 0.8:
        lines.append("Volume is elevated relative to the 20-bar average — institutional interest likely.")
    elif volume_score <= 0.3:
        lines.append("Volume is below average — wait for a pickup before entering.")

    return " ".join(lines)


def _scan_ticker_sync(ticker: str) -> Optional[dict]:
    """
    Synchronous inner function: load data, run strategy, compute scores.
    Returns None on failure (caller logs and skips).
    """
    try:
        df_raw = load_ohlcv_for_strategy(ticker, "1d")
        df = _add_indicators(df_raw)

        if len(df) < 60:
            logger.debug("idea_generator: skipping %s — too few bars (%d)", ticker, len(df))
            return None

        result = _strategy.generate_signals(df_raw)
        current_price = float(df_raw["Close"].iloc[-1])

        # Momentum: simple price return
        n = len(df_raw)
        idx_20 = max(0, n - 21)
        idx_60 = max(0, n - 61)
        price_20d_ago = float(df_raw["Close"].iloc[idx_20])
        price_60d_ago = float(df_raw["Close"].iloc[idx_60])
        momentum_20d = (current_price - price_20d_ago) / price_20d_ago * 100 if price_20d_ago > 0 else 0.0
        momentum_60d = (current_price - price_60d_ago) / price_60d_ago * 100 if price_60d_ago > 0 else 0.0

        # Volume score: vol_ratio of the last bar, capped at 1.0
        vol_ratio = 1.0
        if len(df) > 0 and "vol_ratio" in df.columns:
            vol_ratio = float(df["vol_ratio"].iloc[-1])
        volume_score = round(min(1.0, vol_ratio / 2.0), 4)

        # Composite score
        sig_s = _signal_score(result.signal)
        conf_ratio = result.confirmation_count / 8.0
        mom_norm = _normalise_momentum(momentum_20d)
        composite_score = round(
            0.40 * sig_s + 0.25 * conf_ratio + 0.20 * mom_norm + 0.15 * volume_score,
            4,
        )

        tags = _TICKER_TAGS.get(ticker, [])
        theme_score: Optional[float] = float(len(tags)) / 5.0 if tags else None  # rough proxy

        thesis = _build_thesis(
            ticker, result.signal, result.regime,
            result.confirmation_count, momentum_20d, momentum_60d, volume_score,
        )

        return {
            "ticker": ticker,
            "title": f"{ticker} — {result.signal.capitalize()} ({result.regime or 'unknown'} regime)",
            "thesis": thesis,
            "signal": result.signal,
            "regime": result.regime,
            "confirmation_count": result.confirmation_count,
            "momentum_20d": round(momentum_20d, 2),
            "momentum_60d": round(momentum_60d, 2),
            "volume_score": volume_score,
            "theme_score": theme_score,
            "composite_score": composite_score,
            "current_price": current_price,
            "tags": tags,
        }
    except Exception as exc:
        logger.error("idea_generator: error for %s: %s", ticker, exc)
        return None


async def generate_ideas(top_n: int = 15) -> list[GeneratedIdeaOut]:
    """
    Scan STOCK_UNIVERSE and return the top N ideas ranked by composite_score.

    Results are cached for 30 minutes. The cache is process-local and resets
    on each worker restart — suitable for single-worker deployments and Render
    free-tier. For multi-worker setups, promote this cache to Redis in v3.
    """
    global _cache, _cache_expires_at

    now = datetime.now(timezone.utc)
    if _cache and now < _cache_expires_at:
        logger.debug("idea_generator: returning %d cached ideas", len(_cache))
        return _cache[:top_n]

    logger.info("idea_generator: scanning %d tickers in universe", len(STOCK_UNIVERSE))
    loop = asyncio.get_event_loop()
    generated_at = datetime.now(timezone.utc)

    # Run each ticker scan in the default thread pool (yfinance is synchronous)
    tasks = [
        loop.run_in_executor(None, _scan_ticker_sync, ticker)
        for ticker in STOCK_UNIVERSE
    ]
    raw_results = await asyncio.gather(*tasks)

    ideas: list[GeneratedIdeaOut] = []
    for data in raw_results:
        if data is None:
            continue
        ideas.append(
            GeneratedIdeaOut(
                ticker=data["ticker"],
                title=data["title"],
                thesis=data["thesis"],
                signal=data["signal"],
                regime=data["regime"],
                confirmation_count=data["confirmation_count"],
                momentum_20d=data["momentum_20d"],
                momentum_60d=data["momentum_60d"],
                volume_score=data["volume_score"],
                theme_score=data["theme_score"],
                composite_score=data["composite_score"],
                current_price=data["current_price"],
                tags=data["tags"],
                generated_at=generated_at,
            )
        )

    # Sort by composite score descending
    ideas.sort(key=lambda x: x.composite_score, reverse=True)

    # Update cache
    _cache = ideas
    _cache_expires_at = now + _CACHE_TTL
    logger.info(
        "idea_generator: generated %d ideas, top ticker=%s (score=%.4f)",
        len(ideas),
        ideas[0].ticker if ideas else "n/a",
        ideas[0].composite_score if ideas else 0.0,
    )

    return ideas[:top_n]


def invalidate_ideas_cache() -> None:
    """Force-expire the in-process cache. Call after universe or strategy changes."""
    global _cache, _cache_expires_at
    _cache = []
    _cache_expires_at = datetime.min.replace(tzinfo=timezone.utc)
    logger.info("idea_generator: cache invalidated")
