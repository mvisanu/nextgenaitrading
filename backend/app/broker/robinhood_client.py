"""
RobinhoodClient — crypto-only stub.

The official Robinhood crypto API requires OAuth 2.0 + Ed25519 private key signing.
Full implementation is deferred to a post-MVP release. All methods raise NotImplementedError
except ping() which attempts a health check against the Robinhood trading endpoint.

SDK decision: uses httpx for direct REST calls (no third-party SDK dependency).
See TASKS.md assumption OQ-01.
"""
from __future__ import annotations

import logging

import httpx

from app.broker.base import AbstractBrokerClient, OrderResult
from app.core.config import settings

logger = logging.getLogger(__name__)

# Crypto-only symbols that Robinhood supports (partial list for validation)
ROBINHOOD_CRYPTO_SYMBOLS = {
    "BTC-USD",
    "ETH-USD",
    "DOGE-USD",
    "SOL-USD",
    "ADA-USD",
    "MATIC-USD",
    "LTC-USD",
    "BCH-USD",
    "ETC-USD",
    "XLM-USD",
}


class RobinhoodClient(AbstractBrokerClient):
    """
    Stub implementation for Robinhood crypto-only broker.
    Crypto symbol support only — raises ValueError for non-crypto symbols.
    """

    def __init__(self, api_key: str, private_key: str) -> None:
        self.api_key = api_key
        self.private_key = private_key
        self.base_url = settings.robinhood_base_url

    def ping(self) -> bool:
        """Best-effort connectivity check — returns False for stub."""
        logger.warning(
            "RobinhoodClient.ping() called but full implementation is not yet available. "
            "Returning False."
        )
        return False

    def get_account(self) -> dict:
        raise NotImplementedError(
            "RobinhoodClient.get_account() is not implemented in this release. "
            "Full Robinhood crypto API support is scheduled for a post-MVP release."
        )

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
                broker_order_id="dry-run-robinhood",
                status="simulated",
                filled_price=None,
                filled_quantity=quantity,
                raw_response={"dry_run": True, "symbol": symbol, "side": side},
            )
        raise NotImplementedError(
            "RobinhoodClient.place_order() live execution is not implemented in this release."
        )

    def get_positions(self) -> list[dict]:
        raise NotImplementedError("RobinhoodClient.get_positions() is not implemented.")

    def get_orders(self, limit: int = 50) -> list[dict]:
        raise NotImplementedError("RobinhoodClient.get_orders() is not implemented.")
