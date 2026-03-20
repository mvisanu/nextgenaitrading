from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class OrderResult:
    broker_order_id: str
    status: str
    filled_price: float | None
    filled_quantity: float | None
    raw_response: dict


class AbstractBrokerClient(ABC):
    @abstractmethod
    def get_account(self) -> dict: ...

    @abstractmethod
    def place_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        order_type: str = "market",
        dry_run: bool = True,
    ) -> OrderResult: ...

    @abstractmethod
    def get_positions(self) -> list[dict]: ...

    @abstractmethod
    def get_orders(self, limit: int = 50) -> list[dict]: ...

    @abstractmethod
    def ping(self) -> bool: ...
