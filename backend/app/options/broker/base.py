"""Abstract options broker interface.

Mirrors the pattern from backend/app/broker/base.py — all broker-specific
logic is confined to concrete implementations; shared modules depend only
on these dataclasses and the abstract base class.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class OptionContract:
    symbol: str
    expiration: date
    strike: float
    option_type: str                  # "call" or "put"
    bid: float
    ask: float
    mid: float
    volume: int
    open_interest: int
    implied_volatility: float
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    illiquid: bool = False            # spread > 10% of mid


@dataclass
class OptionsOrderLeg:
    contract: OptionContract
    action: str                       # "buy" or "sell"
    quantity: int


@dataclass
class OptionsOrderRequest:
    strategy: str                     # "covered_call", "cash_secured_put", "iron_condor", etc.
    underlying: str
    legs: list[OptionsOrderLeg]
    order_type: str                   # "limit" or "market"
    limit_credit: Optional[float] = None
    limit_debit: Optional[float] = None
    dry_run: bool = True


@dataclass
class OptionsOrderResult:
    order_id: str
    status: str                       # "simulated", "submitted", "filled", "rejected"
    fill_price: Optional[float]
    broker: str
    dry_run: bool


class OptionsBrokerBase(ABC):

    @abstractmethod
    async def get_options_chain(
        self, symbol: str, expiration: date
    ) -> list[OptionContract]: ...

    @abstractmethod
    async def get_expirations(self, symbol: str) -> list[date]: ...

    @abstractmethod
    async def submit_order(self, request: OptionsOrderRequest) -> OptionsOrderResult: ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool: ...

    @abstractmethod
    async def get_order_status(self, order_id: str) -> OptionsOrderResult: ...

    @abstractmethod
    async def get_positions(self) -> list[dict]: ...
