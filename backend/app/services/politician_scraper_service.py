"""
Async wrapper around Quiver Quantitative congressional trading API.
Fetches and caches recent disclosures; parses them into PoliticianTrade objects.
"""
from __future__ import annotations

import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional

import requests

logger = logging.getLogger(__name__)

QUIVER_URL = "https://api.quiverquant.com/beta/live/congresstrading"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}
_CACHE_TTL = 300  # 5 minutes
_cache_trades: list["PoliticianTrade"] = []
_cache_time: float = 0.0


@dataclass
class PoliticianTrade:
    trade_id: str
    politician_id: str
    politician_name: str
    ticker: str
    asset_type: str      # "stock" | "etf" | "option"
    trade_type: str      # "buy" | "sell"
    trade_date: Optional[date]
    disclosure_date: Optional[date]
    amount_low: float
    amount_high: float
    comment: str = ""
    option_type: Optional[str] = None
    option_strike: Optional[float] = None
    option_expiry: Optional[str] = None
    excess_return: Optional[float] = None
    price_change: Optional[float] = None


def _parse_date(s: str) -> Optional[date]:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _parse_range(range_str: str, amount_str: str) -> tuple[float, float]:
    if range_str:
        clean = re.sub(r"[$,]", "", range_str)
        parts = re.split(r"\s*[-–]\s*", clean.strip())
        try:
            if len(parts) == 2:
                return float(parts[0]), float(parts[1])
            if len(parts) == 1:
                v = float(parts[0])
                return v, v
        except ValueError:
            pass
    try:
        v = float(amount_str or 0)
        return v, v
    except ValueError:
        return 0.0, 0.0


def _build_trade_id(rec: dict) -> str:
    politician_id = rec.get("BioGuideID") or (rec.get("Representative") or "").lower().replace(" ", "-")
    ticker = (rec.get("Ticker") or "").strip().upper()
    tx_date = rec.get("TransactionDate", "")
    trade_type = "buy" if "purchase" in (rec.get("Transaction") or "").lower() else "sell"
    return f"{politician_id}_{ticker}_{tx_date}_{trade_type}"


def _parse_quiver_record(rec: dict) -> Optional[PoliticianTrade]:
    ticker = (rec.get("Ticker") or "").strip().upper()
    if not ticker or ticker in ("N/A", "--", ""):
        return None

    politician_name = rec.get("Representative") or "Unknown"
    politician_id = rec.get("BioGuideID") or politician_name.lower().replace(" ", "-")

    trade_type = "buy" if "purchase" in (rec.get("Transaction") or "").lower() else "sell"

    ticker_type = (rec.get("TickerType") or "stock").lower()
    if "option" in ticker_type:
        asset_type = "option"
    elif "etf" in ticker_type:
        asset_type = "etf"
    else:
        asset_type = "stock"

    amount_low, amount_high = _parse_range(
        rec.get("Range") or "", rec.get("Amount") or ""
    )

    description = rec.get("Description") or ""
    option_type = option_strike = option_expiry = None
    if asset_type == "option" and description:
        cp = re.search(r"\b(call|put)\b", description, re.IGNORECASE)
        if cp:
            option_type = cp.group(1).lower()
        strike = re.search(r"strike\s*\$?([\d.]+)", description, re.IGNORECASE)
        if strike:
            option_strike = float(strike.group(1))
        exp = re.search(r"exp(?:iry|iration)?[:\s]*([\d/\-]+)", description, re.IGNORECASE)
        if exp:
            option_expiry = exp.group(1)

    return PoliticianTrade(
        trade_id=_build_trade_id(rec),
        politician_id=politician_id,
        politician_name=politician_name,
        ticker=ticker,
        asset_type=asset_type,
        trade_type=trade_type,
        trade_date=_parse_date(rec.get("TransactionDate") or ""),
        disclosure_date=_parse_date(rec.get("ReportDate") or ""),
        amount_low=amount_low,
        amount_high=amount_high,
        comment=description,
        option_type=option_type,
        option_strike=option_strike,
        option_expiry=option_expiry,
        excess_return=rec.get("ExcessReturn"),
        price_change=rec.get("PriceChange"),
    )


def _fetch_raw() -> list[PoliticianTrade]:
    """Synchronous Quiver Quant fetch. Returns stale cache on error."""
    global _cache_trades, _cache_time
    try:
        resp = requests.get(QUIVER_URL, headers=_HEADERS, timeout=20)
        resp.raise_for_status()
        records = resp.json()
    except Exception as exc:
        logger.error("Quiver Quant fetch failed: %s", exc)
        return _cache_trades  # return stale cache

    trades = [t for rec in records if (t := _parse_quiver_record(rec)) is not None]
    _cache_trades = trades
    _cache_time = time.time()
    logger.info("Loaded %d congressional trades from Quiver Quant", len(trades))
    return trades


async def fetch_congressional_trades(force: bool = False) -> list[PoliticianTrade]:
    """Async wrapper around _fetch_raw(). Caches results for 5 minutes."""
    global _cache_trades, _cache_time
    if not force and _cache_trades and (time.time() - _cache_time) < _CACHE_TTL:
        logger.debug("Returning cached congressional trades (%d)", len(_cache_trades))
        return _cache_trades
    return await asyncio.to_thread(_fetch_raw)


def get_politician_trades(
    politician_id: str,
    all_trades: list[PoliticianTrade],
) -> list[PoliticianTrade]:
    """Filter all_trades to those belonging to the given politician (by BioGuideID)."""
    pid_lower = politician_id.lower()
    return [
        t for t in all_trades
        if t.politician_id.lower() == pid_lower
        or t.politician_name.lower().replace(" ", "-") == pid_lower
    ]
