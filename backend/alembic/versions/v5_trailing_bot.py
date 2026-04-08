"""v5 trailing_bot_sessions table

Revision ID: v5_trailing_bot
Revises: g6h7i8j9k0l1
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v5_trailing_bot"
down_revision = "g6h7i8j9k0l1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trailing_bot_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "credential_id",
            sa.Integer,
            sa.ForeignKey("broker_credentials.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("symbol", sa.String(20), nullable=False),
        sa.Column("initial_qty", sa.Float, nullable=False),
        sa.Column("entry_price", sa.Float, nullable=True),
        sa.Column("initial_order_id", sa.String(100), nullable=True),
        sa.Column("stop_order_id", sa.String(100), nullable=True),
        sa.Column("floor_price", sa.Float, nullable=False),
        sa.Column(
            "trailing_trigger_pct", sa.Float, nullable=False, server_default="10.0"
        ),
        sa.Column(
            "trailing_trail_pct", sa.Float, nullable=False, server_default="5.0"
        ),
        sa.Column(
            "trailing_step_pct", sa.Float, nullable=False, server_default="5.0"
        ),
        sa.Column(
            "trailing_active", sa.Boolean, nullable=False, server_default="false"
        ),
        sa.Column("trailing_high_water", sa.Float, nullable=True),
        sa.Column("current_floor", sa.Float, nullable=True),
        sa.Column("ladder_rules_json", sa.Text, nullable=True),
        sa.Column("dry_run", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "status", sa.String(20), nullable=False, server_default="active"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_trailing_bot_sessions_user_id", "trailing_bot_sessions", ["user_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_trailing_bot_sessions_user_id", table_name="trailing_bot_sessions", if_exists=True)
    op.drop_table("trailing_bot_sessions")
