"""auto_buy_settings_execution_fields — add execution scheduling columns

Revision ID: g6h7i8j9k0l1
Revises: f5a6b1c2d3e4
Create Date: 2026-03-31 00:00:00.000000

Adds five columns to auto_buy_settings that were present in the ORM model
but never included in the original v2 migration (a1b2c3d4e5f6):
  - execution_timeframe  VARCHAR(10)  nullable
  - start_date           DATE         nullable
  - end_date             DATE         nullable
  - target_buy_price     FLOAT        nullable
  - target_sell_price    FLOAT        nullable
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "g6h7i8j9k0l1"
down_revision: Union[str, None] = "f5a6b1c2d3e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "auto_buy_settings",
        sa.Column("execution_timeframe", sa.String(length=10), nullable=True),
    )
    op.add_column(
        "auto_buy_settings",
        sa.Column("start_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "auto_buy_settings",
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "auto_buy_settings",
        sa.Column("target_buy_price", sa.Float(), nullable=True),
    )
    op.add_column(
        "auto_buy_settings",
        sa.Column("target_sell_price", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("auto_buy_settings", "target_sell_price")
    op.drop_column("auto_buy_settings", "target_buy_price")
    op.drop_column("auto_buy_settings", "end_date")
    op.drop_column("auto_buy_settings", "start_date")
    op.drop_column("auto_buy_settings", "execution_timeframe")
