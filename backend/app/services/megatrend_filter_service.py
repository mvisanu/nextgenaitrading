"""
Megatrend filter — V3 idea scoring.

Three canonical megatrends for NextGenStock V3:
  AI           — artificial intelligence, machine learning, GPU compute, data infra
  ROBOTICS     — industrial robots, humanoid robots, autonomous vehicles, drones
  LONGEVITY    — biotech, genomics, anti-aging therapeutics, diagnostics, precision medicine

Scoring:
  1.0 — ticker belongs to at least one of the three priority megatrends
  0.5 — ticker belongs to another supported theme (energy, defense, space, etc.)
  0.0 — no theme connection

Manually added watchlist tickers are never filtered out regardless of fit score.
"""
from __future__ import annotations

# ── Ticker → megatrend tag mapping ───────────────────────────────────────────
# Extend this dict as the universe grows.
MEGATREND_TICKER_MAP: dict[str, list[str]] = {
    # AI
    "NVDA": ["ai", "semiconductors"],
    "MSFT": ["ai"],
    "GOOGL": ["ai"],
    "AMZN": ["ai"],
    "META": ["ai"],
    "PLTR": ["ai", "defense"],
    "AMD": ["ai", "semiconductors"],
    "AVGO": ["ai", "semiconductors"],
    "TSM": ["ai", "semiconductors"],
    "AMAT": ["semiconductors"],
    "INTC": ["semiconductors"],
    "ASML": ["semiconductors"],
    # Robotics / Humanoids / Autopilot
    "TSLA": ["robotics", "ai"],
    "ISRG": ["robotics", "longevity"],
    "RKLB": ["robotics", "space"],
    "ASTS": ["space", "robotics"],
    # Longevity / Healthcare / Medicine
    "LLY": ["longevity", "healthcare", "medicine"],
    "NVO": ["longevity", "healthcare", "medicine"],
    "REGN": ["longevity", "healthcare", "medicine"],
    "CRSP": ["longevity", "healthcare", "medicine"],
    "ILMN": ["longevity", "ai", "healthcare"],
    "UNH": ["healthcare"],
    "JNJ": ["healthcare", "medicine"],
    "PFE": ["healthcare", "medicine"],
    "ABBV": ["healthcare", "medicine"],
    "TMO": ["healthcare"],
    "ABT": ["healthcare", "medicine"],
    # Bitcoin / Crypto
    "BTC-USD": ["bitcoin"],
    "MSTR": ["bitcoin"],
    "COIN": ["bitcoin"],
    "MARA": ["bitcoin"],
    "RIOT": ["bitcoin"],
    "IBIT": ["bitcoin"],
    # Defense
    "LMT": ["defense"],
    "RTX": ["defense"],
    "NOC": ["defense"],
    "GD": ["defense"],
    # Energy / Infrastructure
    "ETN": ["energy"],
    "NEE": ["energy"],
    "XOM": ["energy"],
    "CVX": ["energy"],
    # Financials
    "JPM": [],
    "BAC": [],
    "GS": [],
    "V": [],
    "MA": [],
    # Mega cap (neutral)
    "AAPL": [],
}

PRIORITY_MEGATRENDS = {"ai", "robotics", "longevity"}

# Other recognised themes (score 0.5)
OTHER_THEMES = {"semiconductors", "defense", "energy", "space", "bitcoin", "healthcare", "medicine"}


def get_megatrend_tags(ticker: str) -> list[str]:
    """
    Return the list of megatrend/theme tags for a ticker.

    Parameters
    ----------
    ticker:
        Stock ticker symbol (case-insensitive).

    Returns
    -------
    list[str]
        Empty list if the ticker is not in the map.

    Examples
    --------
    >>> get_megatrend_tags("NVDA")
    ['ai', 'semiconductors']
    >>> get_megatrend_tags("UNKNOWN")
    []
    """
    return MEGATREND_TICKER_MAP.get(ticker.upper(), [])


def compute_megatrend_fit_score(tags: list[str]) -> float:
    """
    Convert a list of theme tags into the megatrend fit score used in idea_score.

    Parameters
    ----------
    tags:
        List of theme tag strings (e.g. ["ai", "semiconductors"]).

    Returns
    -------
    float
        1.0 if any tag is in PRIORITY_MEGATRENDS, 0.5 if any tag is in
        OTHER_THEMES, 0.0 otherwise.

    Examples
    --------
    >>> compute_megatrend_fit_score(["ai", "semiconductors"])
    1.0
    >>> compute_megatrend_fit_score(["defense"])
    0.5
    >>> compute_megatrend_fit_score([])
    0.0
    """
    tag_set = set(tags)
    if tag_set & PRIORITY_MEGATRENDS:
        return 1.0
    if tag_set & OTHER_THEMES:
        return 0.5
    return 0.0


def get_priority_megatrend_tags(tags: list[str]) -> list[str]:
    """
    Filter a tag list down to only the three priority megatrend tags.

    Examples
    --------
    >>> get_priority_megatrend_tags(["ai", "semiconductors", "defense"])
    ['ai']
    """
    return [t for t in tags if t in PRIORITY_MEGATRENDS]
