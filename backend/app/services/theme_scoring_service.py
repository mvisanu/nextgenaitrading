"""
Theme Scoring Service.

Blends sector/industry mapping, user-assigned tags from WatchlistIdeas,
and analyst thesis text to produce a theme alignment score per ticker.

IMPORTANT: Theme score improves ranking and prioritization but NEVER
overrides price/risk controls. A high theme score on a poor technical
setup must still block auto-buy.

Supported themes (initial set):
  ai, renewable_energy, power_infrastructure, data_centers, space_economy,
  aerospace, defense, robotics, semiconductors, cybersecurity

Theme score is system-wide (no user_id) — shared across all users.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import yfinance as yf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.idea import WatchlistIdea, WatchlistIdeaTicker
from app.models.theme_score import StockThemeScore

logger = logging.getLogger(__name__)

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

# Curated sector → theme mappings (starting point; user tags override)
SECTOR_TO_THEMES: dict[str, list[str]] = {
    "Technology": ["ai", "semiconductors", "cybersecurity", "data_centers"],
    "Communication Services": ["ai", "data_centers"],
    "Industrials": ["robotics", "aerospace", "defense", "power_infrastructure"],
    "Energy": ["renewable_energy", "power_infrastructure"],
    "Utilities": ["renewable_energy", "power_infrastructure"],
    "Consumer Discretionary": [],
    "Consumer Staples": [],
    "Health Care": [],
    "Financials": [],
    "Real Estate": ["data_centers"],
    "Materials": ["renewable_energy"],
    "Basic Materials": ["renewable_energy"],
}

# Curated ticker → theme tag overrides for well-known names
TICKER_THEME_OVERRIDES: dict[str, list[str]] = {
    "NVDA": ["ai", "semiconductors", "data_centers"],
    "AMD": ["ai", "semiconductors"],
    "INTC": ["semiconductors"],
    "TSLA": ["ai", "robotics", "renewable_energy"],
    "MSFT": ["ai", "data_centers", "cybersecurity"],
    "GOOGL": ["ai", "data_centers"],
    "AMZN": ["ai", "data_centers"],
    "META": ["ai"],
    "AAPL": ["ai"],
    "PLTR": ["ai", "defense"],
    "LMT": ["defense", "aerospace"],
    "RTX": ["defense", "aerospace"],
    "NOC": ["defense", "aerospace"],
    "SPCE": ["space_economy", "aerospace"],
    "RKLB": ["space_economy", "aerospace"],
    "NEE": ["renewable_energy", "power_infrastructure"],
    "ENPH": ["renewable_energy"],
    "FSLR": ["renewable_energy"],
    "VST": ["power_infrastructure", "data_centers"],
    "CEG": ["power_infrastructure", "data_centers"],
    "CRWD": ["cybersecurity"],
    "PANW": ["cybersecurity", "ai"],
    "OKTA": ["cybersecurity"],
    "ANET": ["data_centers", "ai"],
    "SMCI": ["data_centers", "ai"],
    "ETN": ["power_infrastructure"],
    "PWR": ["power_infrastructure"],
    "ABB": ["robotics", "power_infrastructure"],
    "FANUC": ["robotics"],
    "IRBT": ["robotics"],
}


@dataclass
class ThemeScoreResult:
    ticker: str
    theme_score_total: float            # 0.0 – 1.0
    theme_scores_by_category: dict      # {"ai": 0.85, "semiconductors": 0.60, ...}
    narrative_momentum_score: float
    sector_tailwind_score: float
    macro_alignment_score: float
    user_conviction_score: float        # from idea conviction input
    explanation: list[str]


def _get_sector_themes(ticker: str) -> tuple[list[str], float, str]:
    """
    Fetch sector from yfinance and map to themes.
    Returns (theme_list, sector_score, explanation_string).
    """
    try:
        info = yf.Ticker(ticker).info
        sector = info.get("sector", "") or ""
        themes = SECTOR_TO_THEMES.get(sector, [])
        score = 0.5 if themes else 0.1
        explanation = f"Sector '{sector}' maps to themes: {', '.join(themes) if themes else 'none identified'}"
        return themes, score, explanation
    except Exception as exc:
        logger.warning("yfinance sector lookup failed for %s: %s", ticker, exc)
        return [], 0.1, "Sector data unavailable"


async def compute_theme_score(
    ticker: str,
    user_id: int,
    db: AsyncSession,
) -> ThemeScoreResult:
    """
    Compute a theme alignment score by blending:
    1. Sector/industry mapping (yfinance sector field)
    2. Curated ticker-to-theme tag overrides
    3. User-assigned themes from WatchlistIdeas for this user+ticker
    4. User conviction scores from idea thesis
    """
    ticker = ticker.upper()
    explanations: list[str] = []
    per_theme_scores: dict[str, float] = {t: 0.0 for t in SUPPORTED_THEMES}

    # Layer 1: Curated ticker overrides (highest signal, lowest latency)
    override_themes = TICKER_THEME_OVERRIDES.get(ticker, [])
    if override_themes:
        for t in override_themes:
            per_theme_scores[t] = max(per_theme_scores.get(t, 0.0), 0.80)
        explanations.append(
            f"Curated theme tags: {', '.join(override_themes)}"
        )

    # Layer 2: Sector mapping via yfinance
    sector_themes, sector_score, sector_explanation = _get_sector_themes(ticker)
    for t in sector_themes:
        per_theme_scores[t] = max(per_theme_scores.get(t, 0.0), 0.50)
    explanations.append(sector_explanation)

    # Layer 3: User-assigned themes from WatchlistIdeas
    user_conviction_score = 0.0
    ideas_result = await db.execute(
        select(WatchlistIdea)
        .join(WatchlistIdeaTicker, WatchlistIdeaTicker.idea_id == WatchlistIdea.id)
        .where(
            WatchlistIdea.user_id == user_id,
            WatchlistIdeaTicker.ticker == ticker,
        )
    )
    user_ideas = list(ideas_result.scalars().all())

    if user_ideas:
        all_user_tags: set[str] = set()
        conviction_scores: list[int] = []
        for idea in user_ideas:
            all_user_tags.update(idea.tags_json or [])
            conviction_scores.append(idea.conviction_score or 5)

        for tag in all_user_tags:
            if tag in per_theme_scores:
                per_theme_scores[tag] = max(per_theme_scores[tag], 0.70)

        avg_conviction = sum(conviction_scores) / len(conviction_scores)
        user_conviction_score = avg_conviction / 10.0  # normalise to 0–1

        explanations.append(
            f"User has {len(user_ideas)} idea(s) with this ticker; "
            f"tags: {', '.join(all_user_tags) if all_user_tags else 'none'}; "
            f"average conviction: {avg_conviction:.1f}/10"
        )
    else:
        explanations.append("No user ideas linked to this ticker")

    # Composite scores
    active_themes = [v for v in per_theme_scores.values() if v > 0]
    theme_score_total = round(
        (sum(active_themes) / len(SUPPORTED_THEMES)) if active_themes else 0.0, 4
    )
    theme_score_total = min(1.0, theme_score_total)

    narrative_momentum_score = round(min(1.0, sector_score + user_conviction_score * 0.3), 4)
    sector_tailwind_score = round(sector_score, 4)
    macro_alignment_score = round(user_conviction_score * 0.5 + 0.3, 4)

    # Persist / update the system-wide score row
    result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.ticker == ticker)
    )
    ts = result.scalar_one_or_none()
    if ts:
        ts.theme_score_total = theme_score_total
        ts.theme_scores_json = per_theme_scores
        ts.narrative_momentum_score = narrative_momentum_score
        ts.sector_tailwind_score = sector_tailwind_score
        ts.macro_alignment_score = macro_alignment_score
        ts.updated_at = datetime.now(timezone.utc)
    else:
        ts = StockThemeScore(
            ticker=ticker,
            theme_score_total=theme_score_total,
            theme_scores_json=per_theme_scores,
            narrative_momentum_score=narrative_momentum_score,
            sector_tailwind_score=sector_tailwind_score,
            macro_alignment_score=macro_alignment_score,
        )
        db.add(ts)

    await db.commit()
    await db.refresh(ts)

    logger.info("Theme score for %s: %.2f (user_id=%s)", ticker, theme_score_total, user_id)

    return ThemeScoreResult(
        ticker=ticker,
        theme_score_total=theme_score_total,
        theme_scores_by_category=per_theme_scores,
        narrative_momentum_score=narrative_momentum_score,
        sector_tailwind_score=sector_tailwind_score,
        macro_alignment_score=macro_alignment_score,
        user_conviction_score=user_conviction_score,
        explanation=explanations,
    )
