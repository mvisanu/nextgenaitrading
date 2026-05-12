#!/usr/bin/env python3
"""
btc_close_now.py — One-shot market-close of any open BTC/USD paper position on Alpaca.

Cancels any open BTC/USD orders (stop-loss, GTC limits, ladder triggers, etc.)
first to prevent them from firing after the position is closed, then submits a
single market sell for the entire qty.

Safe to run when no position is open — it prints a "nothing to close" message
and exits 0.

Usage:
  cd backend && source .venv/Scripts/activate
  python ../btc_close_now.py

Env vars (same as btc_trailing_bot.py / btc_execute_now.py):
  VISANU_ALPACA_API_KEY    — preferred
  VISANU_ALPACA_SECRET_KEY — preferred
  ALPACA_API_KEY           — fallback
  ALPACA_SECRET_KEY        — fallback
"""
import os
import sys
import time
import uuid as _uuid
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / "backend" / ".env")

API_KEY    = os.environ.get("VISANU_ALPACA_API_KEY") or os.environ.get("ALPACA_API_KEY", "")
SECRET_KEY = os.environ.get("VISANU_ALPACA_SECRET_KEY") or os.environ.get("ALPACA_SECRET_KEY", "")

if not API_KEY or not SECRET_KEY:
    sys.exit("ERROR: VISANU_ALPACA_API_KEY / VISANU_ALPACA_SECRET_KEY (or ALPACA_*) must be set")

from alpaca.common.exceptions import APIError
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import QueryOrderStatus
from alpaca.trading.requests import GetOrdersRequest

SYMBOL = "BTC/USD"
trading = TradingClient(API_KEY, SECRET_KEY, paper=True)


def fetch_position():
    """Return the BTC/USD position, or None if flat."""
    try:
        return trading.get_open_position(SYMBOL)
    except APIError as e:
        msg = str(e).lower()
        if "not found" in msg or "position does not exist" in msg or "404" in msg:
            return None
        raise


def cancel_open_btc_orders() -> int:
    """Cancel any open orders for BTC/USD. Returns count cancelled."""
    req = GetOrdersRequest(status=QueryOrderStatus.OPEN, symbols=[SYMBOL])
    orders = trading.get_orders(filter=req)
    cancelled = 0
    for o in orders:
        try:
            trading.cancel_order_by_id(_uuid.UUID(str(o.id)))
            cancelled += 1
            print(f"  Cancelled open order {str(o.id)[:8]}... ({o.side.value} {o.qty} @ "
                  f"{o.order_type.value}{f' ${o.stop_price}' if o.stop_price else ''})")
        except APIError as e:
            print(f"  WARN: could not cancel order {o.id}: {e}", file=sys.stderr)
    return cancelled


def main() -> None:
    account = trading.get_account()
    print(f"Account: {account.id} (paper)")
    print(f"Buying power: ${account.buying_power}")

    pos = fetch_position()
    if pos is None:
        print(f"\n  No open {SYMBOL} position. Nothing to close.")
        # Even with no position, sweep dangling orders so the next run starts clean.
        cancelled = cancel_open_btc_orders()
        if cancelled:
            print(f"  Cancelled {cancelled} dangling open order(s).")
        return

    qty           = float(pos.qty)
    avg_entry     = float(pos.avg_entry_price)
    market_value  = float(pos.market_value)
    unrealized_pl = float(pos.unrealized_pl)
    unrealized_pc = float(pos.unrealized_plpc) * 100

    print(f"\nOpen {SYMBOL} position:")
    print(f"  Qty:            {qty:.8f} BTC")
    print(f"  Avg entry:      ${avg_entry:,.2f}")
    print(f"  Market value:   ${market_value:,.2f}")
    print(f"  Unrealized PnL: ${unrealized_pl:,.2f} ({unrealized_pc:+.2f}%)")

    # Cancel stop-loss + any other open orders before closing — otherwise they
    # can fire after our market-sell and reopen a (short) position or reject.
    print(f"\nCancelling any open {SYMBOL} orders…")
    cancelled = cancel_open_btc_orders()
    if cancelled == 0:
        print("  (none)")
    # Brief settle so Alpaca releases the locked qty before we submit the close.
    time.sleep(1)

    print(f"\nSubmitting market-close for {qty:.8f} BTC…")
    close_order = trading.close_position(SYMBOL)
    print(f"  Close order submitted: {close_order.id}")

    # Poll up to 30s for fill.
    for _ in range(30):
        time.sleep(1)
        o = trading.get_order_by_id(_uuid.UUID(str(close_order.id)))
        if o.status.value in ("filled", "partially_filled"):
            filled_qty   = float(o.filled_qty or 0)
            filled_price = float(o.filled_avg_price or 0)
            proceeds     = filled_qty * filled_price
            realized_pl  = proceeds - (qty * avg_entry)
            print(f"\n  ✓ FILLED: sold {filled_qty:.8f} BTC @ ${filled_price:,.2f}")
            print(f"    Proceeds:     ${proceeds:,.2f}")
            print(f"    Realized PnL: ${realized_pl:,.2f}")
            return
        if o.status.value in ("canceled", "rejected", "expired"):
            sys.exit(f"\n  ✗ Close order ended in status: {o.status.value}")

    print(f"\n  WARN: close order {close_order.id} did not fill within 30s; "
          f"check Alpaca dashboard for status.")


if __name__ == "__main__":
    main()
