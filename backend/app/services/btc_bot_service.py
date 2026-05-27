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

    # 3. No session in DB
    if session.status == "no_session":
        if alpaca_position_qty > 0 and alpaca_avg_entry is not None:
            return AdoptPosition(avg_entry=alpaca_avg_entry, qty=alpaca_position_qty)
        return InitialBuy(usd_amount=initial_buy_usd)

    # 4. status == "active" — main monitoring branch
    if session.current_floor is None or session.blended_entry is None or session.original_entry is None:
        # Defensive: orchestrator should never hand us this; treat as Idle.
        return Idle("active session missing required state")

    # 4a. FLOOR check first — safety override (wins over ladder, trailing, everything).
    if current_price <= session.current_floor:
        gain = (current_price / session.blended_entry - Decimal("1")) * Decimal("100")
        return StopOut(
            reason=f"FLOOR @ ${current_price:.2f} ({gain:+.2f}% from blended ${session.blended_entry:.2f})"
        )

    # 4b. Ladder check — triggers compare to ORIGINAL entry, never blended.
    if session.ladder_next < 3:
        drop = LADDER_DROPS[session.ladder_next]
        trigger = session.original_entry * (Decimal("1") - drop)
        if current_price <= trigger:
            level = session.ladder_next + 1
            return LadderBuy(level=level, usd_amount=LADDER_USD[session.ladder_next])

    # 4c. Trailing floor — activation + step advances. Up-only.
    if not session.trailing_active:
        gain = current_price / session.blended_entry - Decimal("1")
        if gain >= TRAILING_ACTIVATION_GAIN:
            proposed = (current_price * TRAILING_FLOOR_MULT).quantize(Decimal("0.01"))
            if proposed > session.current_floor:
                return AdvanceTrailing(
                    new_floor=proposed,
                    new_trailing_high=current_price,
                    activated_now=True,
                )
    else:
        # trailing_active == True
        if (
            session.trailing_high is not None
            and current_price > session.trailing_high
        ):
            step = current_price / session.trailing_high - Decimal("1")
            if step >= TRAILING_STEP:
                proposed = (current_price * TRAILING_FLOOR_MULT).quantize(Decimal("0.01"))
                if proposed > session.current_floor:
                    return AdvanceTrailing(
                        new_floor=proposed,
                        new_trailing_high=current_price,
                        activated_now=False,
                    )

    # 4d. Nothing fired — pure idle with diagnostic reason.
    gain_pct = (current_price / session.blended_entry - Decimal("1")) * Decimal("100")
    return Idle(
        f"price=${current_price:.2f} gain={gain_pct:+.2f}% floor=${session.current_floor:.2f}"
    )


# ── Helpers for orchestrator (also pure) ────────────────────────────────────

def compute_blended_entry(
    prior_qty: Decimal,
    prior_blended: Decimal,
    fill_qty: Decimal,
    fill_price: Decimal,
) -> Decimal:
    """Weighted-average entry after a buy fills. Rounds to 2dp."""
    total_cost = prior_qty * prior_blended + fill_qty * fill_price
    total_qty = prior_qty + fill_qty
    if total_qty == 0:
        return Decimal("0.00")
    return (total_cost / total_qty).quantize(Decimal("0.01"))


def compute_new_floor_up_only(
    existing: Decimal | None,
    proposed: Decimal,
) -> Decimal:
    """Floor is up-only. Returns max of existing (if any) and proposed."""
    if existing is None:
        return proposed
    return max(existing, proposed)
