"""
BTC trailing-stop bot — pure decision service (V9).

This module is the testable heart of the bot. It has ZERO I/O — no Alpaca calls,
no DB writes — and is driven by the orchestrator in
`scheduler/tasks/btc_bot_monitor.py`.

The single public entry point is `evaluate_tick(...) -> TickAction`. The orchestrator
hands it a snapshot of session state + the latest market data, and gets back
exactly one action describing what should happen this tick.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Literal, Union

# ── Strategy constants ───────────────────────────────────────────────────────
# Drops measured against the *original* entry price (not blended), per BTC_BOT.md.
LADDER_DROPS: tuple[Decimal, Decimal, Decimal] = (
    Decimal("0.20"),
    Decimal("0.30"),
    Decimal("0.40"),
)
LADDER_USD: tuple[Decimal, Decimal, Decimal] = (
    Decimal("10000"),
    Decimal("15000"),
    Decimal("20000"),
)
TRAILING_ACTIVATION_GAIN = Decimal("0.10")  # +10%
TRAILING_STEP = Decimal("0.05")              # +5% steps
TRAILING_FLOOR_MULT = Decimal("0.95")        # 5% below current price
FLOOR_MULT = Decimal("0.90")                 # 10% below blended entry


# ── TickAction dataclasses ──────────────────────────────────────────────────

@dataclass(frozen=True)
class Idle:
    reason: str


@dataclass(frozen=True)
class InitialBuy:
    usd_amount: Decimal


@dataclass(frozen=True)
class LadderBuy:
    level: int  # 1, 2, or 3
    usd_amount: Decimal


@dataclass(frozen=True)
class AdvanceTrailing:
    new_floor: Decimal
    new_trailing_high: Decimal
    activated_now: bool


@dataclass(frozen=True)
class StopOut:
    reason: str


@dataclass(frozen=True)
class ExitCooldown:
    pass


@dataclass(frozen=True)
class AdoptPosition:
    avg_entry: Decimal
    qty: Decimal


TickAction = Union[
    Idle, InitialBuy, LadderBuy, AdvanceTrailing, StopOut, ExitCooldown, AdoptPosition
]


# ── SessionState input ──────────────────────────────────────────────────────

@dataclass(frozen=True)
class SessionState:
    status: Literal["active", "cooldown", "ended", "no_session"]
    original_entry: Decimal | None
    blended_entry: Decimal | None
    total_qty: Decimal
    current_floor: Decimal | None
    trailing_active: bool
    trailing_high: Decimal | None
    ladder_next: int  # 0..3
    cooldown_until: datetime | None


# ── Decision function (filled out incrementally in later tasks) ─────────────

def evaluate_tick(
    session: SessionState,
    current_price: Decimal,
    alpaca_position_qty: Decimal,
    alpaca_avg_entry: Decimal | None,
    initial_buy_usd: Decimal,
    now_utc: datetime,
) -> TickAction:
    """Pure decision. See module docstring for behaviour."""
    # 1. Terminal — session ended (no work)
    if session.status == "ended":
        return Idle("session ended")

    # 2. Cooldown — idle until cooldown_until, then ExitCooldown
    if session.status == "cooldown":
        if session.cooldown_until is None or now_utc < session.cooldown_until:
            remaining = "?"
            if session.cooldown_until is not None:
                delta = session.cooldown_until - now_utc
                remaining = f"{int(delta.total_seconds() // 60)}m"
            return Idle(f"cooldown — {remaining} left")
        return ExitCooldown()

    # Remaining branches added in subsequent tasks.
    return Idle("not implemented yet")
