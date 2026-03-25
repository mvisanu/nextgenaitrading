"""v3_user_watchlist — add user_watchlist table

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-24 00:00:00.000000

Adds the user_watchlist table: a direct per-user ticker list for the
V3 Opportunities page watchlist.  Distinct from watchlist_ideas/
watchlist_idea_tickers which support the V2 idea management flow.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_watchlist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("alert_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "ticker", name="uq_user_watchlist_user_ticker"),
    )
    op.create_index("ix_user_watchlist_user_id", "user_watchlist", ["user_id"])
    op.create_index("ix_user_watchlist_ticker", "user_watchlist", ["ticker"])


def downgrade() -> None:
    op.drop_index("ix_user_watchlist_ticker", table_name="user_watchlist")
    op.drop_index("ix_user_watchlist_user_id", table_name="user_watchlist")
    op.drop_table("user_watchlist")
