from __future__ import annotations

import logging

from app.broker.base import AbstractBrokerClient, OrderResult

logger = logging.getLogger(__name__)


class AlpacaClient(AbstractBrokerClient):
    """
    Alpaca broker client using alpaca-py SDK.
    Supports stocks, ETFs, and crypto.
    """

    def __init__(self, api_key: str, secret_key: str, paper: bool = False) -> None:
        from alpaca.trading.client import TradingClient

        base_url = (
            "https://paper-api.alpaca.markets" if paper else "https://api.alpaca.markets"
        )
        self.client = TradingClient(api_key, secret_key, url_override=base_url)

    def ping(self) -> bool:
        try:
            self.client.get_account()
            return True
        except Exception as exc:
            logger.warning("Alpaca ping failed: %s", exc)
            return False

    def get_account(self) -> dict:
        account = self.client.get_account()
        return account.model_dump() if hasattr(account, "model_dump") else dict(account)

    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        order_type: str = "market",
        dry_run: bool = True,
    ) -> OrderResult:
        if dry_run:
            return OrderResult(
                broker_order_id="dry-run",
                status="simulated",
                filled_price=None,
                filled_quantity=quantity,
                raw_response={"dry_run": True, "symbol": symbol, "side": side},
            )

        from alpaca.trading.enums import OrderSide, TimeInForce
        from alpaca.trading.requests import MarketOrderRequest

        req = MarketOrderRequest(
            symbol=symbol,
            qty=quantity,
            side=OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
        order = self.client.submit_order(req)
        raw = order.model_dump() if hasattr(order, "model_dump") else {}
        return OrderResult(
            broker_order_id=str(order.id),
            status=str(order.status),
            filled_price=float(order.filled_avg_price) if order.filled_avg_price else None,
            filled_quantity=float(order.filled_qty) if order.filled_qty else None,
            raw_response=raw,
        )

    def get_positions(self) -> list[dict]:
        positions = self.client.get_all_positions()
        result = []
        for p in positions:
            raw = p.model_dump() if hasattr(p, "model_dump") else {}
            result.append(raw)
        return result

    def get_orders(self, limit: int = 50) -> list[dict]:
        from alpaca.trading.requests import GetOrdersRequest

        req = GetOrdersRequest(limit=limit)
        orders = self.client.get_orders(req)
        result = []
        for o in orders:
            raw = o.model_dump() if hasattr(o, "model_dump") else {}
            result.append(raw)
        return result
