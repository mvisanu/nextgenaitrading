"""
Scheduler task: BTC trailing-bot heartbeat monitor.

Read-only observability for the standalone ``btc-bot/btc_trailing_bot.py`` daemon.
Fires on a configurable interval (``settings.btc_bot_monitor_minutes``, default 5)
and logs a single line summarising the current BTC paper-trading state:

  • Account balances (cash, buying power)
  • Current BTC position (qty, avg entry, market value, unrealized PnL)
  • Last filled BTC/USD order timestamp

This task does NOT trade. It is intended purely to surface in the ``/crons`` UI
so the operator has one place to see "yes, the BTC bot infrastructure is alive
and the position looks like this." The trading loop itself remains in the
standalone daemon (or its eventual APScheduler refactor).

Uses the same credential resolution as the standalone bot:
  VISANU_ALPACA_API_KEY / VISANU_ALPACA_SECRET_KEY  preferred
  ALPACA_API_KEY        / ALPACA_SECRET_KEY         fallback
"""
from __future__ import annotations

import asyncio
import gc
import logging
import os

logger = logging.getLogger(__name__)

SYMBOL = "BTC/USD"


def _resolve_creds() -> tuple[str, str]:
    """Return (api_key, secret_key) preferring VISANU_* over ALPACA_*."""
    api = os.environ.get("VISANU_ALPACA_API_KEY") or os.environ.get("ALPACA_API_KEY", "")
    sec = os.environ.get("VISANU_ALPACA_SECRET_KEY") or os.environ.get("ALPACA_SECRET_KEY", "")
    return api, sec


def _sync_heartbeat() -> str:
    """Run the synchronous Alpaca queries and return a one-line summary."""
    from alpaca.trading.client import TradingClient
    from alpaca.trading.enums import QueryOrderStatus
    from alpaca.trading.requests import GetOrdersRequest

    api_key, secret_key = _resolve_creds()
    if not api_key or not secret_key:
        return "btc_bot_monitor: creds missing (VISANU_ALPACA_* / ALPACA_* both unset) — skipping"

    trading = TradingClient(api_key, secret_key, paper=True)
    account = trading.get_account()

    # Alpaca returns crypto positions with the slash stripped (e.g. BTCUSD).
    # Match on normalized symbol to handle either form.
    target = SYMBOL.replace("/", "").upper()
    btc_pos = next(
        (p for p in trading.get_all_positions()
         if p.symbol.replace("/", "").upper() == target),
        None,
    )

    last_order = None
    orders = trading.get_orders(
        filter=GetOrdersRequest(status=QueryOrderStatus.ALL, symbols=[SYMBOL], limit=1)
    )
    if orders:
        last_order = orders[0]

    cash = float(account.cash)
    bp = float(account.buying_power)

    if btc_pos is None:
        pos_str = "no position"
    else:
        qty = float(btc_pos.qty)
        avg = float(btc_pos.avg_entry_price)
        mv = float(btc_pos.market_value)
        pl = float(btc_pos.unrealized_pl)
        pct = float(btc_pos.unrealized_plpc) * 100
        pos_str = (
            f"qty={qty:.8f} BTC @ avg ${avg:,.2f} | mkt ${mv:,.2f} | "
            f"PnL ${pl:+,.2f} ({pct:+.2f}%)"
        )

    if last_order:
        ts = last_order.submitted_at.strftime("%Y-%m-%d %H:%M UTC") if last_order.submitted_at else "?"
        order_str = f"last order: {last_order.side.value} {last_order.qty or last_order.notional} @ {ts} ({last_order.status.value})"
    else:
        order_str = "no order history"

    return (
        f"btc_bot_monitor: cash=${cash:,.2f} bp=${bp:,.2f} | {pos_str} | {order_str}"
    )


async def monitor_btc_bot() -> None:
    """Async wrapper — runs the sync Alpaca queries in a thread to avoid blocking the loop."""
    try:
        summary = await asyncio.to_thread(_sync_heartbeat)
        logger.info(summary)
    except Exception as e:
        logger.exception("btc_bot_monitor: unhandled error: %s", e)
    finally:
        gc.collect()
