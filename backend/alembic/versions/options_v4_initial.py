"""options_v4_initial — Options Trading Engine tables

Revision ID: f5a6b1c2d3e4
Revises: e4f5a6b1c2d3
Create Date: 2026-03-30 00:00:00.000000

Creates options_positions, options_executions, and iv_history tables.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f5a6b1c2d3e4"
down_revision: Union[str, None] = "e4f5a6b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── options_positions ─────────────────────────────────────────────────────
    op.create_table(
        "options_positions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("strategy", sa.String(length=50), nullable=False),
        sa.Column("legs", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("broker", sa.String(length=30), nullable=False, server_default=sa.text("'alpaca'")),
        sa.Column("order_id", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default=sa.text("'open'")),
        sa.Column("entry_credit", sa.Float(), nullable=True),
        sa.Column("entry_debit", sa.Float(), nullable=True),
        sa.Column("max_profit", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("max_loss", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("breakeven_prices", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("probability_of_profit", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("iv_rank_at_entry", sa.Float(), nullable=False, server_default=sa.text("0.0")),
        sa.Column("days_to_expiry_at_entry", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "opened_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("realized_pnl", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_options_positions_user_id", "options_positions", ["user_id"])
    op.create_index("ix_options_positions_symbol", "options_positions", ["symbol"])

    # ── options_executions ────────────────────────────────────────────────────
    op.create_table(
        "options_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("signal", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("risk_model", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("order_request", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("order_result", sa.JSON(), nullable=True),
        sa.Column(
            "executed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("block_reason", sa.String(length=500), nullable=True),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_options_executions_user_id", "options_executions", ["user_id"])

    # ── iv_history ─────────────────────────────────────────────────────────────
    op.create_table(
        "iv_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("iv", sa.Float(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("symbol", "date", name="uq_iv_history_symbol_date"),
    )
    op.create_index("ix_iv_history_symbol", "iv_history", ["symbol"])


def downgrade() -> None:
    op.drop_table("iv_history")
    op.drop_table("options_executions")
    op.drop_table("options_positions")
