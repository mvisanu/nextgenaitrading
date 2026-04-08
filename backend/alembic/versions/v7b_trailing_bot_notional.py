"""v7b trailing_bot notional columns

Revision ID: v7b_trailing_bot_notional
Revises: v7_wheel_bot
Create Date: 2026-04-08
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v7b_trailing_bot_notional"
down_revision = "v7_wheel_bot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "trailing_bot_sessions",
        sa.Column("buy_amount_usd", sa.Float, nullable=True),
    )
    op.add_column(
        "trailing_bot_sessions",
        sa.Column("floor_pct", sa.Float, nullable=False, server_default="10.0"),
    )


def downgrade() -> None:
    op.drop_column("trailing_bot_sessions", "floor_pct")
    op.drop_column("trailing_bot_sessions", "buy_amount_usd")
