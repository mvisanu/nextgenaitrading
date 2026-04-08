"""
WheelAlpacaClient — standalone httpx-based Alpaca client for the Wheel Strategy Bot.

Uses WHEEL_ALPACA_API_KEY / WHEEL_ALPACA_SECRET_KEY / WHEEL_ALPACA_BASE_URL from env.
Completely separate from the main Alpaca account used by the rest of the platform.
"""
from __future__ import annotations

import logging
import os
from datetime import date, timedelta

import httpx

logger = logging.getLogger(__name__)

_WHEEL_API_KEY = os.environ.get("WHEEL_ALPACA_API_KEY", "")
_WHEEL_SECRET_KEY = os.environ.get("WHEEL_ALPACA_SECRET_KEY", "")
_WHEEL_BASE_URL = os.environ.get(
    "WHEEL_ALPACA_BASE_URL", "https://paper-api.alpaca.markets"
).rstrip("/")

_DATA_BASE_URL = "https://data.alpaca.markets"


class WheelAlpacaClient:
    """
    Thin httpx wrapper for the Wheel Bot's dedicated Alpaca account.

    All network calls are synchronous (used from sync APScheduler context via
    asyncio.to_thread or directly from async service via run_in_executor).
    """

    def __init__(
        self,
        api_key: str | None = None,
        secret_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._api_key = api_key or _WHEEL_API_KEY
        self._secret_key = secret_key or _WHEEL_SECRET_KEY
        self._base_url = (base_url or _WHEEL_BASE_URL).rstrip("/")
        self._headers = {
            "APCA-API-KEY-ID": self._api_key,
            "APCA-API-SECRET-KEY": self._secret_key,
            "Content-Type": "application/json",
        }

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _get(self, path: str, base: str | None = None, **params) -> dict:
        url = (base or self._base_url) + path
        with httpx.Client(timeout=15) as client:
            resp = client.get(url, headers=self._headers, params=params)
            resp.raise_for_status()
            return resp.json()

    def _post(self, path: str, body: dict) -> dict:
        url = self._base_url + path
        with httpx.Client(timeout=15) as client:
            resp = client.post(url, headers=self._headers, json=body)
            resp.raise_for_status()
            return resp.json()

    def _delete(self, path: str) -> None:
        url = self._base_url + path
        with httpx.Client(timeout=15) as client:
            resp = client.delete(url, headers=self._headers)
            resp.raise_for_status()

    # ── Account ────────────────────────────────────────────────────────────────

    def get_account(self) -> dict:
        """GET /v2/account — returns account dict including buying_power."""
        return self._get("/v2/account")

    # ── Positions ──────────────────────────────────────────────────────────────

    def get_position(self, symbol: str) -> dict | None:
        """
        GET /v2/positions/{symbol}

        Returns the position dict or None if no position exists (404).
        """
        try:
            return self._get(f"/v2/positions/{symbol}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404:
                return None
            raise

    # ── Options chain ──────────────────────────────────────────────────────────

    def get_option_chain(self, symbol: str, expiry: str) -> list[dict]:
        """
        GET /v2/options/contracts?underlying_symbols=X&expiration_date=Y

        Returns a list of option contract dicts for the given expiry.
        """
        try:
            result = self._get(
                "/v2/options/contracts",
                underlying_symbols=symbol,
                expiration_date=expiry,
                limit=500,
            )
            # Alpaca returns {"option_contracts": [...]} or a list depending on version
            if isinstance(result, dict):
                return result.get("option_contracts", [])
            if isinstance(result, list):
                return result
            return []
        except Exception as exc:
            logger.warning("get_option_chain failed for %s/%s: %s", symbol, expiry, exc)
            return []

    # ── Expiry picker ──────────────────────────────────────────────────────────

    def pick_expiration(self, days_min: int = 14, days_max: int = 28) -> str:
        """
        Return the next available Friday expiration between days_min and days_max
        calendar days from today.

        Returns a YYYY-MM-DD string.
        """
        today = date.today()
        # Walk forward to find a Friday in window
        candidate = today + timedelta(days=days_min)
        # Advance to the next Friday (weekday 4) on or after candidate
        days_until_friday = (4 - candidate.weekday()) % 7
        candidate = candidate + timedelta(days=days_until_friday)
        if (candidate - today).days > days_max:
            # No Friday in window — fall back to exactly days_min days
            candidate = today + timedelta(days=days_min)
        return candidate.isoformat()

    # ── Strike finder ──────────────────────────────────────────────────────────

    def closest_strike(
        self, chain: list[dict], target: float, option_type: str
    ) -> dict | None:
        """
        Find the contract in chain whose strike is closest to target and whose
        option_type matches ("put" or "call").

        option_type comparison is case-insensitive.
        """
        ot = option_type.lower()
        filtered = [
            c for c in chain
            if str(c.get("type", c.get("option_type", ""))).lower() == ot
        ]
        if not filtered:
            return None
        return min(filtered, key=lambda c: abs(float(c.get("strike_price", 0)) - target))

    # ── Mid price ─────────────────────────────────────────────────────────────

    def mid_price(self, contract: dict) -> float:
        """
        Return the mid-price from bid/ask or fall back to mark_price.
        Returns 0.0 if no pricing data is available.
        """
        bid = contract.get("bid_price") or contract.get("bid")
        ask = contract.get("ask_price") or contract.get("ask")
        if bid is not None and ask is not None:
            try:
                return (float(bid) + float(ask)) / 2.0
            except (TypeError, ValueError):
                pass
        mark = contract.get("mark_price") or contract.get("close_price")
        if mark is not None:
            try:
                return float(mark)
            except (TypeError, ValueError):
                pass
        return 0.0

    # ── Orders ─────────────────────────────────────────────────────────────────

    def place_order(
        self,
        symbol: str,
        side: str,
        qty: int,
        order_type: str = "market",
        limit_price: float | None = None,
        dry_run: bool = True,
    ) -> dict:
        """
        Place an equity or options order.

        For dry_run=True, returns a simulated response without hitting the API.
        Returns {"order_id": str, "status": str}.
        """
        if dry_run:
            logger.info(
                "WheelAlpacaClient dry_run: would place %s %s %d @ %s",
                side,
                symbol,
                qty,
                order_type,
            )
            return {"order_id": "dry-run", "status": "simulated"}

        body: dict = {
            "symbol": symbol,
            "qty": str(qty),
            "side": side,
            "type": order_type,
            "time_in_force": "day",
        }
        if order_type == "limit" and limit_price is not None:
            body["limit_price"] = str(round(limit_price, 2))

        resp = self._post("/v2/orders", body)
        return {"order_id": resp.get("id", ""), "status": resp.get("status", "")}

    def get_order(self, order_id: str) -> dict:
        """GET /v2/orders/{order_id}"""
        return self._get(f"/v2/orders/{order_id}")

    def cancel_order(self, order_id: str) -> None:
        """DELETE /v2/orders/{order_id}"""
        try:
            self._delete(f"/v2/orders/{order_id}")
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in (404, 422):
                logger.debug("cancel_order: order %s already gone", order_id)
            else:
                raise

    # ── Live price (equity) ────────────────────────────────────────────────────

    def get_latest_price(self, symbol: str) -> float | None:
        """
        Fetch the latest trade price for an equity symbol from Alpaca data API.
        Returns None on failure.
        """
        try:
            data = self._get(
                f"/v2/stocks/{symbol}/trades/latest",
                base=_DATA_BASE_URL,
            )
            return float(data.get("trade", {}).get("p", 0)) or None
        except Exception as exc:
            logger.warning("get_latest_price(%s) failed: %s", symbol, exc)
            return None
