"""v7 wheel_bot_sessions table

Revision ID: v7_wheel_bot
Revises: v6_copy_trading
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v7_wheel_bot"
down_revision = "v6_copy_trading"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "wheel_bot_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Config
        sa.Column("symbol", sa.String(20), nullable=False, server_default="TSLA"),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        # Stage state machine
        sa.Column("stage", sa.String(20), nullable=False, server_default="sell_put"),
        # Active contract
        sa.Column("active_contract_symbol", sa.String(30), nullable=True),
        sa.Column("active_order_id", sa.String(100), nullable=True),
        sa.Column("active_premium_received", sa.Float, nullable=True),
        sa.Column("active_strike", sa.Float, nullable=True),
        sa.Column("active_expiry", sa.String(10), nullable=True),
        # Share position
        sa.Column("shares_qty", sa.Integer, nullable=False, server_default="0"),
        sa.Column("cost_basis_per_share", sa.Float, nullable=True),
        # Cumulative tracking
        sa.Column(
            "total_premium_collected", sa.Float, nullable=False, server_default="0.0"
        ),
        # Status
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("last_action", sa.String(500), nullable=True),
        sa.Column("last_summary_json", sa.Text, nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_wheel_bot_sessions_id",
        "wheel_bot_sessions",
        ["id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_wheel_bot_sessions_user_id",
        "wheel_bot_sessions",
        ["user_id"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_wheel_bot_sessions_user_id", table_name="wheel_bot_sessions", if_exists=True)
    op.drop_index("ix_wheel_bot_sessions_id", table_name="wheel_bot_sessions", if_exists=True)
    op.drop_table("wheel_bot_sessions")
