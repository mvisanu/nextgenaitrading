"""v9 btc_bot_sessions + btc_bot_actions tables

Revision ID: v9_btc_bot
Revises: v8_user_pins
Create Date: 2026-05-12
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v9_btc_bot"
down_revision = "v8_user_pins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "btc_bot_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "credential_id",
            sa.Integer(),
            sa.ForeignKey("broker_credentials.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("original_entry_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("blended_entry_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("total_qty", sa.Numeric(20, 8), nullable=False, server_default="0"),
        sa.Column("initial_buy_usd", sa.Numeric(18, 2), nullable=False, server_default="10000"),
        sa.Column("current_floor", sa.Numeric(18, 2), nullable=True),
        sa.Column("trailing_active", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("trailing_high", sa.Numeric(18, 2), nullable=True),
        sa.Column("ladder_next", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("realized_pnl", sa.Numeric(18, 2), nullable=True),
        sa.Column("last_action_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_btc_bot_sessions_user_id",
        "btc_bot_sessions",
        ["user_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_btc_bot_sessions_user_status",
        "btc_bot_sessions",
        ["user_id", "status"],
        if_not_exists=True,
    )
    # Partial unique: a user can never have two simultaneously-live sessions.
    op.create_index(
        "uq_btc_bot_sessions_user_active",
        "btc_bot_sessions",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("status IN ('active','cooldown')"),
        if_not_exists=True,
    )

    op.create_table(
        "btc_bot_actions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "session_id",
            sa.Integer(),
            sa.ForeignKey("btc_bot_sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("btc_price", sa.Numeric(18, 2), nullable=True),
        sa.Column("qty_delta", sa.Numeric(20, 8), nullable=True),
        sa.Column("usd_delta", sa.Numeric(18, 2), nullable=True),
        sa.Column("floor_before", sa.Numeric(18, 2), nullable=True),
        sa.Column("floor_after", sa.Numeric(18, 2), nullable=True),
        sa.Column("alpaca_order_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_btc_bot_actions_session_id",
        "btc_bot_actions",
        ["session_id"],
        if_not_exists=True,
    )
    op.create_index(
        "ix_btc_bot_actions_user_created",
        "btc_bot_actions",
        ["user_id", "created_at"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_btc_bot_actions_user_created", table_name="btc_bot_actions", if_exists=True)
    op.drop_index("ix_btc_bot_actions_session_id", table_name="btc_bot_actions", if_exists=True)
    op.drop_table("btc_bot_actions")
    op.drop_index("uq_btc_bot_sessions_user_active", table_name="btc_bot_sessions", if_exists=True)
    op.drop_index("ix_btc_bot_sessions_user_status", table_name="btc_bot_sessions", if_exists=True)
    op.drop_index("ix_btc_bot_sessions_user_id", table_name="btc_bot_sessions", if_exists=True)
    op.drop_table("btc_bot_sessions")
