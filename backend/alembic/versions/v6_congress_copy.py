"""v6 congress_copy tables

Revision ID: v6_congress_copy
Revises: v5_trailing_bot
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v6_congress_copy"
down_revision = "v5_trailing_bot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── CongressCopySession ──────────────────────────────────────────────────
    op.create_table(
        "congress_copy_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("politician_party", sa.String(50), nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_trade_date", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_congress_copy_sessions_user_id",
        "congress_copy_sessions",
        ["user_id"],
        if_not_exists=True,
    )

    # ── CongressTrade ────────────────────────────────────────────────────────
    op.create_table(
        "congress_trades",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("capitol_trade_id", sa.String(100), nullable=False),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_name", sa.String(500), nullable=True),
        sa.Column("asset_type", sa.String(50), nullable=True),
        sa.Column("option_type", sa.String(10), nullable=True),
        sa.Column("trade_type", sa.String(20), nullable=False),
        sa.Column("size_range", sa.String(50), nullable=True),
        sa.Column("trade_date", sa.String(20), nullable=True),
        sa.Column("reported_at", sa.String(20), nullable=True),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("session_id", "capitol_trade_id", name="uq_congress_trades_session_trade"),
    )
    op.create_index(
        "ix_congress_trades_session_id",
        "congress_trades",
        ["session_id"],
        if_not_exists=True,
    )

    # ── CongressCopiedOrder ──────────────────────────────────────────────────
    op.create_table(
        "congress_copied_orders",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("congress_copy_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "congress_trade_id",
            sa.Integer,
            sa.ForeignKey("congress_trades.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("symbol", sa.String(50), nullable=False),
        sa.Column("side", sa.String(10), nullable=False),
        sa.Column("qty", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("order_type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="submitted"),
        sa.Column("filled_price", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_congress_copied_orders_session_id",
        "congress_copied_orders",
        ["session_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_congress_copied_orders_session_id", table_name="congress_copied_orders", if_exists=True)
    op.drop_table("congress_copied_orders")
    op.drop_index("ix_congress_trades_session_id", table_name="congress_trades", if_exists=True)
    op.drop_table("congress_trades")
    op.drop_index("ix_congress_copy_sessions_user_id", table_name="congress_copy_sessions", if_exists=True)
    op.drop_table("congress_copy_sessions")
