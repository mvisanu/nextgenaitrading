"""
Dedicated Alpaca trading client for the Visanu account.

Unlike the generic AlpacaClient (which uses DB-stored broker credentials), this
client reads directly from settings at instantiation time. It is ONLY used by
the congress copy service — never returned from get_broker_client().
"""
from __future__ import annotations

import logging
from typing import Optional

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

from app.core.config import settings

logger = logging.getLogger(__name__)


def _make_client() -> Optional[TradingClient]:
    """Return a TradingClient if Visanu credentials are configured; None otherwise."""
    key = settings.visanu_alpaca_api_key.strip()
    secret = settings.visanu_alpaca_secret_key.strip()
    if not key or not secret:
        return None
    return TradingClient(
        api_key=key,
        secret_key=secret,
        paper=settings.visanu_alpaca_paper,
        url_override=settings.visanu_alpaca_endpoint_url or None,
    )


class VisanuAlpacaClient:
    """Thin wrapper around the Visanu Alpaca trading account."""

    def __init__(self) -> None:
        self._client = _make_client()
        if self._client is None:
            logger.warning(
                "VisanuAlpacaClient: VISANU_ALPACA_API_KEY or VISANU_ALPACA_SECRET_KEY "
                "not set — all orders will be no-ops"
            )

    @property
    def is_configured(self) -> bool:
        return self._client is not None

    def place_market_order(
        self,
        symbol: str,
        qty: float,
        side: str,
        dry_run: bool = True,
    ) -> Optional[str]:
        """
        Place a market order. Returns the Alpaca order ID, or None on dry-run/failure.

        symbol: stock ticker ("AAPL") or OCC option symbol.
        side: "buy" | "sell"
        dry_run: if True, logs the order but does NOT submit it.
        """
        side_lower = side.lower()
        if side_lower not in ("buy", "sell"):
            raise ValueError(f"VisanuAlpacaClient: invalid order side {side!r}")

        if dry_run:
            logger.info(
                "VisanuAlpacaClient [DRY RUN]: %s %s x%.4f — no real order submitted",
                side_lower.upper(),
                symbol,
                qty,
            )
            return None

        if not self._client:
            logger.error(
                "VisanuAlpacaClient: credentials not configured — cannot place live order"
            )
            return None

        alpaca_side = OrderSide.BUY if side_lower == "buy" else OrderSide.SELL
        request = MarketOrderRequest(
            symbol=symbol,
            qty=qty,
            side=alpaca_side,
            time_in_force=TimeInForce.DAY,
        )
        try:
            order = self._client.submit_order(request)
            logger.info(
                "VisanuAlpacaClient: submitted %s %s x%.4f — order_id=%s",
                side_lower.upper(),
                symbol,
                qty,
                order.id,
            )
            return str(order.id)
        except Exception as exc:
            logger.error(
                "VisanuAlpacaClient: submit_order failed for %s %s: %s",
                side_lower.upper(), symbol, exc,
            )
            return None


# Module-level singleton — instantiated once at import time
visanu_client = VisanuAlpacaClient()
