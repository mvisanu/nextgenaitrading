"""
Financial quality scoring — V3 idea quality layer.

Scores 0.0–1.0 based on four yfinance .info fields:
  revenueGrowth      — YoY revenue growth (positive = good)
  earningsGrowth     — YoY earnings growth (or strong revenue if not profitable)
  grossMargins       — gross margin stability / improvement proxy
  operatingMargins   — operating leverage indicator

Each passing criterion adds 0.25 to the score.
If fewer than 2 fields are available, returns score=None and
financial_quality_score=0.5 (neutral) with flag "financials_unavailable".
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import yfinance as yf

logger = logging.getLogger(__name__)


@dataclass
class FinancialQualityResult:
    score: float                          # 0.0–1.0; 0.5 if data unavailable
    flags: list[str] = field(default_factory=list)
    financials_available: bool = True


def score_financial_quality(ticker: str) -> FinancialQualityResult:
    """
    Compute a financial quality score from yfinance .info fields.

    Parameters
    ----------
    ticker:
        Stock ticker symbol (case-insensitive).

    Returns
    -------
    FinancialQualityResult
        score: 0.0 – 1.0 (0.5 neutral when data is missing)
        flags: list of human-readable quality observations
        financials_available: False when fewer than 2 fields could be read

    Examples
    --------
    >>> r = score_financial_quality("NVDA")  # doctest: +SKIP
    >>> 0.0 <= r.score <= 1.0
    True
    """
    t = ticker.upper()
    try:
        info = yf.Ticker(t).info
    except Exception as exc:
        logger.warning("financial_quality: yfinance failed for %s: %s", t, exc)
        return FinancialQualityResult(score=0.5, flags=["financials_unavailable"], financials_available=False)

    revenue_growth: Optional[float] = info.get("revenueGrowth")
    earnings_growth: Optional[float] = info.get("earningsGrowth")
    gross_margins: Optional[float] = info.get("grossMargins")
    operating_margins: Optional[float] = info.get("operatingMargins")

    available = [v for v in [revenue_growth, earnings_growth, gross_margins, operating_margins] if v is not None]
    if len(available) < 2:
        return FinancialQualityResult(
            score=0.5,
            flags=["financials_unavailable"],
            financials_available=False,
        )

    score = 0.0
    flags: list[str] = []

    # Criterion 1: positive revenue growth
    if revenue_growth is not None:
        if revenue_growth > 0:
            score += 0.25
            flags.append(f"revenue_growth_positive ({revenue_growth:+.0%})")
        else:
            flags.append(f"revenue_growth_negative ({revenue_growth:+.0%})")
    else:
        # Not available — skip but don't penalise
        score += 0.10
        flags.append("revenue_growth_unavailable")

    # Criterion 2: positive earnings growth OR strong revenue as substitute
    if earnings_growth is not None:
        if earnings_growth > 0:
            score += 0.25
            flags.append(f"earnings_growth_positive ({earnings_growth:+.0%})")
        elif revenue_growth is not None and revenue_growth >= 0.20:
            # High revenue growth accepted as path-to-profitability signal
            score += 0.15
            flags.append(f"strong_revenue_growth_offset ({revenue_growth:+.0%}) compensates for negative earnings")
        else:
            flags.append(f"earnings_growth_negative ({earnings_growth:+.0%})")
    else:
        score += 0.10
        flags.append("earnings_growth_unavailable")

    # Criterion 3: healthy gross margins (>= 30% is generally positive)
    if gross_margins is not None:
        if gross_margins >= 0.40:
            score += 0.25
            flags.append(f"gross_margins_strong ({gross_margins:.0%})")
        elif gross_margins >= 0.20:
            score += 0.15
            flags.append(f"gross_margins_moderate ({gross_margins:.0%})")
        else:
            flags.append(f"gross_margins_thin ({gross_margins:.0%})")
    else:
        score += 0.10
        flags.append("gross_margins_unavailable")

    # Criterion 4: positive operating margins (profitable or near-profitable)
    if operating_margins is not None:
        if operating_margins >= 0.15:
            score += 0.25
            flags.append(f"operating_margins_strong ({operating_margins:.0%})")
        elif operating_margins >= 0.0:
            score += 0.15
            flags.append(f"operating_margins_breakeven ({operating_margins:.0%})")
        else:
            flags.append(f"operating_margins_negative ({operating_margins:.0%})")
    else:
        score += 0.10
        flags.append("operating_margins_unavailable")

    final_score = round(min(1.0, max(0.0, score)), 4)
    return FinancialQualityResult(score=final_score, flags=flags, financials_available=True)


def get_financial_quality_label(score: float, available: bool) -> str:
    """
    Return a display label for the financial quality score.

    Examples
    --------
    >>> get_financial_quality_label(0.85, True)
    'Strong'
    >>> get_financial_quality_label(0.5, False)
    'Financials unavailable'
    """
    if not available:
        return "Financials unavailable"
    if score >= 0.70:
        return "Strong"
    if score >= 0.40:
        return "Moderate"
    return "Weak"
