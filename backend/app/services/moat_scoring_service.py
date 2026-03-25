"""
Competitive moat scoring — V3 idea quality layer.

Moat score (0.0–1.0) represents the strength of a company's competitive
position:
  >= 0.70  "Strong" (green badge)
  0.30–0.70 "Moderate" (gray badge)
  < 0.30  "Low competitive moat — higher risk" (red badge)

Primary source: HIGH_MOAT_TICKERS seed dict for well-known names.
Fallback: yfinance marketCap heuristic for unknown tickers.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

import yfinance as yf

logger = logging.getLogger(__name__)

# ── Pre-seeded moat scores for well-known names ───────────────────────────────
HIGH_MOAT_TICKERS: dict[str, tuple[float, str]] = {
    # (moat_score, moat_description)
    "NVDA": (0.85, "Dominant GPU share for AI training (~80% data-center GPU market)"),
    "ISRG": (0.90, "~80% surgical robot market share; high switching costs"),
    "ASML": (0.95, "Only company producing EUV lithography machines — no alternative"),
    "ILMN": (0.80, "Dominant DNA sequencing platform with deep installed-base lock-in"),
    "MSFT": (0.80, "Enterprise software + Azure cloud ecosystem lock-in"),
    "TSM": (0.85, "World's leading advanced-node chip foundry; near-monopoly at <5nm"),
    "V":   (0.80, "Payment network duopoly; high network-effect switching costs"),
    "MA":  (0.80, "Payment network duopoly; high network-effect switching costs"),
    "LLY": (0.75, "GLP-1 biologics duopoly with NVO; 2–3 year manufacturing lead"),
    "NVO": (0.75, "GLP-1 biologics duopoly with LLY; first-mover brand recognition"),
    "AAPL": (0.85, "Integrated hardware-software ecosystem with 2B+ active devices"),
    "GOOGL": (0.80, "~90% search market share; dominant cloud and AI infrastructure"),
    "AMZN": (0.80, "AWS dominant cloud share; logistics network moat in e-commerce"),
    "META": (0.75, "Social graph network effects across 3B+ daily active users"),
}


@dataclass
class MoatResult:
    score: float
    description: str
    source: str  # "seed" | "heuristic" | "unavailable"


def score_moat(ticker: str) -> MoatResult:
    """
    Return moat score and description for a ticker.

    Checks HIGH_MOAT_TICKERS first; falls back to a market-cap heuristic
    using yfinance .info.  If yfinance is unavailable, returns a neutral
    score of 0.50.

    Parameters
    ----------
    ticker:
        Stock ticker symbol (case-insensitive).

    Returns
    -------
    MoatResult
        score: float 0.0–1.0
        description: human-readable moat narrative
        source: "seed" | "heuristic" | "unavailable"

    Examples
    --------
    >>> r = score_moat("NVDA")
    >>> r.score
    0.85
    >>> r.source
    'seed'
    """
    t = ticker.upper()

    if t in HIGH_MOAT_TICKERS:
        score, desc = HIGH_MOAT_TICKERS[t]
        return MoatResult(score=score, description=desc, source="seed")

    # Fallback: market cap heuristic
    # Large-cap companies in concentrated industries tend to have stronger moats.
    # This is a rough proxy — not a fundamental analysis.
    try:
        info = yf.Ticker(t).info
        market_cap = info.get("marketCap") or 0
        industry = info.get("industry", "")
        sector = info.get("sector", "")

        if market_cap >= 500_000_000_000:   # $500B+  — mega cap, assumed strong position
            score = 0.65
            desc = f"Mega-cap ({market_cap/1e9:.0f}B market cap) — probable market leadership"
        elif market_cap >= 100_000_000_000:  # $100B+
            score = 0.55
            desc = f"Large-cap ({market_cap/1e9:.0f}B) in {sector or 'unknown sector'}"
        elif market_cap >= 10_000_000_000:   # $10B+
            score = 0.45
            desc = f"Mid-to-large-cap ({market_cap/1e9:.0f}B) in {industry or 'unknown industry'}"
        elif market_cap > 0:
            score = 0.35
            desc = f"Smaller-cap ({market_cap/1e9:.1f}B) — moat strength requires fundamental review"
        else:
            score = 0.50
            desc = "Market cap unavailable — moat not assessed"

        return MoatResult(score=score, description=desc, source="heuristic")

    except Exception as exc:
        logger.warning("moat_scoring: yfinance fallback failed for %s: %s", t, exc)
        return MoatResult(
            score=0.50,
            description="Competitive moat data unavailable",
            source="unavailable",
        )


def get_moat_badge(score: float) -> str:
    """
    Return the display badge label for a moat score.

    Examples
    --------
    >>> get_moat_badge(0.85)
    'Strong'
    >>> get_moat_badge(0.50)
    'Moderate'
    >>> get_moat_badge(0.20)
    'Low'
    """
    if score >= 0.70:
        return "Strong"
    if score >= 0.30:
        return "Moderate"
    return "Low"
