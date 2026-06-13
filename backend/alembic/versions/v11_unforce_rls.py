"""v11 remove FORCE row-level security (keep RLS enabled)

Revision ID: v11_unforce_rls
Revises: v10_enable_rls
Create Date: 2026-06-13

v10 ran both ENABLE and FORCE ROW LEVEL SECURITY on every public table, but
defined no policies. v10's own docstring assumed "owners bypass RLS by default,
so this has zero impact" — which is true for ENABLE, but FORCE *removes* the
owner bypass. With RLS forced and no policy present, the table owner (the role
the FastAPI backend connects as via asyncpg) is denied on every SELECT/INSERT/
UPDATE/DELETE. That breaks all authenticated endpoints (e.g. POST /auth/set-pin
fails once it is reachable).

This migration drops FORCE on every table while leaving RLS ENABLED, which:
  * restores the owner-bypass the backend depends on (app works again), and
  * keeps the Supabase linter satisfied (RLS is still enabled, so unprivileged
    PostgREST roles anon/authenticated remain blocked).

Each ALTER is guarded by to_regclass() so a table that does not exist in a
given environment cannot abort the migration (and therefore cannot wedge
container startup).
"""
from __future__ import annotations

from alembic import op

revision = "v11_unforce_rls"
down_revision = "v10_enable_rls"
branch_labels = None
depends_on = None

# Mirrors v10_enable_rls._TABLES.
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


def _apply(action: str) -> None:
    tables_array = ", ".join(f"'{t}'" for t in _TABLES)
    op.execute(
        f"""
        DO $$
        DECLARE
            t text;
        BEGIN
            FOREACH t IN ARRAY ARRAY[{tables_array}]
            LOOP
                IF to_regclass('public.' || t) IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE public.%I {action} ROW LEVEL SECURITY', t);
                END IF;
            END LOOP;
        END $$;
        """
    )


def upgrade() -> None:
    # Keep RLS ENABLED; just drop FORCE so the owner bypasses again.
    _apply("NO FORCE")


def downgrade() -> None:
    _apply("FORCE")
