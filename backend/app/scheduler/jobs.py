"""
APScheduler job registry for NextGenStock v2 + v3.

All background jobs are registered here with intervals read from settings.
Jobs are started/stopped in the FastAPI lifespan context in main.py.

All jobs are idempotent — safe for concurrent runs due to APScheduler's
coalesce=True default and the use of last_triggered_at / freshness checks.

V3 jobs added:
  run_live_scanner    — every 5 min, market hours, evaluates 10-condition gate
  run_idea_generator  — every 60 min, market hours, auto-generates idea cards
  run_news_scanner    — every 60 min, market hours, RSS news warmup/logging
  prune_old_signals   — daily, prunes buy_now_signals older than signal_prune_days
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.scheduler.tasks.evaluate_alerts import evaluate_alerts
from app.scheduler.tasks.evaluate_auto_buy import evaluate_auto_buy
from app.scheduler.tasks.prune_old_signals import prune_old_signals
from app.scheduler.tasks.refresh_buy_zones import refresh_buy_zones
from app.scheduler.tasks.refresh_theme_scores import refresh_theme_scores
from app.scheduler.tasks.run_commodity_alerts import run_commodity_alerts
from app.scheduler.tasks.run_idea_generator import run_idea_generator_job
from app.scheduler.tasks.run_live_scanner import run_live_scanner
from app.scheduler.tasks.run_news_scanner import run_news_scanner
from app.scheduler.tasks.scan_watchlist import scan_all_watchlists
from app.scheduler.tasks.trailing_bot_monitor import monitor_trailing_bots
from app.scheduler.tasks.copy_trading_monitor import monitor_copy_trading
from app.scheduler.tasks.wheel_bot_monitor import monitor_wheel_bots, wheel_bot_daily_summary

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def register_jobs() -> None:
    """Register all background jobs on the shared scheduler instance."""
    # ── V2 jobs ───────────────────────────────────────────────────────────────
    scheduler.add_job(
        refresh_buy_zones,
        "interval",
        minutes=settings.buy_zone_refresh_minutes,
        id="refresh_buy_zones",
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        refresh_theme_scores,
        "interval",
        minutes=settings.theme_score_refresh_minutes,
        id="refresh_theme_scores",
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        evaluate_alerts,
        "interval",
        minutes=settings.alert_eval_minutes,
        id="evaluate_alerts",
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        evaluate_auto_buy,
        "interval",
        minutes=settings.auto_buy_eval_minutes,
        id="evaluate_auto_buy",
        coalesce=True,
        max_instances=1,
    )
    scheduler.add_job(
        scan_all_watchlists,
        "interval",
        minutes=settings.watchlist_scan_minutes,
        id="scan_all_watchlists",
        coalesce=True,
        max_instances=1,
    )

    # ── V3 jobs ───────────────────────────────────────────────────────────────
    # Live scanner: every 5 min during market hours (internal guard via is_market_hours())
    scheduler.add_job(
        run_live_scanner,
        "interval",
        minutes=settings.live_scanner_minutes,
        id="run_live_scanner",
        coalesce=True,
        max_instances=1,
    )
    # Idea generator: every 60 min during market hours
    scheduler.add_job(
        run_idea_generator_job,
        "interval",
        minutes=settings.idea_generator_minutes,
        id="run_idea_generator",
        coalesce=True,
        max_instances=1,
    )
    # News scanner: every 60 min during market hours (standalone warmup pass)
    scheduler.add_job(
        run_news_scanner,
        "interval",
        minutes=settings.idea_generator_minutes,
        id="run_news_scanner",
        coalesce=True,
        max_instances=1,
    )
    # Signal pruning: daily at 02:00 UTC
    scheduler.add_job(
        prune_old_signals,
        "cron",
        hour=2,
        minute=0,
        id="prune_old_signals",
        coalesce=True,
        max_instances=1,
    )

    # ── Trailing bot monitor ──────────────────────────────────────────────────
    scheduler.add_job(
        monitor_trailing_bots,
        "interval",
        minutes=5,
        id="trailing_bot_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )

    # ── Copy trading monitor ──────────────────────────────────────────────────
    scheduler.add_job(
        monitor_copy_trading,
        "interval",
        minutes=15,
        id="copy_trading_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )

    # ── Commodity alerts ──────────────────────────────────────────────────────
    scheduler.add_job(
        run_commodity_alerts,
        "interval",
        minutes=settings.commodity_alert_minutes,
        id="run_commodity_alerts",
        coalesce=True,
        max_instances=1,
    )

    # ── Wheel bot monitor — 15 min during market hours ────────────────────────
    scheduler.add_job(
        monitor_wheel_bots,
        "interval",
        minutes=15,
        id="wheel_bot_monitor",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    # Daily summary at 16:05 ET = 21:05 UTC, Mon–Fri
    scheduler.add_job(
        wheel_bot_daily_summary,
        "cron",
        hour=21,
        minute=5,
        day_of_week="mon-fri",
        id="wheel_bot_daily_summary",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )

    logger.info(
        "Scheduler jobs registered: buy_zone=%dm theme=%dm alerts=%dm auto_buy=%dm "
        "scan=%dm live_scanner=%dm idea_gen=%dm prune_signals=daily commodity_alerts=%dm "
        "trailing_bot_monitor=5m copy_trading_monitor=15m",
        settings.buy_zone_refresh_minutes,
        settings.theme_score_refresh_minutes,
        settings.alert_eval_minutes,
        settings.auto_buy_eval_minutes,
        settings.watchlist_scan_minutes,
        settings.live_scanner_minutes,
        settings.idea_generator_minutes,
        settings.commodity_alert_minutes,
    )
