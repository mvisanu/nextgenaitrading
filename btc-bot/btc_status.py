#!/usr/bin/env python3
"""
btc_status.py — Read-only status check for the BTC paper-trading account.

Shows:
  • Account ID + buying power + cash
  • Current BTC/USD position (qty, avg entry, market value, unrealized PnL)
  • Last 20 BTC/USD orders (any status)

Read-only. Submits no orders. Safe to run any time.
"""
from pathlib import Path
import os
import sys

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

API_KEY    = os.environ.get("VISANU_ALPACA_API_KEY") or os.environ.get("ALPACA_API_KEY", "")
SECRET_KEY = os.environ.get("VISANU_ALPACA_SECRET_KEY") or os.environ.get("ALPACA_SECRET_KEY", "")

if not API_KEY or not SECRET_KEY:
    sys.exit("ERROR: VISANU_ALPACA_API_KEY / VISANU_ALPACA_SECRET_KEY (or ALPACA_*) must be set")

from alpaca.trading.client import TradingClient
from alpaca.trading.enums import QueryOrderStatus
from alpaca.trading.requests import GetOrdersRequest

SYMBOL = "BTC/USD"
trading = TradingClient(API_KEY, SECRET_KEY, paper=True)

a = trading.get_account()
print(f"Account:        {a.id} (paper)")
print(f"Buying power:   ${float(a.buying_power):,.2f}")
print(f"Cash:           ${float(a.cash):,.2f}")
print(f"Portfolio val:  ${float(a.portfolio_value):,.2f}")

print()
print("=== POSITION ===")
# Alpaca returns crypto positions as "BTCUSD" but takes orders as "BTC/USD".
# Query all positions and match on normalized symbol to handle either format.
btc_pos = next(
    (p for p in trading.get_all_positions()
     if p.symbol.replace("/", "").upper() == SYMBOL.replace("/", "").upper()),
    None,
)
if btc_pos is None:
    print(f"  No {SYMBOL} position open.")
else:
    pl_pct = float(btc_pos.unrealized_plpc) * 100
    print(f"  {btc_pos.symbol}")
    print(f"    Qty:            {float(btc_pos.qty):.8f} BTC")
    print(f"    Avg entry:      ${float(btc_pos.avg_entry_price):,.2f}")
    print(f"    Current price:  ${float(btc_pos.current_price):,.2f}")
    print(f"    Market value:   ${float(btc_pos.market_value):,.2f}")
    print(f"    Unrealized PnL: ${float(btc_pos.unrealized_pl):,.2f} ({pl_pct:+.2f}%)")

print()
print(f"=== RECENT {SYMBOL} ORDERS (latest 20, any status) ===")
req = GetOrdersRequest(status=QueryOrderStatus.ALL, symbols=[SYMBOL], limit=20)
orders = trading.get_orders(filter=req)
if not orders:
    print("  (none)")
else:
    for o in orders:
        submitted = o.submitted_at.strftime("%Y-%m-%d %H:%M UTC") if o.submitted_at else "?"
        qty       = o.qty or o.notional or "?"
        filled_px = f"${float(o.filled_avg_price):,.2f}" if o.filled_avg_price else "--"
        print(f"  {submitted} | {o.side.value:4} | {o.order_type.value:8} | "
              f"qty={qty} | filled@{filled_px} | {o.status.value}")
