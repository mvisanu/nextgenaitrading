"""
APScheduler jobs for the politician copy trader.

Schedule:
  - Every POLL_INTERVAL_MIN minutes (during US market hours): check for new trades
  - Every RERANK_INTERVAL_HOURS hours: re-rank politicians and update target
  - Every morning at 8:00 AM ET: print portfolio summary
"""
import json
import logging
from datetime import datetime, timezone

import pytz
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

import config
import trade_tracker
from capitol_scraper import fetch_recent_trades, fetch_politician_trades
from politician_ranker import get_best_politician, rank_politicians, print_rankings
from copy_trader import copy_trade, get_portfolio_summary

logger = logging.getLogger(__name__)

ET = pytz.timezone("America/New_York")

# Global: which politician we're currently following
_current_politician_id: str = ""
_current_politician_name: str = ""


def _is_market_hours() -> bool:
    """Returns True during US regular market hours (9:30–16:00 ET)."""
    now_et = datetime.now(ET)
    if now_et.weekday() >= 5:  # Saturday/Sunday
        return False
    open_time = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    close_time = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    return open_time <= now_et <= close_time


def _set_politician(politician_id: str, politician_name: str) -> None:
    global _current_politician_id, _current_politician_name
    _current_politician_id = politician_id
    _current_politician_name = politician_name
    trade_tracker.set_state("current_politician_id", politician_id)
    trade_tracker.set_state("current_politician_name", politician_name)
    logger.info(f"Now following: {politician_name} ({politician_id})")


# ---------------------------------------------------------------------------
# Job: Poll for new trades
# ---------------------------------------------------------------------------

def job_poll_trades() -> None:
    """
    Fetch recent trades from Capitol Trades and copy any new ones
    from the tracked politician.
    """
    global _current_politician_id

    if not _current_politician_id:
        logger.info("No target politician set yet — skipping poll")
        return

    logger.info(f"Polling Capitol Trades for {_current_politician_name}...")

    try:
        # Fetch last 2 pages of site-wide recent trades first (fast)
        recent = fetch_recent_trades(page=1, page_size=96)
        relevant = [t for t in recent if t.politician_id == _current_politician_id]

        if not relevant:
            # Fall back to politician-specific page
            relevant = fetch_politician_trades(_current_politician_id, days_back=7)

        new_trades = [t for t in relevant if not trade_tracker.is_trade_copied(t.trade_id)]

        if not new_trades:
            logger.info(f"No new trades from {_current_politician_name}")
            return

        logger.info(f"Found {len(new_trades)} new trade(s) from {_current_politician_name}!")
        for trade in new_trades:
            copy_trade(trade)

    except Exception as e:
        logger.error(f"Poll job error: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Job: Re-rank politicians
# ---------------------------------------------------------------------------

def job_rerank() -> None:
    """Re-rank politicians and switch target if a better one is found."""
    global _current_politician_id

    logger.info("Re-ranking politicians...")
    try:
        scores = rank_politicians()
        if not scores:
            logger.warning("Ranking returned no results")
            return

        trade_tracker.save_ranking(scores)
        print_rankings(scores)

        best = scores[0]

        if best.politician_id != _current_politician_id:
            logger.info(
                f"Switching from {_current_politician_name} -> {best.politician_name} "
                f"(score {best.score:.1f})"
            )
            _set_politician(best.politician_id, best.politician_name)
        else:
            logger.info(f"Keeping current target: {best.politician_name}")

    except Exception as e:
        logger.error(f"Rerank job error: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Job: Morning summary
# ---------------------------------------------------------------------------

def job_morning_summary() -> None:
    """Print portfolio status at market open."""
    logger.info("=== Morning Summary ===")
    summary = get_portfolio_summary()
    if summary:
        print(f"\n  Account equity:    ${summary['equity']:,.2f}")
        print(f"  Buying power:      ${summary['buying_power']:,.2f}")
        print(f"  Open orders:       {summary['open_orders']}")
        print(f"  Positions ({len(summary['positions'])}):")
        for pos in summary["positions"]:
            pl_sign = "+" if pos["unrealized_pl"] >= 0 else ""
            print(
                f"    {pos['symbol']:<8} {pos['qty']:.4f} shares  "
                f"MV=${pos['market_value']:,.2f}  "
                f"P/L={pl_sign}{pos['unrealized_pl']:,.2f} ({pl_sign}{pos['unrealized_plpc']:.1f}%)"
            )
        print()

    # Show recent copied trades
    trades = trade_tracker.get_all_copied_trades()[:10]
    if trades:
        print(f"  Last {len(trades)} copied trades:")
        for t in trades:
            print(
                f"    [{t['alpaca_status']}] {t['trade_type'].upper()} {t['ticker']} "
                f"${t['copy_amount_usd']:.0f} "
                f"({'DRY RUN' if t['dry_run'] else 'LIVE'}) "
                f"— {t['created_at'][:19]}"
            )
    print()


# ---------------------------------------------------------------------------
# Seed: mark all existing trades as seen (no order placed)
# ---------------------------------------------------------------------------

def _seed_existing_trades() -> None:
    """
    On startup, mark every existing disclosure for the current politician
    as already processed (status='pre-existing', no Alpaca order).
    This prevents bulk-copying weeks of old history on first poll.
    Only seeds trades not already in the DB.
    """
    if not _current_politician_id:
        return

    from capitol_scraper import fetch_all_recent_trades
    from datetime import date, timedelta

    all_trades = fetch_all_recent_trades()
    politician_trades = [t for t in all_trades if t.politician_id == _current_politician_id]

    seeded = 0
    for trade in politician_trades:
        if not trade_tracker.is_trade_copied(trade.trade_id):
            trade_tracker.record_copied_trade(
                trade=trade,
                alpaca_order_id=None,
                alpaca_status="pre-existing",
                copy_amount_usd=0.0,
                dry_run=False,
                notes="Seeded on startup — trade existed before bot started",
            )
            seeded += 1

    if seeded:
        logger.info(
            f"Seeded {seeded} pre-existing {_current_politician_name} trades as already-seen. "
            f"Only NEW disclosures from now on will trigger orders."
        )
    else:
        logger.info(f"No new pre-existing trades to seed for {_current_politician_name}.")


# ---------------------------------------------------------------------------
# Start scheduler
# ---------------------------------------------------------------------------

def start_scheduler() -> None:
    """Initialize DB, do initial ranking, then start APScheduler."""
    trade_tracker.init_db()

    # Restore state from DB if exists
    saved_pid = trade_tracker.get_state("current_politician_id")
    saved_pname = trade_tracker.get_state("current_politician_name")
    if saved_pid:
        _set_politician(saved_pid, saved_pname or saved_pid)
        logger.info(f"Restored target from DB: {saved_pname}")
    elif config.TARGET_POLITICIAN:
        _set_politician(config.TARGET_POLITICIAN, config.TARGET_POLITICIAN)

    # Initial ranking on startup
    logger.info("Running initial politician ranking on startup...")
    job_rerank()

    # Seed existing trades as already-seen so we don't bulk-copy history
    _seed_existing_trades()

    # Print morning summary at startup
    job_morning_summary()

    scheduler = BlockingScheduler(timezone=ET)

    # Poll for new trades every N minutes
    scheduler.add_job(
        job_poll_trades,
        trigger=IntervalTrigger(minutes=config.POLL_INTERVAL_MIN),
        id="poll_trades",
        name="Poll Capitol Trades",
        misfire_grace_time=120,
    )

    # Re-rank every N hours
    scheduler.add_job(
        job_rerank,
        trigger=IntervalTrigger(hours=config.RERANK_INTERVAL_HOURS),
        id="rerank",
        name="Re-rank politicians",
        misfire_grace_time=600,
    )

    # Morning summary at 8:00 AM ET every weekday
    scheduler.add_job(
        job_morning_summary,
        trigger=CronTrigger(day_of_week="mon-fri", hour=8, minute=0, timezone=ET),
        id="morning_summary",
        name="Morning portfolio summary",
    )

    mode = "DRY RUN" if config.DRY_RUN else "LIVE TRADING"
    logger.info(f"Scheduler started [{mode}] — polling every {config.POLL_INTERVAL_MIN} min")
    logger.info(f"Following: {_current_politician_name or 'TBD after ranking'}")
    logger.info("Press Ctrl+C to stop.\n")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler stopped.")
