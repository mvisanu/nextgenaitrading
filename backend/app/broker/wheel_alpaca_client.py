"""Standalone Alpaca httpx client for the Wheel Strategy Bot.

Uses dedicated WHEEL_ALPACA_* credentials — completely separate from
the main AlpacaClient used by the rest of NextGenStock.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_SENTINEL = object()


class WheelAlpacaClient:
    """httpx async client for Wheel Bot, using the paper trading credentials."""

    def __init__(
        self,
        api_key=_SENTINEL,
        secret_key=_SENTINEL,
        base_url=_SENTINEL,
    ) -> None:
        if api_key is _SENTINEL or secret_key is _SENTINEL or base_url is _SENTINEL:
            from app.core.config import settings
            api_key = settings.wheel_alpaca_api_key
            secret_key = settings.wheel_alpaca_secret_key
            base_url = settings.wheel_alpaca_base_url

        self._base_url = base_url.rstrip("/")
        self._headers = {
            "APCA-API-KEY-ID": api_key,
            "APCA-API-SECRET-KEY": secret_key,
            "accept": "application/json",
            "content-type": "application/json",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=30.0,
        )

    async def get_account(self) -> dict:
        """Return account dict with keys: cash, equity, buying_power."""
        async with self._client() as http:
            resp = await http.get("/v2/account")
            resp.raise_for_status()
            return resp.json()

    async def get_position(self, symbol: str) -> Optional[dict]:
        """Return position dict for symbol, or None if not held."""
        async with self._client() as http:
            resp = await http.get(f"/v2/positions/{symbol}")
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return resp.json()

    async def get_all_positions(self) -> list[dict]:
        async with self._client() as http:
            resp = await http.get("/v2/positions")
            resp.raise_for_status()
            return resp.json()

    async def get_stock_latest_price(self, symbol: str) -> float:
        """Return latest trade price for an equity symbol."""
        async with self._client() as http:
            resp = await http.get(
                f"/v2/stocks/{symbol}/trades/latest",
                params={"feed": "iex"},
            )
            resp.raise_for_status()
            data = resp.json()
            return float(data["trade"]["p"])

    async def get_expirations(self, symbol: str) -> list[date]:
        """Return sorted list of available option expiration dates."""
        async with self._client() as http:
            resp = await http.get(
                "/v2/options/contracts",
                params={"underlying_symbols": symbol, "limit": 200},
            )
            resp.raise_for_status()
            data = resp.json()
            contracts = data.get("option_contracts", [])
            dates: set[date] = set()
            for c in contracts:
                exp = c.get("expiration_date")
                if exp:
                    dates.add(date.fromisoformat(exp))
            return sorted(dates)

    async def get_options_chain(
        self, symbol: str, expiration: date, option_type: str
    ) -> list[dict]:
        """Return raw contract dicts for symbol at expiration filtered by type."""
        async with self._client() as http:
            resp = await http.get(
                "/v2/options/contracts",
                params={
                    "underlying_symbols": symbol,
                    "expiration_date": expiration.isoformat(),
                    "type": option_type,
                    "limit": 200,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("option_contracts", [])

    async def get_option_current_price(self, contract_symbol: str) -> Optional[float]:
        """Return current mid-price of an options contract, or None on failure."""
        try:
            positions = await self.get_all_positions()
            for pos in positions:
                if pos.get("symbol", "") == contract_symbol:
                    return float(pos["current_price"])
        except Exception as exc:
            logger.debug("get_option_current_price via positions failed: %s", exc)

        try:
            async with self._client() as http:
                resp = await http.get(
                    "/v2/options/contracts",
                    params={"symbols": contract_symbol, "limit": 1},
                )
                if resp.is_success:
                    contracts = resp.json().get("option_contracts", [])
                    if contracts:
                        c = contracts[0]
                        bid = float(c.get("bid_price") or 0)
                        ask = float(c.get("ask_price") or 0)
                        if bid > 0 or ask > 0:
                            return (bid + ask) / 2
        except Exception as exc:
            logger.debug("get_option_current_price fallback failed: %s", exc)

        return None

    async def sell_to_open(
        self,
        contract_symbol: str,
        qty: int,
        limit_price: float,
        dry_run: bool = True,
    ) -> dict:
        """Submit a sell-to-open (short) options order."""
        if dry_run:
            return {
                "order_id": f"sim-sell-{contract_symbol[:8]}",
                "status": "simulated",
                "dry_run": True,
            }
        body = {
            "symbol": contract_symbol,
            "qty": str(qty),
            "side": "sell",
            "type": "limit",
            "time_in_force": "day",
            "limit_price": f"{limit_price:.2f}",
        }
        async with self._client() as http:
            resp = await http.post("/v2/orders", json=body)
            resp.raise_for_status()
            data = resp.json()
            return {"order_id": data["id"], "status": data["status"], "dry_run": False}

    async def buy_to_close(
        self,
        contract_symbol: str,
        qty: int,
        limit_price: float,
        dry_run: bool = True,
    ) -> dict:
        """Submit a buy-to-close order for an existing short option position."""
        if dry_run:
            return {
                "order_id": f"sim-close-{contract_symbol[:8]}",
                "status": "simulated",
                "dry_run": True,
            }
        body = {
            "symbol": contract_symbol,
            "qty": str(qty),
            "side": "buy",
            "type": "limit",
            "time_in_force": "day",
            "limit_price": f"{limit_price:.2f}",
        }
        async with self._client() as http:
            resp = await http.post("/v2/orders", json=body)
            resp.raise_for_status()
            data = resp.json()
            return {"order_id": data["id"], "status": data["status"], "dry_run": False}

    async def get_order(self, order_id: str) -> dict:
        async with self._client() as http:
            resp = await http.get(f"/v2/orders/{order_id}")
            resp.raise_for_status()
            return resp.json()

    # ── Pure utility methods (no I/O) ─────────────────────────────────────────

    @staticmethod
    def pick_expiration(
        expirations: list[date],
        min_days: int = 14,
        max_days: int = 28,
        today: Optional[date] = None,
    ) -> Optional[date]:
        """Return nearest expiration within [min_days, max_days] from today."""
        if today is None:
            today = date.today()
        candidates = [
            exp for exp in expirations
            if min_days <= (exp - today).days <= max_days
        ]
        return candidates[0] if candidates else None

    @staticmethod
    def closest_strike(contracts: list[dict], target: float) -> Optional[dict]:
        """Return the contract whose strike is numerically closest to target."""
        valid = [c for c in contracts if int(c.get("open_interest") or 0) > 0]
        if not valid:
            return None
        return min(valid, key=lambda c: abs(float(c["strike_price"]) - target))

    @staticmethod
    def mid_price(contract: dict) -> float:
        """Return the mid-price of a raw contract dict."""
        bid = float(contract.get("bid_price") or 0)
        ask = float(contract.get("ask_price") or 0)
        if bid <= 0 and ask <= 0:
            return 0.0
        return (bid + ask) / 2
