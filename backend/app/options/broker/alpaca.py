"""Alpaca options broker implementation.

Uses Alpaca's v2 options contracts API via httpx async client.
Mirrors the AlpacaClient pattern from backend/app/broker/alpaca_client.py.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date
from typing import Optional

import httpx

from app.core.config import settings
from .base import (
    OptionContract,
    OptionsOrderLeg,
    OptionsOrderRequest,
    OptionsOrderResult,
    OptionsBrokerBase,
)

logger = logging.getLogger(__name__)


class BrokerError(Exception):
    pass


class AlpacaOptionsBroker(OptionsBrokerBase):
    """Alpaca options implementation.

    Uses ALPACA_API_KEY / ALPACA_SECRET_KEY from settings.
    Options contracts are fetched from the Alpaca paper or live endpoint.
    """

    def __init__(self) -> None:
        self._base_url = settings.alpaca_base_url.rstrip("/")
        # Alpaca API key fields reuse the same env vars as the stock client
        self._headers = {
            "APCA-API-KEY-ID": getattr(settings, "alpaca_api_key", ""),
            "APCA-API-SECRET-KEY": getattr(settings, "alpaca_secret_key", ""),
            "accept": "application/json",
            "content-type": "application/json",
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._headers,
            timeout=30.0,
        )

    async def _raise_for_status(self, response: httpx.Response, context: str) -> None:
        if not response.is_success:
            logger.error("Alpaca options API error [%s]: %s %s", context, response.status_code, response.text)
            raise BrokerError(f"Alpaca error ({context}): {response.status_code}")

    async def get_expirations(self, symbol: str) -> list[date]:
        async with self._client() as client:
            resp = await client.get(
                "/v2/options/contracts",
                params={"underlying_symbols": symbol, "limit": 200},
            )
            await self._raise_for_status(resp, "get_expirations")
            data = resp.json()
            contracts = data.get("option_contracts", [])
            dates: set[date] = set()
            for c in contracts:
                exp = c.get("expiration_date")
                if exp:
                    dates.add(date.fromisoformat(exp))
            return sorted(dates)

    async def get_options_chain(
        self, symbol: str, expiration: date
    ) -> list[OptionContract]:
        async with self._client() as client:
            resp = await client.get(
                "/v2/options/contracts",
                params={
                    "underlying_symbols": symbol,
                    "expiration_date": expiration.isoformat(),
                    "limit": 200,
                },
            )
            await self._raise_for_status(resp, "get_options_chain")
            data = resp.json()
            contracts = data.get("option_contracts", [])
            result: list[OptionContract] = []
            for c in contracts:
                bid = float(c.get("bid_price") or 0)
                ask = float(c.get("ask_price") or 0)
                mid = (bid + ask) / 2 if (bid + ask) > 0 else 0.0
                result.append(
                    OptionContract(
                        symbol=c.get("symbol", ""),
                        expiration=date.fromisoformat(c["expiration_date"]),
                        strike=float(c.get("strike_price", 0)),
                        option_type=c.get("type", "call"),
                        bid=bid,
                        ask=ask,
                        mid=mid,
                        volume=int(c.get("volume") or 0),
                        open_interest=int(c.get("open_interest") or 0),
                        implied_volatility=float(c.get("implied_volatility") or 0),
                        delta=float(c.get("delta") or 0),
                        gamma=float(c.get("gamma") or 0),
                        theta=float(c.get("theta") or 0),
                        vega=float(c.get("vega") or 0),
                    )
                )
            return result

    async def submit_order(self, request: OptionsOrderRequest) -> OptionsOrderResult:
        if request.dry_run:
            return OptionsOrderResult(
                order_id=f"sim-{uuid.uuid4().hex[:8]}",
                status="simulated",
                fill_price=request.limit_credit or request.limit_debit,
                broker="alpaca",
                dry_run=True,
            )

        legs_payload = [
            {
                "symbol": leg.contract.symbol,
                "side": leg.action,
                "ratio_qty": leg.quantity,
                "position_intent": "open",
            }
            for leg in request.legs
        ]

        body: dict = {
            "type": "multileg" if len(request.legs) > 1 else "limit",
            "order_class": "multileg" if len(request.legs) > 1 else "simple",
            "legs": legs_payload,
        }
        if request.limit_credit is not None:
            body["limit_price"] = request.limit_credit
        elif request.limit_debit is not None:
            body["limit_price"] = request.limit_debit

        async with self._client() as client:
            resp = await client.post("/v2/orders", json=body)
            await self._raise_for_status(resp, "submit_order")
            data = resp.json()
            return OptionsOrderResult(
                order_id=data.get("id", ""),
                status=data.get("status", "submitted"),
                fill_price=None,
                broker="alpaca",
                dry_run=False,
            )

    async def cancel_order(self, order_id: str) -> bool:
        async with self._client() as client:
            resp = await client.delete(f"/v2/orders/{order_id}")
            return resp.status_code in (200, 204)

    async def get_order_status(self, order_id: str) -> OptionsOrderResult:
        async with self._client() as client:
            resp = await client.get(f"/v2/orders/{order_id}")
            await self._raise_for_status(resp, "get_order_status")
            data = resp.json()
            fill = data.get("filled_avg_price")
            return OptionsOrderResult(
                order_id=order_id,
                status=data.get("status", "unknown"),
                fill_price=float(fill) if fill else None,
                broker="alpaca",
                dry_run=False,
            )

    async def get_positions(self) -> list[dict]:
        async with self._client() as client:
            resp = await client.get("/v2/positions")
            await self._raise_for_status(resp, "get_positions")
            return resp.json()
