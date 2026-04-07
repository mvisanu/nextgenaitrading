"""
Capitol Trades API client.

Capitol Trades exposes a public JSON API at https://api.capitoltrades.com.
We use it to:
  1. List politicians ranked by trade count (for selection)
  2. Fetch recent trades for a specific politician

All network calls use httpx with a 15-second timeout.
Called from the APScheduler sync task via asyncio.run(), so these are synchronous.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.schemas.congress_trade import CapitolTradeEntry, PoliticianSummary

logger = logging.getLogger(__name__)

_BASE = "https://api.capitoltrades.com"
_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "NextGenTrading/1.0 (educational use)",
}
_TIMEOUT = 15


def _get(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """GET request to Capitol Trades. Raises on HTTP error."""
    url = f"{_BASE}{path}"
    # New client per call: runs from APScheduler thread, calls are not concurrent
    with httpx.Client(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


def _parse_option_type(asset_name: str | None) -> Optional[str]:
    """Extract 'call' or 'put' from asset description strings like 'Call Option'."""
    if not asset_name:
        return None
    lower = asset_name.lower()
    if "call" in lower:
        return "call"
    if "put" in lower:
        return "put"
    return None


def _parse_trade(
    raw: dict[str, Any], politician_id: str, politician_name: str
) -> CapitolTradeEntry:
    """
    Parse a single raw trade record from the Capitol Trades API.

    Field names observed from the Capitol Trades public API:
      raw["_id"] or raw["id"]          → unique trade ID
      raw["politician"]                → {id, name, fullName}
      raw["asset"]                     → {assetTicker, ticker, assetType, instrumentType, assetName, name}
      raw["type"]                      → "purchase" | "sale" | "sale (partial)"
      raw["size"]                      → "$1,001-$15,000"
      raw["reportedAt"]                → "2024-01-15"
      raw["txDate"] or raw["tradeDate"] → "2024-01-10"
    """
    asset = raw.get("asset") or {}
    ticker = (
        asset.get("assetTicker")
        or asset.get("ticker")
        or raw.get("ticker")
        or ""
    ).strip().upper()

    asset_type_raw = (
        asset.get("assetType")
        or asset.get("instrumentType")
        or raw.get("assetType")
        or ""
    ).lower()

    asset_name = asset.get("assetName") or asset.get("name") or ""

    if "option" in asset_type_raw or "call" in asset_name.lower() or "put" in asset_name.lower():
        resolved_asset_type = "option"
    elif "etf" in asset_type_raw:
        resolved_asset_type = "etf"
    else:
        resolved_asset_type = "stock"

    trade_type_raw = (raw.get("type") or "").lower()
    trade_type = "purchase" if ("purchase" in trade_type_raw or "buy" in trade_type_raw) else "sale"

    return CapitolTradeEntry(
        id=str(raw.get("_id") or raw.get("id") or ""),
        politician_id=politician_id,
        politician_name=politician_name,
        ticker=ticker,
        asset_name=asset_name or None,
        asset_type=resolved_asset_type,
        option_type=_parse_option_type(asset_name),
        trade_type=trade_type,
        size_range=raw.get("size") or None,
        trade_date=raw.get("txDate") or raw.get("tradeDate") or None,
        reported_at=raw.get("reportedAt") or None,
    )


def fetch_politicians(page_size: int = 50) -> list[PoliticianSummary]:
    """
    Return politicians sorted by total trade count (most active first).
    Returns [] if the API is unavailable.
    """
    try:
        data = _get(
            "/politicians",
            params={
                "pageSize": page_size,
                "orderBy": "totalTradeCount",
                "orderDirection": "DESC",
            },
        )
    except Exception as exc:
        logger.error("fetch_politicians: request failed: %s", exc)
        return []

    results: list[PoliticianSummary] = []
    for item in data.get("data") or []:
        pol_id = str(item.get("id") or item.get("_id") or "")
        if not pol_id:
            continue
        results.append(
            PoliticianSummary(
                id=pol_id,
                name=item.get("name") or item.get("fullName") or pol_id,
                party=item.get("party") or None,
                chamber=item.get("chamber") or None,
                state=item.get("state") or None,
                trade_count_90d=int(
                    item.get("totalTradeCount") or item.get("tradeCount") or 0
                ),
            )
        )
    results.sort(key=lambda p: p.trade_count_90d, reverse=True)
    return results


def fetch_trades_for_politician(
    politician_id: str,
    page_size: int = 50,
    since_date: Optional[str] = None,
) -> list[CapitolTradeEntry]:
    """
    Fetch most-recent trades for a politician.
    since_date (YYYY-MM-DD): filter to trades reported on or after this date.
    Returns [] on API failure (logged, not raised).
    """
    params: dict[str, Any] = {
        "pageSize": page_size,
        "politician": politician_id,
        "orderBy": "reportedAt",
        "orderDirection": "DESC",
    }
    if since_date:
        params["reportedAt_gte"] = since_date

    try:
        data = _get("/trades", params=params)
    except Exception as exc:
        logger.error(
            "fetch_trades_for_politician(%s): request failed: %s", politician_id, exc
        )
        return []

    entries: list[CapitolTradeEntry] = []
    for raw in data.get("data") or []:
        pol = raw.get("politician") or {}
        pol_id = str(pol.get("id") or pol.get("_id") or politician_id)
        pol_name = pol.get("name") or pol.get("fullName") or politician_id
        try:
            entry = _parse_trade(raw, pol_id, pol_name)
            if entry.ticker:
                entries.append(entry)
            else:
                logger.warning(
                    "fetch_trades_for_politician(%s): skipping trade with no ticker | raw=%s",
                    politician_id,
                    raw,
                )
        except Exception as exc:
            logger.warning(
                "fetch_trades_for_politician: parse error: %s | raw=%s", exc, raw
            )

    if since_date:
        entries = [
            e for e in entries
            if e.reported_at and e.reported_at >= since_date
        ]
    return entries


def pick_best_politician(top_n: int = 10) -> Optional[PoliticianSummary]:
    """
    Return the most-active politician by trade count.
    Returns None if the API is unavailable.
    """
    politicians = fetch_politicians(page_size=top_n)
    if not politicians:
        return None
    return politicians[0]
