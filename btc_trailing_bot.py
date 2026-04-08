#!/usr/bin/env python3
"""
btc_trailing_bot.py — Standalone BTC trailing stop bot using Alpaca paper trading.

Rules:
  FLOOR:          Sell all if price drops 10% below fill price
  TRAILING FLOOR: Activates at +10% gain; stop = current * 0.95; advances every +5%; never goes down
  LADDER IN:      2-level DCA re-entry (larger buys at deeper discounts):
                    Level 1: -20% from original entry  → $1,000
                    Level 2: -30% from original entry  → $2,000
                  Each level fires once per session. Floor never moves down.

Usage:
  cd backend && source .venv/Scripts/activate
  python ../btc_trailing_bot.py

Config (environment variables):
  ALPACA_API_KEY        — Alpaca API key (required)
  ALPACA_SECRET_KEY     — Alpaca secret key (required)
  BTC_USD=1000          — dollar amount to buy initially (default 1000)
  POLL_INTERVAL_SEC=30  — polling interval in seconds (default 30)
"""
import os
import time
import logging
import uuid as _uuid
from decimal import Decimal, ROUND_DOWN

# --- Config ---
API_KEY    = os.environ.get("VISANU_ALPACA_API_KEY") or os.environ.get("ALPACA_API_KEY", "")
SECRET_KEY = os.environ.get("VISANU_ALPACA_SECRET_KEY") or os.environ.get("ALPACA_SECRET_KEY", "")
BTC_USD = float(os.environ.get("BTC_USD", "1000"))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SEC", "30"))
PAPER_URL = "https://paper-api.alpaca.markets"

# Ladder levels: (drop_pct_from_entry, buy_usd)
# Fires once per session at each level; floor never moves down after a ladder fill.
LADDER_LEVELS = [
    (0.20, 1000.0),   # Level 1: -20% → $1,000  (normal correction)
    (0.30, 2000.0),   # Level 2: -30% → $2,000  (deep pullback, max conviction)
]

# --- Logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("btc_bot")

# --- Alpaca client ---
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import CryptoHistoricalDataClient
from alpaca.data.requests import CryptoLatestQuoteRequest

trading = TradingClient(API_KEY, SECRET_KEY, paper=True)
data_client = CryptoHistoricalDataClient(API_KEY, SECRET_KEY)


def get_btc_ask() -> float:
    """Get latest BTC/USD ask price."""
    req = CryptoLatestQuoteRequest(symbol_or_symbols="BTC/USD")
    quote = data_client.get_crypto_latest_quote(req)
    return float(quote["BTC/USD"].ask_price)


def buy_btc(usd_amount: float) -> tuple[float, float]:
    """
    Buy BTC/USD for usd_amount dollars.
    Returns (filled_qty, avg_fill_price).
    """
    ask = get_btc_ask()
    qty = Decimal(str(usd_amount / ask)).quantize(Decimal("0.00000001"), rounding=ROUND_DOWN)
    log.info("Buying %.8f BTC @ ~$%.2f (total: $%.2f)", float(qty), ask, usd_amount)
    req = MarketOrderRequest(
        symbol="BTC/USD",
        qty=float(qty),
        side=OrderSide.BUY,
        time_in_force=TimeInForce.GTC,
    )
    order = trading.submit_order(req)
    # Poll until filled — give up after 60 retries (60 s) to avoid infinite hang
    max_retries = 60
    for attempt in range(max_retries):
        o = trading.get_order_by_id(_uuid.UUID(str(order.id)))
        if o.status.value in ("filled", "partially_filled"):
            filled_qty = float(o.filled_qty or qty)
            filled_price = float(o.filled_avg_price or ask)
            log.info("Filled: %.8f BTC @ $%.2f", filled_qty, filled_price)
            return filled_qty, filled_price
        time.sleep(1)
    raise TimeoutError(
        f"Order {order.id} did not fill within {max_retries} seconds (status={o.status.value})"
    )


def sell_all_btc(qty: float, reason: str) -> None:
    """Sell all BTC at market."""
    log.info("SELLING %.8f BTC — Reason: %s", qty, reason)
    req = MarketOrderRequest(
        symbol="BTC/USD",
        qty=round(qty, 8),
        side=OrderSide.SELL,
        time_in_force=TimeInForce.GTC,
    )
    trading.submit_order(req)


def main() -> None:
    if not API_KEY or not SECRET_KEY:
        raise SystemExit("ERROR: ALPACA_API_KEY and ALPACA_SECRET_KEY must be set")

    # Check account
    account = trading.get_account()
    log.info("Account: %s | Buying power: $%s", account.id, account.buying_power)

    # ── Initial buy ──────────────────────────────────────────────────────────────
    qty, entry_price = buy_btc(BTC_USD)

    # ── Rule parameters ──────────────────────────────────────────────────────────
    floor_price = round(entry_price * 0.90, 2)          # FLOOR: -10% from entry
    trailing_active = False
    trailing_high = entry_price
    current_floor = floor_price
    ladder_next = 0          # index into LADDER_LEVELS; 0 = none fired yet
    total_qty = qty
    blended_entry = entry_price

    log.info("=== Bot started ===")
    log.info("  Entry price:    $%.2f", entry_price)
    log.info("  Qty:            %.8f BTC", total_qty)
    log.info("  FLOOR:          $%.2f (-10%%)", floor_price)
    log.info("  Trailing floor: activates at $%.2f (+10%%)", round(entry_price * 1.10, 2))
    for i, (drop, usd) in enumerate(LADDER_LEVELS):
        log.info("  Ladder L%d:      $%.2f (-%d%%) -> $%.0f buy", i + 1,
                 round(entry_price * (1 - drop), 2), int(drop * 100), usd)
    log.info("  Poll interval:  %ds", POLL_INTERVAL)

    # ── Monitoring loop ──────────────────────────────────────────────────────────
    try:
        while True:
            time.sleep(POLL_INTERVAL)
            price = get_btc_ask()
            gain_pct = ((price - blended_entry) / blended_entry) * 100
            log.info(
                "Price: $%.2f | Gain: %.2f%% | Floor: $%.2f | Trailing: %s",
                price, gain_pct, current_floor, "ON" if trailing_active else "OFF",
            )

            # ── FLOOR check ──────────────────────────────────────────────────────
            if price <= current_floor:
                sell_all_btc(total_qty, f"FLOOR hit @ ${price:.2f}")
                break

            # ── TRAILING FLOOR ────────────────────────────────────────────────────
            if not trailing_active:
                if gain_pct >= 10.0:
                    trailing_active = True
                    trailing_high = price
                    new_floor = round(price * 0.95, 2)
                    if new_floor > current_floor:
                        current_floor = new_floor
                    log.info("TRAILING FLOOR activated. New floor: $%.2f", current_floor)
            else:
                if price > trailing_high:
                    step_pct = ((price - trailing_high) / trailing_high) * 100
                    if step_pct >= 5.0:
                        new_floor = round(price * 0.95, 2)
                        if new_floor > current_floor:
                            current_floor = new_floor
                            trailing_high = price
                            log.info(
                                "TRAILING FLOOR raised to $%.2f (price: $%.2f)",
                                current_floor, price,
                            )

            # ── LADDER IN (3 levels) ──────────────────────────────────────────────
            if ladder_next < len(LADDER_LEVELS):
                drop_pct, buy_usd = LADDER_LEVELS[ladder_next]
                ladder_trigger = round(entry_price * (1 - drop_pct), 2)
                if price <= ladder_trigger:
                    log.info(
                        "LADDER L%d triggered at $%.2f (-%d%% from original entry $%.2f) — buying $%.0f",
                        ladder_next + 1, price, int(drop_pct * 100), entry_price, buy_usd,
                    )
                    ladder_qty, ladder_price = buy_btc(buy_usd)
                    total_cost = (total_qty * blended_entry) + (ladder_qty * ladder_price)
                    total_qty += ladder_qty
                    blended_entry = round(total_cost / total_qty, 2)
                    ladder_next += 1
                    # Floor only moves up — never down
                    new_floor = round(blended_entry * 0.90, 2)
                    if new_floor > current_floor:
                        current_floor = new_floor
                    remaining = len(LADDER_LEVELS) - ladder_next
                    log.info(
                        "Ladder L%d filled. Blended entry: $%.2f | Floor: $%.2f | "
                        "Total qty: %.8f | Ladders remaining: %d",
                        ladder_next, blended_entry, current_floor, total_qty, remaining,
                    )

    except KeyboardInterrupt:
        log.info("=== Bot stopped by user ===")

    log.info("=== Final summary ===")
    log.info("  Total BTC held:   %.8f", total_qty)
    log.info("  Blended entry:    $%.2f", blended_entry)
    log.info("  Current floor:    $%.2f", current_floor)
    log.info("  Trailing:         %s", "ON" if trailing_active else "OFF")
    log.info("  Ladders fired:    %d / %d", ladder_next, len(LADDER_LEVELS))
    log.info("  (Position remains open on Alpaca — manage manually or re-run bot)")


if __name__ == "__main__":
    main()
