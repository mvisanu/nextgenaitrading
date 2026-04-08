"""merge_v6b_congress_and_v7c_wheel

Revision ID: 5bafc0ec3474
Revises: v6b_congress_trade_unique_fix, v7c_wheel_bot_credential
Create Date: 2026-04-08 10:35:22.008186

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5bafc0ec3474'
down_revision: Union[str, None] = ('v6b_congress_trade_unique_fix', 'v7c_wheel_bot_credential')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
