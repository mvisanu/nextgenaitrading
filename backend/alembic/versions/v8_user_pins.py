"""v8 add user_pins table for 4-digit PIN auth

Revision ID: v8_user_pins
Revises: 5bafc0ec3474
Create Date: 2026-04-22
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "v8_user_pins"
down_revision = "5bafc0ec3474"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_pins",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("pin_hash", sa.String(200), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_pins_user_id"),
    )
    op.create_index("ix_user_pins_user_id", "user_pins", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_pins_user_id", table_name="user_pins")
    op.drop_table("user_pins")
