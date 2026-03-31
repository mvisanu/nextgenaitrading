from __future__ import annotations

from .base import OptionsBrokerBase
from .alpaca import AlpacaOptionsBroker

BROKER_REGISTRY: dict[str, type[OptionsBrokerBase]] = {
    "alpaca": AlpacaOptionsBroker,
}


def get_options_broker(name: str) -> OptionsBrokerBase:
    cls = BROKER_REGISTRY.get(name)
    if not cls:
        raise ValueError(f"Unknown options broker: {name}")
    return cls()
