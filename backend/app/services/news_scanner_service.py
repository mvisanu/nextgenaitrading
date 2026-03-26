"""
News scanner service — V3 auto-idea engine source 1.

Fetches five free RSS feeds, extracts headlines, and matches mentioned
tickers and themes against the supported universe.  No paid API keys required.

Fallback: any individual feed that fails is skipped silently; the scan
continues with the remaining feeds.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import feedparser
import httpx

logger = logging.getLogger(__name__)

# ── RSS feed sources (free, no API key) ──────────────────────────────────────
NEWS_SOURCES: list[str] = [
    "https://feeds.finance.yahoo.com/rss/2.0/headline",
    "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "https://rss.cnn.com/rss/money_markets.rss",
    "https://feeds.federalreserve.gov/feeds/press_all.xml",
    "https://www.eia.gov/rss/news.xml",
    # Crypto / Bitcoin sources
    "https://cointelegraph.com/rss",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "https://decrypt.co/feed",
    "https://bitcoinmagazine.com/.rss/full/",
]

# Recognised ticker symbols — used in headline scanning
KNOWN_TICKERS: set[str] = {
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
    "JPM", "BAC", "GS", "V", "MA",
    "ETN", "NEE", "XOM", "CVX",
    "LMT", "RTX", "NOC", "GD",
    "AMD", "INTC", "AVGO", "TSM", "AMAT", "ASML",
    "ASTS", "RKLB",
    "LLY", "NVO", "REGN", "CRSP", "ILMN",
    "PLTR", "ISRG",
    # Crypto-adjacent stocks & crypto symbols
    "COIN", "MSTR", "MARA", "RIOT", "IBIT", "HOOD",
    "BTC", "ETH", "SOL", "XRP", "ADA", "DOGE",
}

# Company name → ticker mapping for fuzzy headline matching
COMPANY_NAME_MAP: dict[str, str] = {
    "apple": "AAPL",
    "microsoft": "MSFT",
    "google": "GOOGL",
    "alphabet": "GOOGL",
    "amazon": "AMZN",
    "nvidia": "NVDA",
    "meta": "META",
    "tesla": "TSLA",
    "jpmorgan": "JPM",
    "goldman": "GS",
    "visa": "V",
    "mastercard": "MA",
    "lockheed": "LMT",
    "raytheon": "RTX",
    "northrop": "NOC",
    "palantir": "PLTR",
    "eli lilly": "LLY",
    "novo nordisk": "NVO",
    "regeneron": "REGN",
    "crispr": "CRSP",
    "illumina": "ILMN",
    "intuitive surgical": "ISRG",
    "rocket lab": "RKLB",
    "amd": "AMD",
    "intel": "INTC",
    "broadcom": "AVGO",
    "tsmc": "TSM",
    "asml": "ASML",
    # Crypto
    "bitcoin": "BTC",
    "btc": "BTC",
    "ethereum": "ETH",
    "ether": "ETH",
    "solana": "SOL",
    "ripple": "XRP",
    "dogecoin": "DOGE",
    "cardano": "ADA",
    "coinbase": "COIN",
    "microstrategy": "MSTR",
    "strategy": "MSTR",
    "marathon digital": "MARA",
    "marathon holdings": "MARA",
    "riot platforms": "RIOT",
    "robinhood": "HOOD",
}

# Theme keyword sets
THEME_KEYWORDS: dict[str, set[str]] = {
    "ai": {"artificial intelligence", "ai model", "machine learning", "large language", "llm",
           "generative ai", "neural network", "gpu", "data center", "foundation model"},
    "robotics": {"robot", "humanoid", "autonomous vehicle", "self-driving", "autopilot",
                 "drone", "automation", "industrial robot"},
    "longevity": {"biotech", "genomics", "gene therapy", "anti-aging", "longevity", "precision medicine",
                  "glp-1", "obesity drug", "cancer treatment", "immunotherapy"},
    "semiconductors": {"semiconductor", "chip", "wafer", "foundry", "lithography", "fab"},
    "defense": {"defense contract", "pentagon", "military", "aerospace", "weapon system"},
    "energy": {"energy policy", "renewable", "oil", "natural gas", "electric grid", "nuclear"},
    "crypto": {"bitcoin", "btc", "ethereum", "eth", "crypto", "blockchain", "defi",
               "stablecoin", "nft", "web3", "mining", "halving", "altcoin", "memecoin",
               "binance", "coinbase", "solana", "cardano", "ripple", "dogecoin"},
}

# Compiled pattern to extract $TICKER or "TICKER stock" mentions
_DOLLAR_TICKER_RE = re.compile(r"\$([A-Z]{1,5})\b")
_STOCK_TICKER_RE = re.compile(r"\b([A-Z]{2,5})\s+(?:stock|shares?|equity)\b")


@dataclass
class NewsItem:
    headline: str
    source: str
    published_at: Optional[datetime]
    url: str
    snippet: str
    tickers_mentioned: list[str] = field(default_factory=list)
    theme_tags: list[str] = field(default_factory=list)
    relevance_score: float = 0.0


def _parse_published(entry) -> Optional[datetime]:
    """Extract published datetime from a feedparser entry."""
    try:
        import time as _time
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            return datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
        if hasattr(entry, "updated_parsed") and entry.updated_parsed:
            return datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
    except Exception:
        pass
    return None


def _extract_tickers(text: str) -> list[str]:
    """Find ticker symbols mentioned in text via $TICKER or name matching."""
    found: set[str] = set()
    upper_text = text.upper()

    # $TICKER pattern
    for m in _DOLLAR_TICKER_RE.finditer(upper_text):
        sym = m.group(1)
        if sym in KNOWN_TICKERS:
            found.add(sym)

    # "TICKER stock" pattern
    for m in _STOCK_TICKER_RE.finditer(upper_text):
        sym = m.group(1)
        if sym in KNOWN_TICKERS:
            found.add(sym)

    # Company name lookup (case-insensitive)
    lower_text = text.lower()
    for name, ticker in COMPANY_NAME_MAP.items():
        if name in lower_text:
            found.add(ticker)

    return sorted(found)


def _extract_themes(text: str) -> list[str]:
    """Find theme tags matching keyword sets in the text."""
    lower = text.lower()
    found: list[str] = []
    for theme, keywords in THEME_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            found.append(theme)
    return found


def _score_relevance(tickers: list[str], themes: list[str]) -> float:
    """
    Simple relevance score: 0.3 per ticker + 0.2 per theme, capped at 1.0.
    """
    return min(1.0, len(tickers) * 0.3 + len(themes) * 0.2)


async def _fetch_feed(url: str) -> list[NewsItem]:
    """
    Fetch and parse a single RSS feed.  Returns [] on any failure.
    """
    items: list[NewsItem] = []
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers={"User-Agent": "NextGenStock/3.0 (+https://nextgenstock.app)"})
            response.raise_for_status()
            raw = response.text
    except Exception as exc:
        logger.warning("news_scanner: failed to fetch %s: %s", url, exc)
        return []

    try:
        parsed = feedparser.parse(raw)
    except Exception as exc:
        logger.warning("news_scanner: feedparser failed for %s: %s", url, exc)
        return []

    feed_name = getattr(parsed.feed, "title", url)

    for entry in parsed.entries[:30]:  # cap at 30 per feed
        headline = getattr(entry, "title", "") or ""
        snippet = getattr(entry, "summary", "") or ""
        link = getattr(entry, "link", "") or ""

        full_text = f"{headline} {snippet}"
        tickers = _extract_tickers(full_text)
        themes = _extract_themes(full_text)
        score = _score_relevance(tickers, themes)

        if score <= 0.0:
            continue  # skip items with no ticker or theme match

        items.append(NewsItem(
            headline=headline[:500],
            source=feed_name[:100],
            published_at=_parse_published(entry),
            url=link[:1000],
            snippet=snippet[:300],
            tickers_mentioned=tickers,
            theme_tags=themes,
            relevance_score=score,
        ))

    return items


async def scan_news() -> list[NewsItem]:
    """
    Fetch all configured RSS feeds and return matched news items,
    sorted by relevance_score descending.

    Fails gracefully: any individual feed that errors is skipped.
    The overall function never raises.

    Returns
    -------
    list[NewsItem]
        Up to ~150 relevant news items (30 per feed × 5 feeds).

    Examples
    --------
    >>> import asyncio
    >>> items = asyncio.run(scan_news())  # doctest: +SKIP
    >>> all(isinstance(i, NewsItem) for i in items)
    True
    """
    all_items: list[NewsItem] = []
    for url in NEWS_SOURCES:
        try:
            items = await _fetch_feed(url)
            all_items.extend(items)
        except Exception as exc:
            logger.error("news_scanner: unexpected error for %s: %s", url, exc)

    # Sort by relevance descending
    all_items.sort(key=lambda x: x.relevance_score, reverse=True)
    logger.info("news_scanner: fetched %d relevant items from %d feeds", len(all_items), len(NEWS_SOURCES))
    return all_items
