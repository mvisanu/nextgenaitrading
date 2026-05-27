"""v10 enable RLS on all public tables to satisfy Supabase linter

Revision ID: v10_enable_rls
Revises: v9_btc_bot
Create Date: 2026-05-27

The FastAPI backend connects as the table owner via asyncpg; owners bypass RLS
by default in PostgreSQL, so this has zero impact on application behaviour.
It blocks direct PostgREST access for unprivileged roles (anon/authenticated).
"""
from __future__ import annotations

from alembic import op

revision = "v10_enable_rls"
down_revision = "v9_btc_bot"
branch_labels = None
depends_on = None

_TABLES = [
    "users",
    "user_profiles",
    "user_sessions",
    "user_pins",
    "broker_credentials",
    "broker_orders",
    "strategy_runs",
    "trade_decisions",
    "position_snapshots",
    "cooldown_states",
    "trailing_stop_states",
    "backtest_trades",
    "variant_backtest_results",
    "winning_strategy_artifacts",
    "stock_buy_zone_snapshots",
    "stock_theme_scores",
    "watchlist_ideas",
    "watchlist_idea_tickers",
    "price_alert_rules",
    "auto_buy_settings",
    "auto_buy_decision_logs",
    "user_watchlist",
    "buy_now_signals",
    "generated_ideas",
    "options_positions",
    "options_executions",
    "iv_history",
    "trailing_bot_sessions",
    "copy_trading_sessions",
    "copied_politician_trades",
    "congress_copy_sessions",
    "congress_trades",
    "congress_copied_orders",
    "wheel_bot_sessions",
    "commodity_alert_prefs",
    "btc_bot_sessions",
    "btc_bot_actions",
]


def upgrade() -> None:
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
