"""v3_generated_ideas — add generated_ideas table

Revision ID: d3e4f5a6b1c2
Revises: c2d3e4f5a6b1
Create Date: 2026-03-24 00:02:00.000000

Adds generated_ideas: the output table of the auto-idea engine.
Rows are replaced each scanner run and expire after 24 hours.
No user_id — ideas are system-wide and visible to all authenticated users.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d3e4f5a6b1c2"
down_revision: Union[str, None] = "c2d3e4f5a6b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "generated_ideas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        # ── Source / why flagged ────────────────────────────────────────────────
        sa.Column("source", sa.String(length=20), nullable=False),          # news|theme|technical
        sa.Column("reason_summary", sa.Text(), nullable=False),
        sa.Column("news_headline", sa.Text(), nullable=True),
        sa.Column("news_url", sa.String(length=1000), nullable=True),
        sa.Column("news_source", sa.String(length=100), nullable=True),
        sa.Column("catalyst_type", sa.String(length=50), nullable=True),
        # ── Price / zone ────────────────────────────────────────────────────────
        sa.Column("current_price", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("buy_zone_low", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("buy_zone_high", sa.Numeric(precision=12, scale=4), nullable=True),
        sa.Column("ideal_entry_price", sa.Numeric(precision=12, scale=4), nullable=True),
        # ── Scores ─────────────────────────────────────────────────────────────
        sa.Column("confidence_score", sa.Numeric(precision=6, scale=4), nullable=False),
        sa.Column("historical_win_rate_90d", sa.Numeric(precision=6, scale=4), nullable=True),
        sa.Column("theme_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("megatrend_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("moat_score", sa.Numeric(precision=6, scale=4), nullable=False, server_default="0"),
        sa.Column("moat_description", sa.String(length=300), nullable=True),
        sa.Column("financial_quality_score", sa.Numeric(precision=6, scale=4), nullable=False, server_default="0"),
        sa.Column("financial_flags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("near_52w_low", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("at_weekly_support", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("entry_priority", sa.String(length=20), nullable=False, server_default="STANDARD"),
        sa.Column("idea_score", sa.Numeric(precision=6, scale=4), nullable=False, server_default="0"),
        # ── Lifecycle ──────────────────────────────────────────────────────────
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("added_to_watchlist", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_generated_ideas_ticker", "generated_ideas", ["ticker"])
    op.create_index("ix_generated_ideas_source", "generated_ideas", ["source"])
    op.create_index("ix_generated_ideas_idea_score", "generated_ideas", ["idea_score"])
    op.create_index("ix_generated_ideas_expires_at", "generated_ideas", ["expires_at"])
    op.create_index("ix_generated_ideas_generated_at", "generated_ideas", ["generated_at"])


def downgrade() -> None:
    op.drop_index("ix_generated_ideas_generated_at", table_name="generated_ideas")
    op.drop_index("ix_generated_ideas_expires_at", table_name="generated_ideas")
    op.drop_index("ix_generated_ideas_idea_score", table_name="generated_ideas")
    op.drop_index("ix_generated_ideas_source", table_name="generated_ideas")
    op.drop_index("ix_generated_ideas_ticker", table_name="generated_ideas")
    op.drop_table("generated_ideas")
