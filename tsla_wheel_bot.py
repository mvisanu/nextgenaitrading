"""TSLA Wheel Strategy Bot — standalone script.

Runs the two-stage wheel (sell put → assigned → sell call → called away → repeat)
against your Alpaca paper trading account.

Rules enforced:
  - Never sell put if cash < strike × 100
  - Never sell call with strike < cost_basis_per_share
  - Strike targets: put = price × 0.90, call = cost_basis × 1.10
  - Expiration: 14–28 days out (nearest)
  - 50% profit early close: buy-to-close + reopen when contract ≤ 50% of premium
  - Checks every 15 minutes during NYSE market hours (9:30–16:00 ET, Mon–Fri)
  - Daily summary printed at ~16:05 ET

Config (env vars or edit defaults below):
  NEXTGENSTOCK_ALPACA_API_KEY       (required)
  NEXTGENSTOCK_ALPACA_SECRET_KEY    (required)
  WHEEL_SYMBOL                      (default: TSLA)
  WHEEL_POLL_MINUTES                (default: 15)
  WHEEL_DRY_RUN                     (default: false)

Run:
  cd backend && source .venv/Scripts/activate   # Windows
  python ../tsla_wheel_bot.py
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone, timedelta
from typing import Optional

import httpx

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("tsla_wheel")

# ── Config ─────────────────────────────────────────────────────────────────────
API_KEY      = os.getenv("NEXTGENSTOCK_ALPACA_API_KEY",    "PK6BTAJV5VWWHGYRBCT2OZVGY4")
SECRET_KEY   = os.getenv("NEXTGENSTOCK_ALPACA_SECRET_KEY", "4o6DAy7Y54ZgNe5CM6pvs2ALknT99ZTjQJu1JCUh6J8v")
TRADING_BASE = "https://paper-api.alpaca.markets"   # orders, positions, account
DATA_BASE    = "https://data.alpaca.markets"         # market data, options chains
SYMBOL       = os.getenv("WHEEL_SYMBOL",        "TSLA")
POLL_MIN     = int(os.getenv("WHEEL_POLL_MINUTES", "15"))
DRY_RUN      = os.getenv("WHEEL_DRY_RUN", "false").lower() not in ("false", "0", "no")

_HEADERS = {
    "APCA-API-KEY-ID":     API_KEY,
    "APCA-API-SECRET-KEY": SECRET_KEY,
    "accept":              "application/json",
    "content-type":        "application/json",
}

# ── In-memory state ────────────────────────────────────────────────────────────
@dataclass
class WheelState:
    symbol: str = SYMBOL
    stage: str = "sell_put"             # "sell_put" | "sell_call"
    dry_run: bool = DRY_RUN

    # Active option position
    active_contract: Optional[str]  = None    # OCC symbol e.g. TSLA260424P00312000
    active_order_id: Optional[str]  = None
    active_premium:  Optional[float] = None   # premium received per share (mid price)
    active_strike:   Optional[float] = None
    active_expiry:   Optional[date]  = None

    # Share position (Stage 2)
    shares_qty: int = 0
    cost_basis: Optional[float] = None        # per share, net of premiums received

    # Lifetime totals
    total_premium:  float = 0.0              # in dollars (premium × 100 per contract)
    cycles_put:     int   = 0
    cycles_call:    int   = 0
    last_action:    str   = "Not yet started"
    started_at:     datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    daily_summary_date: Optional[date] = None


# ── OCC symbol helpers ─────────────────────────────────────────────────────────
_OCC_RE = re.compile(r'^([A-Z]+)(\d{2})(\d{2})(\d{2})([PC])(\d{8})$')

def parse_occ(sym: str) -> Optional[dict]:
    """Parse OCC symbol → {expiry, type, strike}."""
    m = _OCC_RE.match(sym)
    if not m:
        return None
    _, yy, mm, dd, opt_type, strike_raw = m.groups()
    return {
        "expiry": date(2000 + int(yy), int(mm), int(dd)),
        "type":   opt_type,   # "P" or "C"
        "strike": int(strike_raw) / 1000.0,
    }


def build_occ(symbol: str, expiry: date, opt_type: str, strike: float) -> str:
    """Build OCC symbol: TSLA260424P00312000."""
    strike_int = round(strike * 1000)
    return f"{symbol}{expiry.strftime('%y%m%d')}{opt_type}{strike_int:08d}"


# ── HTTP clients ───────────────────────────────────────────────────────────────
def _trading_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=TRADING_BASE, headers=_HEADERS, timeout=30.0)


def _data_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=DATA_BASE, headers=_HEADERS, timeout=30.0)


# ── Alpaca: account / positions / orders ──────────────────────────────────────
async def get_account() -> dict:
    async with _trading_client() as http:
        r = await http.get("/v2/account")
        r.raise_for_status()
        return r.json()


async def get_position(symbol: str) -> Optional[dict]:
    async with _trading_client() as http:
        r = await http.get(f"/v2/positions/{symbol}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()


async def get_all_positions() -> list[dict]:
    async with _trading_client() as http:
        r = await http.get("/v2/positions")
        r.raise_for_status()
        return r.json()


async def place_order(body: dict, dry_run: bool, action_label: str) -> dict:
    if dry_run:
        log.info("[DRY-RUN] %s — would place order: %s", action_label, body)
        return {"id": f"sim-{body.get('symbol','?')[:12]}", "status": "simulated"}
    async with _trading_client() as http:
        r = await http.post("/v2/orders", json=body)
        if not r.is_success:
            log.error("Order failed (%s): %s", r.status_code, r.text[:300])
            r.raise_for_status()
        data = r.json()
        log.info("%s → order %s status=%s", action_label, data["id"], data["status"])
        return data


# ── Alpaca: market data ────────────────────────────────────────────────────────
async def get_latest_price(symbol: str) -> float:
    async with _data_client() as http:
        r = await http.get(f"/v2/stocks/{symbol}/trades/latest", params={"feed": "iex"})
        r.raise_for_status()
        return float(r.json()["trade"]["p"])


async def get_options_snapshots(
    symbol: str,
    opt_type: str,   # "put" or "call"
    strike_gte: Optional[float] = None,
    strike_lte: Optional[float] = None,
) -> dict[str, dict]:
    """Return {occ_symbol: snapshot_dict} from Alpaca options snapshot endpoint."""
    params: dict = {"limit": 500, "type": opt_type}
    if strike_gte is not None:
        params["strike_price_gte"] = str(int(strike_gte))
    if strike_lte is not None:
        params["strike_price_lte"] = str(int(strike_lte) + 1)
    result: dict[str, dict] = {}
    page_token = None
    for _ in range(5):   # max 5 pages = 2500 contracts
        if page_token:
            params["page_token"] = page_token
        async with _data_client() as http:
            r = await http.get(f"/v1beta1/options/snapshots/{symbol}", params=params)
            r.raise_for_status()
        data = r.json()
        result.update(data.get("snapshots", {}))
        page_token = data.get("next_page_token")
        if not page_token:
            break
    return result


# ── Option selection helpers ───────────────────────────────────────────────────
def filter_expirations(
    snapshots: dict[str, dict],
    min_days: int = 14,
    max_days: int = 28,
) -> list[date]:
    today = date.today()
    exps: set[date] = set()
    for sym in snapshots:
        info = parse_occ(sym)
        if info:
            days = (info["expiry"] - today).days
            if min_days <= days <= max_days:
                exps.add(info["expiry"])
    return sorted(exps)


def best_contract(
    snapshots: dict[str, dict],
    expiry: date,
    opt_type: str,
    target_strike: float,
) -> Optional[tuple[str, float, float]]:
    """
    Return (occ_symbol, strike, mid_price) for the contract closest to target_strike
    on the given expiry date with a non-zero mid price.
    """
    candidates = []
    type_char = "P" if opt_type == "put" else "C"
    for sym, snap in snapshots.items():
        info = parse_occ(sym)
        if not info:
            continue
        if info["expiry"] != expiry or info["type"] != type_char:
            continue
        bid = snap.get("latestQuote", {}).get("bp", 0) or 0
        ask = snap.get("latestQuote", {}).get("ap", 0) or 0
        mid = (bid + ask) / 2 if (bid or ask) else 0.0
        candidates.append((sym, info["strike"], mid))

    if not candidates:
        return None
    candidates.sort(key=lambda c: abs(c[1] - target_strike))
    # Prefer contracts with actual bids
    with_bid = [c for c in candidates if c[2] > 0]
    return with_bid[0] if with_bid else candidates[0]


def current_mid_from_snapshots(
    snapshots: dict[str, dict], contract: str
) -> Optional[float]:
    snap = snapshots.get(contract)
    if not snap:
        return None
    bid = snap.get("latestQuote", {}).get("bp", 0) or 0
    ask = snap.get("latestQuote", {}).get("ap", 0) or 0
    return (bid + ask) / 2 if (bid or ask) else None


# ── Stage 1: Sell Put ──────────────────────────────────────────────────────────
async def sell_new_put(state: WheelState) -> None:
    price = await get_latest_price(state.symbol)
    target_strike = round(price * 0.90, 2)
    log.info("Selling put — TSLA @ $%.2f, target strike $%.2f", price, target_strike)

    account = await get_account()
    cash = float(account.get("cash", 0))
    required = target_strike * 100
    if cash < required:
        state.last_action = (
            f"Not enough cash (${cash:,.2f}) to sell put at ${target_strike:.2f} "
            f"(need ${required:,.2f})."
        )
        log.warning(state.last_action)
        return

    # Fetch options chain (puts within wide strike range to get all expirations)
    snapshots = await get_options_snapshots(
        state.symbol, "put",
        strike_gte=target_strike * 0.7,
        strike_lte=target_strike * 1.3,
    )

    expirations = filter_expirations(snapshots)
    if not expirations:
        state.last_action = "No put expiration found in 14–28 day range."
        log.warning(state.last_action)
        return

    target_exp = expirations[0]  # nearest
    result = best_contract(snapshots, target_exp, "put", target_strike)
    if not result:
        state.last_action = f"No liquid put contract near ${target_strike:.2f} on {target_exp}."
        log.warning(state.last_action)
        return

    occ_sym, strike, mid = result
    if mid <= 0:
        state.last_action = f"Put {occ_sym} has no bid — skipping."
        log.warning(state.last_action)
        return

    limit = round(mid * 0.95, 2)
    order_body = {
        "symbol":        occ_sym,
        "qty":           "1",
        "side":          "sell",
        "type":          "limit",
        "time_in_force": "day",
        "limit_price":   f"{limit:.2f}",
    }
    order = await place_order(order_body, state.dry_run, f"sell-to-open put {occ_sym}")

    state.active_contract = occ_sym
    state.active_order_id = order["id"]
    state.active_premium  = mid
    state.active_strike   = strike
    state.active_expiry   = target_exp
    state.total_premium  += mid * 100
    state.cycles_put     += 1
    state.last_action = (
        f"[STAGE 1] Sold put {occ_sym} @ ${mid:.2f}/share premium | "
        f"Strike ${strike:.2f} | Exp {target_exp} | "
        f"Total premium: ${state.total_premium:,.2f}"
    )
    log.info(state.last_action)


async def handle_sell_put(state: WheelState) -> None:
    if not state.active_contract:
        await sell_new_put(state)
        return

    # Check assignment: do we now hold ≥100 TSLA shares?
    position = await get_position(state.symbol)
    if position and float(position.get("qty", 0)) >= 100:
        fill_price = float(position["avg_entry_price"])
        premium_ps = state.active_premium or 0.0
        state.stage     = "sell_call"
        state.shares_qty = 100
        state.cost_basis = round(fill_price - premium_ps, 4)
        state.active_contract = state.active_order_id = None
        state.active_premium = state.active_strike = state.active_expiry = None
        state.last_action = (
            f"Assigned — bought 100 TSLA @ ${fill_price:.2f}. "
            f"Cost basis: ${state.cost_basis:.2f}/share (net of premium). "
            f"→ Moving to STAGE 2 (sell_call)."
        )
        log.info(state.last_action)
        return

    # Check expiry
    if state.active_expiry and date.today() > state.active_expiry:
        log.info("Put expired worthless (%s). Selling new put.", state.active_contract)
        state.active_contract = state.active_order_id = None
        state.active_premium = state.active_strike = state.active_expiry = None
        await sell_new_put(state)
        return

    # Check 50% profit — need fresh snapshot
    try:
        snaps = await get_options_snapshots(state.symbol, "put",
            strike_gte=(state.active_strike or 0) * 0.9,
            strike_lte=(state.active_strike or 0) * 1.1,
        )
        current_mid = current_mid_from_snapshots(snaps, state.active_contract)
        if (
            current_mid is not None
            and state.active_premium
            and current_mid <= state.active_premium * 0.50
        ):
            limit_close = round(current_mid * 1.05, 2)
            close_body = {
                "symbol":        state.active_contract,
                "qty":           "1",
                "side":          "buy",
                "type":          "limit",
                "time_in_force": "day",
                "limit_price":   f"{limit_close:.2f}",
            }
            await place_order(close_body, state.dry_run,
                              f"buy-to-close put {state.active_contract} (50% profit)")
            log.info("Early close: put %s @ $%.2f (≤50%% of $%.2f). Opening new put.",
                     state.active_contract, current_mid, state.active_premium)
            state.active_contract = state.active_order_id = None
            state.active_premium = state.active_strike = state.active_expiry = None
            await sell_new_put(state)
            return

        price_str = f"${current_mid:.2f}" if current_mid is not None else "unknown"
    except Exception as exc:
        log.warning("Could not fetch option price: %s", exc)
        price_str = "unknown"

    log.info(
        "[STAGE 1] Holding put %s | Strike $%.2f | Exp %s | Current mid %s",
        state.active_contract, state.active_strike or 0, state.active_expiry, price_str,
    )


# ── Stage 2: Sell Call ─────────────────────────────────────────────────────────
async def sell_new_call(state: WheelState) -> None:
    cost_basis = state.cost_basis or 0.0
    target_strike = round(cost_basis * 1.10, 2)
    log.info("Selling call — cost basis $%.2f, target strike $%.2f", cost_basis, target_strike)

    snapshots = await get_options_snapshots(
        state.symbol, "call",
        strike_gte=target_strike * 0.85,
        strike_lte=target_strike * 1.20,
    )

    expirations = filter_expirations(snapshots)
    if not expirations:
        state.last_action = "No call expiration found in 14–28 day range."
        log.warning(state.last_action)
        return

    target_exp = expirations[0]
    result = best_contract(snapshots, target_exp, "call", target_strike)
    if not result:
        state.last_action = f"No liquid call contract near ${target_strike:.2f} on {target_exp}."
        log.warning(state.last_action)
        return

    occ_sym, strike, mid = result

    # RULE: never sell call below cost basis
    if strike < cost_basis:
        state.last_action = (
            f"Call strike ${strike:.2f} < cost basis ${cost_basis:.2f} — "
            f"refusing to sell call below cost basis."
        )
        log.warning(state.last_action)
        return

    if mid <= 0:
        state.last_action = f"Call {occ_sym} has no bid — skipping."
        log.warning(state.last_action)
        return

    limit = round(mid * 0.95, 2)
    order_body = {
        "symbol":        occ_sym,
        "qty":           "1",
        "side":          "sell",
        "type":          "limit",
        "time_in_force": "day",
        "limit_price":   f"{limit:.2f}",
    }
    order = await place_order(order_body, state.dry_run, f"sell-to-open call {occ_sym}")

    state.active_contract = occ_sym
    state.active_order_id = order["id"]
    state.active_premium  = mid
    state.active_strike   = strike
    state.active_expiry   = target_exp
    state.total_premium  += mid * 100
    state.cycles_call    += 1
    state.last_action = (
        f"[STAGE 2] Sold call {occ_sym} @ ${mid:.2f}/share premium | "
        f"Strike ${strike:.2f} (cost basis ${cost_basis:.2f}) | Exp {target_exp} | "
        f"Total premium: ${state.total_premium:,.2f}"
    )
    log.info(state.last_action)


async def handle_sell_call(state: WheelState) -> None:
    if not state.active_contract:
        await sell_new_call(state)
        return

    # Check if shares were called away
    position = await get_position(state.symbol)
    if position is None or float(position.get("qty", 0)) < 100:
        state.stage     = "sell_put"
        state.shares_qty = 0
        state.cost_basis = None
        state.active_contract = state.active_order_id = None
        state.active_premium = state.active_strike = state.active_expiry = None
        state.last_action = "Shares called away. → Returning to STAGE 1 (sell_put)."
        log.info(state.last_action)
        return

    # Check expiry
    if state.active_expiry and date.today() > state.active_expiry:
        log.info("Call expired worthless (%s). Selling new call.", state.active_contract)
        state.active_contract = state.active_order_id = None
        state.active_premium = state.active_strike = state.active_expiry = None
        await sell_new_call(state)
        return

    # Check 50% profit
    try:
        snaps = await get_options_snapshots(state.symbol, "call",
            strike_gte=(state.active_strike or 0) * 0.9,
            strike_lte=(state.active_strike or 0) * 1.1,
        )
        current_mid = current_mid_from_snapshots(snaps, state.active_contract)
        if (
            current_mid is not None
            and state.active_premium
            and current_mid <= state.active_premium * 0.50
        ):
            limit_close = round(current_mid * 1.05, 2)
            close_body = {
                "symbol":        state.active_contract,
                "qty":           "1",
                "side":          "buy",
                "type":          "limit",
                "time_in_force": "day",
                "limit_price":   f"{limit_close:.2f}",
            }
            await place_order(close_body, state.dry_run,
                              f"buy-to-close call {state.active_contract} (50% profit)")
            log.info("Early close: call %s @ $%.2f (≤50%% of $%.2f). Opening new call.",
                     state.active_contract, current_mid, state.active_premium)
            state.active_contract = state.active_order_id = None
            state.active_premium = state.active_strike = state.active_expiry = None
            await sell_new_call(state)
            return

        price_str = f"${current_mid:.2f}" if current_mid is not None else "unknown"
    except Exception as exc:
        log.warning("Could not fetch option price: %s", exc)
        price_str = "unknown"

    log.info(
        "[STAGE 2] Holding call %s | Strike $%.2f | Exp %s | Current mid %s | Shares: %d",
        state.active_contract, state.active_strike or 0,
        state.active_expiry, price_str, state.shares_qty,
    )


# ── Dispatch ───────────────────────────────────────────────────────────────────
async def check_and_act(state: WheelState) -> None:
    if state.stage == "sell_put":
        await handle_sell_put(state)
    elif state.stage == "sell_call":
        await handle_sell_call(state)
    else:
        log.error("Unknown stage: %s", state.stage)


# ── Market hours (NYSE, ET) ────────────────────────────────────────────────────
# Use UTC-4 (EDT Apr–Nov). Switch to UTC-5 (EST) Nov–Mar manually if needed.
_ET = timezone(timedelta(hours=-4))

def _now_et() -> datetime:
    return datetime.now(_ET)

def is_market_hours() -> bool:
    now = _now_et()
    if now.weekday() >= 5:
        return False
    return time(9, 30) <= now.time() < time(16, 0)

def is_eod_summary_time() -> bool:
    now = _now_et()
    if now.weekday() >= 5:
        return False
    return time(16, 5) <= now.time() < time(16, 20)


# ── Daily summary ──────────────────────────────────────────────────────────────
async def print_daily_summary(state: WheelState) -> None:
    try:
        account = await get_account()
        equity = float(account.get("equity", 0))
        cash   = float(account.get("cash", 0))
        bp     = float(account.get("buying_power", 0))
        tsla   = await get_position(state.symbol)

        est_initial = equity - state.total_premium
        return_pct = (
            state.total_premium / est_initial * 100
            if est_initial > 0 else 0.0
        )

        print("\n" + "═" * 62)
        print(f"  DAILY SUMMARY — {date.today()}  ({state.symbol} Wheel Bot)")
        print("═" * 62)
        print(f"  Mode:               {'DRY RUN' if state.dry_run else '🟢 LIVE'}")
        print(f"  Stage:              {state.stage.upper()}")
        print(f"  Started:            {state.started_at.strftime('%Y-%m-%d %H:%M UTC')}")
        print(f"  Put cycles:         {state.cycles_put}")
        print(f"  Call cycles:        {state.cycles_call}")
        print()
        print(f"  Active contract:    {state.active_contract or '—'}")
        if state.active_strike:
            print(f"  Strike:             ${state.active_strike:.2f}")
        if state.active_expiry:
            print(f"  Expiry:             {state.active_expiry}")
        if state.active_premium:
            print(f"  Premium received:   ${state.active_premium:.2f}/share  (${state.active_premium*100:.2f} total)")
        print()
        print(f"  Shares held:        {state.shares_qty} × {state.symbol}")
        if state.cost_basis:
            print(f"  Cost basis/share:   ${state.cost_basis:.2f}")
        print()
        print(f"  Total premium:      ${state.total_premium:,.2f}")
        print(f"  Estimated return:   {return_pct:.2f}%")
        print(f"  Account equity:     ${equity:,.2f}")
        print(f"  Cash:               ${cash:,.2f}")
        print(f"  Buying power:       ${bp:,.2f}")

        if tsla:
            print(f"\n  {state.symbol} position:")
            print(f"    Qty:            {tsla.get('qty')} shares")
            print(f"    Avg entry:      ${tsla.get('avg_entry_price')}")
            print(f"    Current price:  ${tsla.get('current_price')}")
            print(f"    Unrealized P&L: ${tsla.get('unrealized_pl')}")
        else:
            print(f"\n  {state.symbol} position:     None")

        print(f"\n  Last action:")
        print(f"    {state.last_action}")
        print("═" * 62 + "\n")

    except Exception as exc:
        log.error("Daily summary error: %s", exc)


# ── Main loop ──────────────────────────────────────────────────────────────────
async def main() -> None:
    state = WheelState()
    mode = "DRY RUN" if state.dry_run else "LIVE"
    log.info("=== TSLA Wheel Bot [%s] started ===", mode)
    log.info("Symbol=%s  Poll=%dmin  Trading=%s", state.symbol, POLL_MIN, TRADING_BASE)

    poll_sec = POLL_MIN * 60

    while True:
        try:
            if is_market_hours():
                log.info("─── Market open — running cycle (stage=%s) ───", state.stage)
                await check_and_act(state)
            else:
                log.info("Market closed — waiting. Next check in %d min.", POLL_MIN)

            if is_eod_summary_time() and state.daily_summary_date != date.today():
                await print_daily_summary(state)
                state.daily_summary_date = date.today()

        except KeyboardInterrupt:
            raise
        except Exception as exc:
            log.error("Cycle error: %s", exc, exc_info=True)

        try:
            await asyncio.sleep(poll_sec)
        except asyncio.CancelledError:
            break


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopped by user.")
