"""v6b add credential_id to copy_trading_sessions

Revision ID: v6b_copy_trading_credential
Revises: v6_copy_trading
Create Date: 2026-04-08
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v6b_copy_trading_credential"
down_revision = "v7b_trailing_bot_notional"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "copy_trading_sessions",
        sa.Column(
            "credential_id",
            sa.Integer,
            sa.ForeignKey("broker_credentials.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("copy_trading_sessions", "credential_id")
