"""
V3 Auto-Idea Engine orchestrator.

Separate from the V2 idea_generator_service.py which powers
GET /api/scanner/ideas (in-process cache, composite_score formula).

This module orchestrates three independent sources and persists results
to the generated_ideas DB table — the V3 schema with full scoring.

Three sources:
  1. News scanner  — free RSS feed headlines with ticker mentions
  2. Theme scanner — tickers with high theme scores from DB
  3. Technical universe scanner — curated ~40-stock universe

idea_score formula (see PRD3.md Section 8):
  confidence_score         * 0.25
  megatrend_fit_score      * 0.20
  moat_score               * 0.15
  financial_quality_score  * 0.15
  technical_setup_score    * 0.15
  news_relevance_score     * 0.10
  + near_52w_low boost     +0.15 (if applicable)
  + at_weekly_support boost +0.10 (if applicable)
  capped at 1.0

LANGUAGE RULE: never imply guaranteed profits. Use "historically favorable",
"high-probability entry zone", "confidence score", "positive outcome rate".
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.generated_idea import GeneratedIdea
from app.models.theme_score import StockThemeScore
from app.services.buy_zone_service import get_or_calculate_buy_zone
from app.services.entry_priority_service import check_entry_priority
from app.services.financial_quality_service import score_financial_quality
from app.services.megatrend_filter_service import (
    compute_megatrend_fit_score,
    get_megatrend_tags,
    get_priority_megatrend_tags,
)
from app.services.moat_scoring_service import score_moat
from app.services.news_scanner_service import scan_news

logger = logging.getLogger(__name__)

# ── Scan universe ─────────────────────────────────────────────────────────────
SCAN_UNIVERSE: list[str] = [
    # Mega cap tech / AI
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    # Financials
    "JPM", "BAC", "GS", "V", "MA",
    # Energy + infrastructure
    "ETN", "NEE", "XOM", "CVX",
    # Defense + aerospace
    "LMT", "RTX", "NOC", "GD",
    # Semiconductors
    "AMD", "INTC", "AVGO", "TSM", "AMAT", "ASML",
    # Space + emerging
    "ASTS", "RKLB",
    # Longevity / biotech
    "LLY", "NVO", "REGN", "CRSP", "ILMN",
    # Defense + AI
    "PLTR",
    # Robotics / surgical
    "ISRG",
    # Healthcare / medicine
    "UNH", "JNJ", "PFE", "ABBV", "TMO", "ABT",
    # Bitcoin / crypto-adjacent
    "MSTR", "COIN", "MARA", "RIOT", "IBIT",
    # ETFs — excluded from idea generation
    "SPY", "QQQ", "IWM", "XLE", "XLK", "XLF",
]

UNIVERSE_CONTEXT_ONLY: set[str] = {"SPY", "QQQ", "IWM", "XLE", "XLK", "XLF"}
IDEA_UNIVERSE: list[str] = [t for t in SCAN_UNIVERSE if t not in UNIVERSE_CONTEXT_ONLY]

IDEA_EXPIRY_HOURS = 24
TOP_IDEAS_LIMIT = 50

# ── Static company name lookup ─────────────────────────────────────────────────
# Names for all ~44 IDEA_UNIVERSE tickers. Avoids per-ticker yf.Ticker().info calls.
_COMPANY_NAMES: dict[str, str] = {
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com Inc.",
    "NVDA": "NVIDIA Corporation",
    "META": "Meta Platforms Inc.",
    "TSLA": "Tesla Inc.",
    "JPM": "JPMorgan Chase & Co.",
    "BAC": "Bank of America Corporation",
    "GS": "The Goldman Sachs Group Inc.",
    "V": "Visa Inc.",
    "MA": "Mastercard Incorporated",
    "ETN": "Eaton Corporation",
    "NEE": "NextEra Energy Inc.",
    "XOM": "Exxon Mobil Corporation",
    "CVX": "Chevron Corporation",
    "LMT": "Lockheed Martin Corporation",
    "RTX": "RTX Corporation",
    "NOC": "Northrop Grumman Corporation",
    "GD": "General Dynamics Corporation",
    "AMD": "Advanced Micro Devices Inc.",
    "INTC": "Intel Corporation",
    "AVGO": "Broadcom Inc.",
    "TSM": "Taiwan Semiconductor Manufacturing Co.",
    "AMAT": "Applied Materials Inc.",
    "ASML": "ASML Holding N.V.",
    "ASTS": "AST SpaceMobile Inc.",
    "RKLB": "Rocket Lab USA Inc.",
    "LLY": "Eli Lilly and Company",
    "NVO": "Novo Nordisk A/S",
    "REGN": "Regeneron Pharmaceuticals Inc.",
    "CRSP": "CRISPR Therapeutics AG",
    "ILMN": "Illumina Inc.",
    "PLTR": "Palantir Technologies Inc.",
    "ISRG": "Intuitive Surgical Inc.",
    "UNH": "UnitedHealth Group Incorporated",
    "JNJ": "Johnson & Johnson",
    "PFE": "Pfizer Inc.",
    "ABBV": "AbbVie Inc.",
    "TMO": "Thermo Fisher Scientific Inc.",
    "ABT": "Abbott Laboratories",
    "MSTR": "MicroStrategy Incorporated",
    "COIN": "Coinbase Global Inc.",
    "MARA": "Marathon Digital Holdings Inc.",
    "RIOT": "Riot Platforms Inc.",
    "IBIT": "iShares Bitcoin Trust ETF",
}


@dataclass
class IdeaCandidate:
    ticker: str
    company_name: str
    source: str                 # "news" | "theme" | "technical"
    reason_summary: str
    current_price: float
    confidence_score: float
    technical_setup_score: float = 0.0
    news_relevance_score: float = 0.0
    megatrend_fit_score: float = 0.0
    moat_score: float = 0.0
    moat_description: str = ""
    financial_quality_score: float = 0.0
    financial_flags: list[str] = field(default_factory=list)
    theme_tags: list[str] = field(default_factory=list)
    megatrend_tags: list[str] = field(default_factory=list)
    near_52w_low: bool = False
    at_weekly_support: bool = False
    entry_priority: str = "STANDARD"
    buy_zone_low: Optional[float] = None
    buy_zone_high: Optional[float] = None
    ideal_entry_price: Optional[float] = None
    historical_win_rate_90d: Optional[float] = None
    news_headline: Optional[str] = None
    news_url: Optional[str] = None
    news_source: Optional[str] = None
    catalyst_type: Optional[str] = None
    idea_score: float = 0.0


def compute_idea_score(c: IdeaCandidate) -> float:
    """
    Compute the composite idea_score from all component scores.

    Formula (6 weighted components + entry priority boosts, capped at 1.0):
      confidence_score        * 0.25
      megatrend_fit_score     * 0.20
      moat_score              * 0.15
      financial_quality_score * 0.15
      technical_setup_score   * 0.15
      news_relevance_score    * 0.10
      + near_52w_low          +0.15 (additive)
      + at_weekly_support     +0.10 (additive)

    Examples
    --------
    >>> from dataclasses import dataclass
    >>> c = IdeaCandidate(ticker="NVDA", company_name="NVIDIA", source="technical",
    ...     reason_summary="test", current_price=500.0, confidence_score=0.8,
    ...     technical_setup_score=0.75, megatrend_fit_score=1.0,
    ...     moat_score=0.85, financial_quality_score=0.75, near_52w_low=True)
    >>> 0.0 <= compute_idea_score(c) <= 1.0
    True
    """
    base = (
        c.confidence_score * 0.25
        + c.megatrend_fit_score * 0.20
        + c.moat_score * 0.15
        + c.financial_quality_score * 0.15
        + c.technical_setup_score * 0.15
        + c.news_relevance_score * 0.10
    )
    boost = 0.0
    if c.near_52w_low:
        boost += 0.15
    if c.at_weekly_support:
        boost += 0.10
    return round(min(1.0, base + boost), 4)


def _compute_technical_setup_score(df: pd.DataFrame) -> float:
    """
    Score technical setup quality from a pre-loaded OHLCV DataFrame.

    Checks (each adds 0.25):
      1. Price above 50d MA
      2. Price above 200d MA
      3. RSI between 35–55
      4. Volume declining on pullback

    Returns
    -------
    float
        Score 0.0–1.0 (0.25 increments).

    Examples
    --------
    >>> import pandas as pd
    >>> import numpy as np
    >>> closes = pd.Series(100 + np.arange(300) * 0.1)
    >>> df = pd.DataFrame({"Close": closes, "High": closes*1.01, "Low": closes*0.99, "Volume": np.ones(300)*1e6})
    >>> 0.0 <= _compute_technical_setup_score(df) <= 1.0
    True
    """
    if len(df) < 50:
        return 0.5

    closes = df["Close"]
    current = float(closes.iloc[-1])

    def _ma(period: int) -> float:
        if len(closes) >= period:
            return float(closes.rolling(period).mean().iloc[-1])
        return float(closes.mean())

    delta = closes.diff()
    gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
    loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi_series = 100 - (100 / (1 + rs))
    rsi_val = float(rsi_series.iloc[-1]) if not rsi_series.isna().iloc[-1] else 50.0

    ma50 = _ma(50)
    ma200 = _ma(200)

    score = 0.0
    if current > ma50:
        score += 0.25
    if current > ma200:
        score += 0.25
    if 35 <= rsi_val <= 55:
        score += 0.25

    # Volume declining on pullback
    if "Volume" in df.columns and len(df) >= 12:
        vol = df["Volume"].values
        price_falling = closes.values[-1] < closes.values[-6]
        recent_vol = float(np.mean(vol[-5:]))
        prior_vol = float(np.mean(vol[-10:-5]))
        if price_falling and recent_vol < prior_vol * 1.05:
            score += 0.25

    return round(score, 4)


def _get_company_name(ticker: str) -> str:
    """Return company name from static lookup; fallback to ticker symbol."""
    return _COMPANY_NAMES.get(ticker.upper(), ticker)


async def _enrich_candidate(c: IdeaCandidate, db: AsyncSession) -> IdeaCandidate:
    """Add buy zone, moat, financial, entry priority data to a candidate."""
    try:
        snapshot, _ = await get_or_calculate_buy_zone(c.ticker, db, user_id=None, max_age_minutes=240)
        c.confidence_score = float(snapshot.confidence_score)
        c.current_price = float(snapshot.current_price)
        c.buy_zone_low = float(snapshot.buy_zone_low)
        c.buy_zone_high = float(snapshot.buy_zone_high)
        c.ideal_entry_price = round((c.buy_zone_low + c.buy_zone_high) / 2, 4)
        c.historical_win_rate_90d = float(snapshot.positive_outcome_rate_90d)
    except Exception as exc:
        logger.debug("enrich_candidate: buy zone unavailable for %s: %s", c.ticker, exc)

    moat = score_moat(c.ticker)
    c.moat_score = moat.score
    c.moat_description = moat.description

    fin = score_financial_quality(c.ticker)
    c.financial_quality_score = fin.score
    c.financial_flags = fin.flags

    ep = check_entry_priority(c.ticker)
    c.near_52w_low = ep.near_52w_low
    c.at_weekly_support = ep.at_weekly_support
    c.entry_priority = ep.entry_priority

    return c


async def _scan_news_source(db: AsyncSession) -> list[IdeaCandidate]:
    """Source 1: convert relevant news items into idea candidates."""
    try:
        news_items = await scan_news()
    except Exception as exc:
        logger.error("v3_idea_generator: news scan failed: %s", exc)
        return []

    candidates: dict[str, IdeaCandidate] = {}
    for item in news_items:
        for ticker in item.tickers_mentioned:
            if ticker not in IDEA_UNIVERSE:
                continue

            tags = get_megatrend_tags(ticker)
            all_tags = list(set(tags + item.theme_tags))
            mega_fit = compute_megatrend_fit_score(all_tags)
            megatrend = get_priority_megatrend_tags(all_tags)

            if ticker in candidates:
                existing = candidates[ticker]
                if item.relevance_score > existing.news_relevance_score:
                    existing.news_relevance_score = item.relevance_score
                    existing.news_headline = item.headline
                    existing.news_url = item.url
                    existing.news_source = item.source
                existing.theme_tags = list(set(existing.theme_tags + all_tags))
            else:
                company_name = _get_company_name(ticker)
                c = IdeaCandidate(
                    ticker=ticker,
                    company_name=company_name,
                    source="news",
                    reason_summary=f"News catalyst: {item.headline[:200]}",
                    current_price=0.0,
                    confidence_score=0.5,
                    news_relevance_score=item.relevance_score,
                    megatrend_fit_score=mega_fit,
                    theme_tags=all_tags,
                    megatrend_tags=megatrend,
                    news_headline=item.headline,
                    news_url=item.url,
                    news_source=item.source,
                    catalyst_type="policy" if any(k in item.source.lower() for k in ("fed", "eia")) else "earnings",
                )
                candidates[ticker] = c

    # Enrich with buy zone + quality scores
    results: list[IdeaCandidate] = []
    for c in candidates.values():
        c = await _enrich_candidate(c, db)
        c.idea_score = compute_idea_score(c)
        results.append(c)

    return results


async def _scan_theme_source(
    db: AsyncSession,
    df_cache: dict[str, pd.DataFrame],
) -> list[IdeaCandidate]:
    """Source 2: tickers with high theme scores from DB."""
    theme_result = await db.execute(
        select(StockThemeScore).where(StockThemeScore.theme_score_total >= 0.60)
    )
    theme_rows = list(theme_result.scalars().all())
    candidates: list[IdeaCandidate] = []

    for ts in theme_rows:
        ticker = ts.ticker
        if ticker in UNIVERSE_CONTEXT_ONLY or ticker not in IDEA_UNIVERSE:
            continue
        try:
            snapshot, _ = await get_or_calculate_buy_zone(ticker, db, user_id=None, max_age_minutes=240)
            if float(snapshot.entry_quality_score) < 0.55 or float(snapshot.confidence_score) < 0.60:
                continue

            tags = get_megatrend_tags(ticker)
            db_tags = list(ts.tags_json or []) if hasattr(ts, "tags_json") else []
            all_tags = list(set(tags + db_tags))
            mega_fit = compute_megatrend_fit_score(all_tags)
            megatrend = get_priority_megatrend_tags(all_tags)

            if ticker not in df_cache:
                df_raw = yf.download(ticker, period="1y", interval="1d", auto_adjust=True, progress=False)
                if isinstance(df_raw.columns, pd.MultiIndex):
                    df_raw.columns = df_raw.columns.get_level_values(0)
                df_cache[ticker] = df_raw.dropna()
            df_raw = df_cache[ticker]
            tech_score = _compute_technical_setup_score(df_raw)

            c = IdeaCandidate(
                ticker=ticker,
                company_name=_get_company_name(ticker),
                source="theme",
                reason_summary=f"Theme score {float(ts.theme_score_total):.0%} — strong thematic tailwind.",
                current_price=float(snapshot.current_price),
                confidence_score=float(snapshot.confidence_score),
                technical_setup_score=tech_score,
                megatrend_fit_score=mega_fit,
                theme_tags=all_tags,
                megatrend_tags=megatrend,
                buy_zone_low=float(snapshot.buy_zone_low),
                buy_zone_high=float(snapshot.buy_zone_high),
                ideal_entry_price=round((float(snapshot.buy_zone_low) + float(snapshot.buy_zone_high)) / 2, 4),
                historical_win_rate_90d=float(snapshot.positive_outcome_rate_90d),
                catalyst_type="sector_rotation",
            )
            c = await _enrich_candidate(c, db)
            c.idea_score = compute_idea_score(c)
            candidates.append(c)
        except Exception as exc:
            logger.warning("v3_idea_generator: theme scan failed for %s: %s", ticker, exc)

    return candidates


async def _scan_technical_source(
    db: AsyncSession,
    df_cache: dict[str, pd.DataFrame],
) -> list[IdeaCandidate]:
    """Source 3: curated universe — 3 of 4 technical conditions must pass."""
    candidates: list[IdeaCandidate] = []
    for ticker in IDEA_UNIVERSE:
        try:
            if ticker not in df_cache:
                df_raw = yf.download(ticker, period="1y", interval="1d", auto_adjust=True, progress=False)
                if isinstance(df_raw.columns, pd.MultiIndex):
                    df_raw.columns = df_raw.columns.get_level_values(0)
                df_cache[ticker] = df_raw.dropna()
            df_raw = df_cache[ticker]

            tech_score = _compute_technical_setup_score(df_raw)
            if tech_score < 0.75:   # require 3/4 conditions
                continue

            tags = get_megatrend_tags(ticker)
            mega_fit = compute_megatrend_fit_score(tags)
            megatrend = get_priority_megatrend_tags(tags)

            current_price = float(df_raw["Close"].iloc[-1]) if len(df_raw) > 0 else 0.0

            c = IdeaCandidate(
                ticker=ticker,
                company_name=_get_company_name(ticker),
                source="technical",
                reason_summary=f"Strong technical setup ({tech_score:.0%} conditions passing).",
                current_price=current_price,
                confidence_score=0.5,
                technical_setup_score=tech_score,
                megatrend_fit_score=mega_fit,
                theme_tags=tags,
                megatrend_tags=megatrend,
                catalyst_type="technical",
            )
            c = await _enrich_candidate(c, db)
            c.idea_score = compute_idea_score(c)
            candidates.append(c)
        except Exception as exc:
            logger.warning("v3_idea_generator: technical scan failed for %s: %s", ticker, exc)

    return candidates


async def run_idea_generator(db: AsyncSession) -> list[GeneratedIdea]:
    """
    Orchestrate all three idea sources, deduplicate, score, and persist top N ideas.

    Steps
    -----
    1. Run news_scanner_service.scan_news() (Source 1)
    2. Run _scan_theme_source() (Source 2)
    3. Run _scan_technical_source() (Source 3)
    4. Deduplicate: merge same-ticker candidates from multiple sources
    5. Rank by idea_score desc and take top 50
    6. Delete previous batch from generated_ideas; persist new batch
    7. Return persisted rows

    The function is idempotent — each call replaces the full batch.

    Parameters
    ----------
    db:
        Async SQLAlchemy session (from AsyncSessionLocal in scheduler context).

    Returns
    -------
    list[GeneratedIdea]
        The newly persisted idea rows.
    """
    logger.info("run_idea_generator: starting full scan")
    now_utc = datetime.now(timezone.utc)
    expires_at = now_utc + timedelta(hours=IDEA_EXPIRY_HOURS)

    # Pre-populate shared OHLCV cache for all IDEA_UNIVERSE tickers.
    # Both theme and technical scanners share this dict; each ticker is
    # downloaded at most once, cutting ~80 duplicate yfinance HTTP calls.
    _df_cache: dict[str, pd.DataFrame] = {}
    logger.info("run_idea_generator: pre-loading OHLCV for %d tickers", len(IDEA_UNIVERSE))
    for ticker in IDEA_UNIVERSE:
        try:
            df_raw = yf.download(ticker, period="1y", interval="1d", auto_adjust=True, progress=False)
            if isinstance(df_raw.columns, pd.MultiIndex):
                df_raw.columns = df_raw.columns.get_level_values(0)
            _df_cache[ticker] = df_raw.dropna()
        except Exception as exc:
            logger.debug("run_idea_generator: OHLCV pre-load failed for %s: %s", ticker, exc)

    news_candidates = await _scan_news_source(db)
    theme_candidates = await _scan_theme_source(db, _df_cache)
    tech_candidates = await _scan_technical_source(db, _df_cache)

    # Deduplicate — merge by ticker, keep best scores
    merged: dict[str, IdeaCandidate] = {}
    for c in news_candidates + theme_candidates + tech_candidates:
        if c.ticker not in merged:
            merged[c.ticker] = c
        else:
            existing = merged[c.ticker]
            if c.source != existing.source:
                sources = sorted({existing.source, c.source})
                existing.reason_summary = (
                    f"[{'/'.join(s.capitalize() for s in sources)}] {existing.reason_summary}"
                )
                if c.news_headline and not existing.news_headline:
                    existing.news_headline = c.news_headline
                    existing.news_url = c.news_url
                    existing.news_source = c.news_source
            # Keep higher technical score
            existing.technical_setup_score = max(existing.technical_setup_score, c.technical_setup_score)
            existing.news_relevance_score = max(existing.news_relevance_score, c.news_relevance_score)
            existing.idea_score = compute_idea_score(existing)

    ranked = sorted(merged.values(), key=lambda x: x.idea_score, reverse=True)[:TOP_IDEAS_LIMIT]

    # Replace previous batch
    all_existing = await db.execute(select(GeneratedIdea))
    for old in all_existing.scalars().all():
        await db.delete(old)
    await db.flush()

    saved: list[GeneratedIdea] = []
    for c in ranked:
        row = GeneratedIdea(
            ticker=c.ticker,
            company_name=c.company_name,
            source=c.source,
            reason_summary=c.reason_summary,
            news_headline=c.news_headline,
            news_url=c.news_url,
            news_source=c.news_source,
            catalyst_type=c.catalyst_type,
            current_price=c.current_price,
            buy_zone_low=c.buy_zone_low,
            buy_zone_high=c.buy_zone_high,
            ideal_entry_price=c.ideal_entry_price,
            confidence_score=c.confidence_score,
            historical_win_rate_90d=c.historical_win_rate_90d,
            theme_tags=c.theme_tags,
            megatrend_tags=c.megatrend_tags,
            moat_score=c.moat_score,
            moat_description=c.moat_description,
            financial_quality_score=c.financial_quality_score,
            financial_flags=c.financial_flags,
            near_52w_low=c.near_52w_low,
            at_weekly_support=c.at_weekly_support,
            entry_priority=c.entry_priority,
            idea_score=c.idea_score,
            generated_at=now_utc,
            expires_at=expires_at,
            added_to_watchlist=False,
        )
        db.add(row)
        saved.append(row)

    await db.commit()
    for row in saved:
        await db.refresh(row)

    logger.info(
        "run_idea_generator: saved %d ideas (news=%d theme=%d technical=%d merged=%d)",
        len(saved),
        sum(1 for c in ranked if c.source == "news"),
        sum(1 for c in ranked if c.source == "theme"),
        sum(1 for c in ranked if c.source == "technical"),
        len(merged),
    )
    return saved
