"""v2_features — buy_zone, theme_score, ideas, alerts, auto_buy tables

Revision ID: a1b2c3d4e5f6
Revises: 8fc51a5529bd
Create Date: 2026-03-24 00:00:00.000000

Adds seven new tables for v2 features:
  1. stock_buy_zone_snapshots
  2. stock_theme_scores
  3. watchlist_ideas
  4. watchlist_idea_tickers
  5. price_alert_rules
  6. auto_buy_settings
  7. auto_buy_decision_logs
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "8fc51a5529bd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. stock_buy_zone_snapshots ───────────────────────────────────────────
    op.create_table(
        "stock_buy_zone_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),  # nullable = system-wide snapshot
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("current_price", sa.Float(), nullable=False),
        sa.Column("buy_zone_low", sa.Float(), nullable=False),
        sa.Column("buy_zone_high", sa.Float(), nullable=False),
        sa.Column("confidence_score", sa.Float(), nullable=False),
        sa.Column("entry_quality_score", sa.Float(), nullable=False),
        sa.Column("expected_return_30d", sa.Float(), nullable=False),
        sa.Column("expected_return_90d", sa.Float(), nullable=False),
        sa.Column("expected_drawdown", sa.Float(), nullable=False),
        sa.Column("positive_outcome_rate_30d", sa.Float(), nullable=False),
        sa.Column("positive_outcome_rate_90d", sa.Float(), nullable=False),
        sa.Column("invalidation_price", sa.Float(), nullable=False),
        sa.Column("horizon_days", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("explanation_json", sa.JSON(), nullable=False),
        sa.Column("feature_payload_json", sa.JSON(), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=False, server_default="v2.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_stock_buy_zone_snapshots_id"), "stock_buy_zone_snapshots", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_stock_buy_zone_snapshots_ticker"), "stock_buy_zone_snapshots", ["ticker"], unique=False
    )
    op.create_index(
        op.f("ix_stock_buy_zone_snapshots_user_id"), "stock_buy_zone_snapshots", ["user_id"], unique=False
    )
    op.create_index(
        "ix_stock_buy_zone_snapshots_ticker_created_at",
        "stock_buy_zone_snapshots",
        ["ticker", "created_at"],
        unique=False,
    )

    # ── 2. stock_theme_scores ─────────────────────────────────────────────────
    op.create_table(
        "stock_theme_scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("theme_score_total", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("theme_scores_json", sa.JSON(), nullable=False),
        sa.Column("narrative_momentum_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("sector_tailwind_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("macro_alignment_score", sa.Float(), nullable=False, server_default="0.0"),
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
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_stock_theme_scores_id"), "stock_theme_scores", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_stock_theme_scores_ticker"), "stock_theme_scores", ["ticker"], unique=True
    )

    # ── 3. watchlist_ideas ────────────────────────────────────────────────────
    op.create_table(
        "watchlist_ideas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("thesis", sa.Text(), nullable=False, server_default=""),
        sa.Column("conviction_score", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("watch_only", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("tradable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("tags_json", sa.JSON(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
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
        sa.CheckConstraint(
            "conviction_score >= 1 AND conviction_score <= 10",
            name="ck_watchlist_ideas_conviction_score",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_watchlist_ideas_id"), "watchlist_ideas", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_watchlist_ideas_user_id"), "watchlist_ideas", ["user_id"], unique=False
    )

    # ── 4. watchlist_idea_tickers ─────────────────────────────────────────────
    op.create_table(
        "watchlist_idea_tickers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("idea_id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("near_earnings", sa.Boolean(), nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(["idea_id"], ["watchlist_ideas.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_watchlist_idea_tickers_id"), "watchlist_idea_tickers", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_watchlist_idea_tickers_idea_id"), "watchlist_idea_tickers", ["idea_id"], unique=False
    )
    op.create_index(
        op.f("ix_watchlist_idea_tickers_ticker"), "watchlist_idea_tickers", ["ticker"], unique=False
    )

    # ── 5. price_alert_rules ──────────────────────────────────────────────────
    op.create_table(
        "price_alert_rules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("alert_type", sa.String(length=50), nullable=False),
        sa.Column("threshold_json", sa.JSON(), nullable=False),
        sa.Column("cooldown_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("market_hours_only", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.CheckConstraint(
            "alert_type IN ('entered_buy_zone','near_buy_zone','below_invalidation',"
            "'confidence_improved','theme_score_increased','macro_deterioration')",
            name="ck_price_alert_rules_alert_type",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_price_alert_rules_id"), "price_alert_rules", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_price_alert_rules_user_id"), "price_alert_rules", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_price_alert_rules_ticker"), "price_alert_rules", ["ticker"], unique=False
    )

    # ── 6. auto_buy_settings ──────────────────────────────────────────────────
    op.create_table(
        "auto_buy_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("paper_mode", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("confidence_threshold", sa.Float(), nullable=False, server_default="0.70"),
        sa.Column("max_trade_amount", sa.Float(), nullable=False, server_default="1000.0"),
        sa.Column("max_position_percent", sa.Float(), nullable=False, server_default="0.05"),
        sa.Column("max_expected_drawdown", sa.Float(), nullable=False, server_default="-0.10"),
        sa.Column("allow_near_earnings", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("allowed_account_ids_json", sa.JSON(), nullable=False),
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
        sa.UniqueConstraint("user_id", name="uq_auto_buy_settings_user_id"),
    )
    op.create_index(
        op.f("ix_auto_buy_settings_id"), "auto_buy_settings", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_auto_buy_settings_user_id"), "auto_buy_settings", ["user_id"], unique=True
    )

    # ── 7. auto_buy_decision_logs ─────────────────────────────────────────────
    op.create_table(
        "auto_buy_decision_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ticker", sa.String(length=20), nullable=False),
        sa.Column("decision_state", sa.String(length=30), nullable=False),
        sa.Column("reason_codes_json", sa.JSON(), nullable=False),
        sa.Column("signal_payload_json", sa.JSON(), nullable=False),
        sa.Column("order_payload_json", sa.JSON(), nullable=True),
        sa.Column("dry_run", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_auto_buy_decision_logs_id"), "auto_buy_decision_logs", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_auto_buy_decision_logs_user_id"), "auto_buy_decision_logs", ["user_id"], unique=False
    )
    op.create_index(
        op.f("ix_auto_buy_decision_logs_ticker"), "auto_buy_decision_logs", ["ticker"], unique=False
    )


def downgrade() -> None:
    op.drop_table("auto_buy_decision_logs")
    op.drop_table("auto_buy_settings")
    op.drop_table("price_alert_rules")
    op.drop_table("watchlist_idea_tickers")
    op.drop_table("watchlist_ideas")
    op.drop_table("stock_theme_scores")
    op.drop_table("stock_buy_zone_snapshots")
