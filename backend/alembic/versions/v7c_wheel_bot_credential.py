"""v7c add credential_id to wheel_bot_sessions

Revision ID: v7c_wheel_bot_credential
Revises: v6b_copy_trading_credential
Create Date: 2026-04-08
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v7c_wheel_bot_credential"
down_revision = "v6b_copy_trading_credential"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "wheel_bot_sessions",
        sa.Column(
            "credential_id",
            sa.Integer,
            sa.ForeignKey("broker_credentials.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("wheel_bot_sessions", "credential_id")
