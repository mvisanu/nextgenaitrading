"""v6 copy_trading tables

Revision ID: v6_copy_trading
Revises: v5_trailing_bot
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v6_copy_trading"
down_revision = "v5_trailing_bot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "copy_trading_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("copy_amount_usd", sa.Float, nullable=False, server_default="300"),
        sa.Column("target_politician_id", sa.String(100), nullable=True),
        sa.Column("target_politician_name", sa.String(200), nullable=True),
        sa.Column(
            "activated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_copy_trading_sessions_user_id",
        "copy_trading_sessions",
        ["user_id"],
        if_not_exists=True,
    )

    op.create_table(
        "copied_politician_trades",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "session_id",
            sa.Integer,
            sa.ForeignKey("copy_trading_sessions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("trade_id", sa.String(300), nullable=False),
        sa.Column("politician_id", sa.String(100), nullable=False),
        sa.Column("politician_name", sa.String(200), nullable=False),
        sa.Column("ticker", sa.String(20), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("trade_type", sa.String(10), nullable=False),
        sa.Column("trade_date", sa.Date, nullable=True),
        sa.Column("disclosure_date", sa.Date, nullable=True),
        sa.Column("amount_low", sa.Float, nullable=True),
        sa.Column("amount_high", sa.Float, nullable=True),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("alpaca_status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("copy_amount_usd", sa.Float, nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("notes", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_copied_politician_trades_user_id",
        "copied_politician_trades",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_copied_politician_trades_session_id",
        "copied_politician_trades",
        ["session_id"],
        if_not_exists=True,
    )
    op.create_unique_constraint(
        "uq_user_trade",
        "copied_politician_trades",
        ["user_id", "trade_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_copied_politician_trades_session_id", table_name="copied_politician_trades", if_exists=True)
    op.drop_index("ix_copied_politician_trades_user_id", table_name="copied_politician_trades", if_exists=True)
    op.drop_table("copied_politician_trades")
    op.drop_index("ix_copy_trading_sessions_user_id", table_name="copy_trading_sessions", if_exists=True)
    op.drop_table("copy_trading_sessions")
