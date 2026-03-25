"""v3_buy_now_signals — add buy_now_signals table

Revision ID: c2d3e4f5a6b1
Revises: b1c2d3e4f5a6
Create Date: 2026-03-24 00:01:00.000000

Adds buy_now_signals: persistent audit trail of every 10-condition gate
evaluation.  All conditions are stored as individual boolean columns so
the UI can surface exactly which check passed or failed.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b1"
down_revision: Union[str, None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "buy_now_signals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        # ── Backtest layer ─────────────────────────────────────────────────────
        sa.Column("buy_zone_low", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("buy_zone_high", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("ideal_entry_price", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("backtest_confidence", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("backtest_win_rate_90d", sa.Numeric(precision=6, scale=4), nullable=False),
        # ── Live technical layer ───────────────────────────────────────────────
        sa.Column("current_price", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("price_in_zone", sa.Boolean(), nullable=False),
        sa.Column("above_50d_ma", sa.Boolean(), nullable=False),
        sa.Column("above_200d_ma", sa.Boolean(), nullable=False),
        sa.Column("rsi_value", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("rsi_confirms", sa.Boolean(), nullable=False),
        sa.Column("volume_confirms", sa.Boolean(), nullable=False),
        sa.Column("near_support", sa.Boolean(), nullable=False),
        sa.Column("trend_regime_bullish", sa.Boolean(), nullable=False),
        sa.Column("not_near_earnings", sa.Boolean(), nullable=False),
        sa.Column("no_duplicate_in_cooldown", sa.Boolean(), nullable=False),
        # ── Final decision ─────────────────────────────────────────────────────
        sa.Column("all_conditions_pass", sa.Boolean(), nullable=False),
        sa.Column("signal_strength", sa.String(length=20), nullable=False),
        sa.Column("suppressed_reason", sa.String(length=100), nullable=True),
        # ── Risk metadata ──────────────────────────────────────────────────────
        sa.Column("invalidation_price", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("expected_drawdown", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buy_now_signals_user_id", "buy_now_signals", ["user_id"])
    op.create_index("ix_buy_now_signals_ticker", "buy_now_signals", ["ticker"])
    op.create_index("ix_buy_now_signals_all_conditions_pass", "buy_now_signals", ["all_conditions_pass"])
    op.create_index("ix_buy_now_signals_created_at", "buy_now_signals", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_buy_now_signals_created_at", table_name="buy_now_signals")
    op.drop_index("ix_buy_now_signals_all_conditions_pass", table_name="buy_now_signals")
    op.drop_index("ix_buy_now_signals_ticker", table_name="buy_now_signals")
    op.drop_index("ix_buy_now_signals_user_id", table_name="buy_now_signals")
    op.drop_table("buy_now_signals")
