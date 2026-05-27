"""
Thin alpaca-py wrapper for the BTC trailing-stop bot.

Exposes only the 4 calls the orchestrator needs:
  - get_btc_ask()          → latest ask price (Decimal)
  - get_btc_position()     → dict | None  (qty, avg_entry_price, symbol)
  - market_buy(usd)        → dict (filled_qty, filled_price, order_id)
  - market_sell_all(qty)   → dict (filled_qty, filled_price, order_id)

Polls submitted orders up to ~60 s and raises TimeoutError if Alpaca never fills.
All numeric values are Decimal — callers should never see Python floats.
"""
from __future__ import annotations

import logging
import time
from decimal import ROUND_DOWN, Decimal
from typing import Optional

from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoLatestQuoteRequest
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

logger = logging.getLogger(__name__)

SYMBOL = "BTC/USD"
_POSITION_SYMBOL = SYMBOL.replace("/", "").upper()


class BtcBotClient:
    """Minimal Alpaca wrapper used by the btc_bot_monitor scheduler task."""

    def __init__(self, api_key: str, secret_key: str, paper: bool = True) -> None:
        if not api_key or not secret_key:
            raise ValueError("BtcBotClient requires api_key + secret_key")
        self._trading = TradingClient(api_key, secret_key, paper=paper)
        self._data = CryptoHistoricalDataClient(api_key, secret_key)

    # ── Reads ─────────────────────────────────────────────────────────────

    def get_btc_ask(self) -> Decimal:
        req = CryptoLatestQuoteRequest(symbol_or_symbols=SYMBOL)
        quote = self._data.get_crypto_latest_quote(req)
        ask = quote[SYMBOL].ask_price
        return Decimal(str(ask))

    def get_btc_position(self) -> Optional[dict]:
        for p in self._trading.get_all_positions():
            if p.symbol.replace("/", "").upper() == _POSITION_SYMBOL:
                return {
                    "qty": Decimal(str(p.qty)),
                    "avg_entry_price": Decimal(str(p.avg_entry_price)),
                    "symbol": p.symbol,
                }
        return None

    # ── Writes ────────────────────────────────────────────────────────────

    def market_buy(self, usd_amount: Decimal, max_poll_seconds: int = 60) -> dict:
        """Place a notional-equivalent BTC market buy. Polls until filled."""
        ask = self.get_btc_ask()
        qty = (usd_amount / ask).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
        if qty <= 0:
            raise ValueError(f"computed qty {qty} <= 0 for usd={usd_amount} ask={ask}")
        req = MarketOrderRequest(
            symbol=SYMBOL,
            qty=float(qty),
            side=OrderSide.BUY,
            time_in_force=TimeInForce.GTC,
        )
        order = self._trading.submit_order(req)
        order_id = str(order.id)
        return self._poll_fill(order_id, max_poll_seconds, fallback_qty=qty, fallback_price=ask)

    def market_sell_all(self, qty: Decimal, max_poll_seconds: int = 60) -> dict:
        """Market-sell the entire BTC position. Polls until filled."""
        if qty <= 0:
            raise ValueError(f"market_sell_all called with qty={qty}")
        req = MarketOrderRequest(
            symbol=SYMBOL,
            qty=float(qty.quantize(Decimal("0.00000001"))),
            side=OrderSide.SELL,
            time_in_force=TimeInForce.GTC,
        )
        order = self._trading.submit_order(req)
        order_id = str(order.id)
        return self._poll_fill(order_id, max_poll_seconds, fallback_qty=qty, fallback_price=None)

    # ── Internal ──────────────────────────────────────────────────────────

    def _poll_fill(
        self,
        order_id: str,
        max_poll_seconds: int,
        fallback_qty: Decimal,
        fallback_price: Optional[Decimal],
    ) -> dict:
        for _ in range(max_poll_seconds):
            o = self._trading.get_order_by_id(order_id)
            status_value = o.status.value if hasattr(o.status, "value") else str(o.status)
            if status_value in ("filled", "partially_filled"):
                filled_qty = Decimal(str(o.filled_qty or fallback_qty))
                price_src = o.filled_avg_price or fallback_price
                if price_src is None:
                    raise RuntimeError(f"Order {order_id} filled but no price reported")
                return {
                    "filled_qty": filled_qty,
                    "filled_price": Decimal(str(price_src)),
                    "order_id": order_id,
                }
            if status_value in ("canceled", "rejected", "expired"):
                raise RuntimeError(f"Order {order_id} ended in status={status_value}")
            time.sleep(1)
        raise TimeoutError(f"Order {order_id} did not fill within {max_poll_seconds}s")
