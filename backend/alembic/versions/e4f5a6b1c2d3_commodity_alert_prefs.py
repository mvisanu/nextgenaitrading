"""commodity_alert_prefs — per-user commodity signal notification preferences

Revision ID: e4f5a6b1c2d3
Revises: d3e4f5a6b1c2
Create Date: 2026-03-30 00:00:00.000000

Adds commodity_alert_prefs: stores each user's email/phone destination
and per-symbol watchlist for real-time commodity buy-signal alerts.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e4f5a6b1c2d3"
down_revision: Union[str, None] = "d3e4f5a6b1c2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "commodity_alert_prefs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("alert_email", sa.String(length=255), nullable=True),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("alert_phone", sa.String(length=30), nullable=True),
        sa.Column("symbols", sa.JSON(), nullable=False, server_default='["XAUUSD"]'),
        sa.Column("min_confidence", sa.Integer(), nullable=False, server_default="70"),
        sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("last_alerted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_commodity_alert_prefs_id", "commodity_alert_prefs", ["id"])
    op.create_index("ix_commodity_alert_prefs_user_id", "commodity_alert_prefs", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_commodity_alert_prefs_user_id", table_name="commodity_alert_prefs")
    op.drop_index("ix_commodity_alert_prefs_id", table_name="commodity_alert_prefs")
    op.drop_table("commodity_alert_prefs")
