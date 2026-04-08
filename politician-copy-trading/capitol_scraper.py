"""
Congress trade data via Quiver Quantitative's free API.
Endpoint: https://api.quiverquant.com/beta/live/congresstrading
Returns up to 1000 most recent trades with ExcessReturn vs SPY included.
"""
import logging
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

import requests

import config

logger = logging.getLogger(__name__)

QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"
QUIVER_POLITICIAN_URL = "https://api.quiverquant.com/beta/historical/congresstrading/{ticker}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)


@dataclass
class PoliticianTrade:
    trade_id: str
    politician_id: str        # BioGuideID
    politician_name: str
    ticker: str
    asset_type: str           # "stock", "option", "etf"
    trade_type: str           # "buy" or "sell"
    trade_date: date
    disclosure_date: date
    amount_low: float
    amount_high: float
    comment: str = ""
    option_type: Optional[str] = None
    option_strike: Optional[float] = None
    option_expiry: Optional[str] = None
    excess_return: Optional[float] = None   # % vs SPY (from Quiver)
    price_change: Optional[float] = None    # raw % price change


def _parse_date(s: str) -> date:
    if not s:
        return date.today()
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(s[:10], fmt[:len(s[:10])]).date()
        except ValueError:
            continue
    return date.today()


def _parse_range(range_str: str, amount_str: str) -> tuple[float, float]:
    """Parse '$1,001 - $15,000' → (1001, 15000). Falls back to Amount field."""
    import re
    if range_str:
        clean = re.sub(r"[$,]", "", range_str)
        parts = re.split(r"\s*[-–+]\s*", clean.strip())
        try:
            if len(parts) == 2:
                return float(parts[0]), float(parts[1])
            elif len(parts) == 1:
                v = float(parts[0])
                return v, v
        except ValueError:
            pass
    try:
        v = float(amount_str or 0)
        return v, v
    except ValueError:
        return 0.0, 0.0


def _normalize_type(transaction: str) -> str:
    """'Purchase' → 'buy', 'Sale (Full)' → 'sell'"""
    t = (transaction or "").lower()
    if "purchase" in t or "buy" in t:
        return "buy"
    return "sell"


def _normalize_asset(ticker_type: str) -> str:
    t = (ticker_type or "stock").lower()
    if "option" in t:
        return "option"
    if "etf" in t:
        return "etf"
    return "stock"


def _record_to_trade(rec: dict) -> Optional[PoliticianTrade]:
    ticker = (rec.get("Ticker") or "").strip().upper()
    if not ticker or ticker in ("N/A", "--", ""):
        return None

    politician_name = rec.get("Representative") or "Unknown"
    politician_id = rec.get("BioGuideID") or politician_name.lower().replace(" ", "-")

    trade_date = _parse_date(rec.get("TransactionDate") or "")
    disclosure_date = _parse_date(rec.get("ReportDate") or "")
    trade_type = _normalize_type(rec.get("Transaction") or "")
    asset_type = _normalize_asset(rec.get("TickerType") or "")
    amount_low, amount_high = _parse_range(rec.get("Range") or "", rec.get("Amount") or "")

    # Build a stable trade_id from bioguide + ticker + transaction date
    trade_id = f"{politician_id}_{ticker}_{rec.get('TransactionDate', '')}_{trade_type}"

    import re
    description = rec.get("Description") or ""
    option_type = None
    option_strike = None
    option_expiry = None
    if asset_type == "option" and description:
        cp = re.search(r"\b(call|put)\b", description, re.IGNORECASE)
        if cp:
            option_type = cp.group(1).lower()
        strike = re.search(r"\$?([\d.]+)\s*strike", description, re.IGNORECASE)
        if strike:
            option_strike = float(strike.group(1))
        exp = re.search(r"exp(?:iry|iration)?[:\s]*([\d/\-]+)", description, re.IGNORECASE)
        if exp:
            option_expiry = exp.group(1)

    return PoliticianTrade(
        trade_id=trade_id,
        politician_id=politician_id,
        politician_name=politician_name,
        ticker=ticker,
        asset_type=asset_type,
        trade_type=trade_type,
        trade_date=trade_date,
        disclosure_date=disclosure_date,
        amount_low=amount_low,
        amount_high=amount_high,
        comment=description,
        option_type=option_type,
        option_strike=option_strike,
        option_expiry=option_expiry,
        excess_return=rec.get("ExcessReturn"),
        price_change=rec.get("PriceChange"),
    )


# Cache to avoid hammering the API
_cache_trades: list[PoliticianTrade] = []
_cache_time: float = 0.0
_CACHE_TTL = 300  # 5 minutes


def fetch_all_recent_trades(force: bool = False) -> list[PoliticianTrade]:
    """
    Fetch up to 1000 most recent congressional trades from Quiver Quant.
    Caches for 5 minutes.
    """
    global _cache_trades, _cache_time

    if not force and _cache_trades and (time.time() - _cache_time) < _CACHE_TTL:
        logger.debug("Returning cached trades")
        return _cache_trades

    logger.info("Fetching congressional trades from Quiver Quant...")
    try:
        resp = SESSION.get(QUIVER_URL, timeout=20)
        resp.raise_for_status()
        records = resp.json()
    except Exception as e:
        logger.error(f"Quiver Quant fetch failed: {e}")
        return _cache_trades  # return stale cache if available

    trades = []
    for rec in records:
        t = _record_to_trade(rec)
        if t:
            trades.append(t)

    _cache_trades = trades
    _cache_time = time.time()
    logger.info(f"Loaded {len(trades)} trades from Quiver Quant")
    return trades


def fetch_recent_trades(page: int = 1, page_size: int = 96) -> list[PoliticianTrade]:
    """Compatibility shim — returns a slice of the full trade list."""
    all_trades = fetch_all_recent_trades()
    start = (page - 1) * page_size
    return all_trades[start: start + page_size]


def fetch_politician_trades(
    politician_id: str,
    days_back: int = 90,
) -> list[PoliticianTrade]:
    """
    Return trades for a specific politician (by BioGuideID or name slug)
    within the lookback window.
    """
    cutoff = date.today() - timedelta(days=days_back)
    all_trades = fetch_all_recent_trades()

    # Match by BioGuideID or by normalized name
    slug = politician_id.lower().replace("-", " ").replace("_", " ")
    result = []
    for t in all_trades:
        match_id = t.politician_id.lower() == politician_id.lower()
        match_name = t.politician_name.lower() == slug
        if (match_id or match_name) and t.disclosure_date >= cutoff:
            result.append(t)

    if not result:
        logger.warning(f"No trades found for politician_id='{politician_id}' in last {days_back}d")

    return result


def fetch_top_politicians(max_pages: int = 3) -> list[dict]:
    """
    Aggregate the trade list into per-politician summaries sorted by activity.
    """
    all_trades = fetch_all_recent_trades()
    politicians: dict[str, dict] = {}

    for t in all_trades:
        pid = t.politician_id
        if pid not in politicians:
            politicians[pid] = {
                "id": pid,
                "name": t.politician_name,
                "recent_trades": 0,
            }
        politicians[pid]["recent_trades"] += 1

    result = sorted(politicians.values(), key=lambda p: p["recent_trades"], reverse=True)
    logger.info(f"Found {len(result)} politicians with recent trades")
    return result
