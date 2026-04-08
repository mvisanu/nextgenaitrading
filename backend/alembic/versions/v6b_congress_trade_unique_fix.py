"""v6b fix congress_trades unique constraint to composite

Revision ID: v6b_congress_trade_unique_fix
Revises: v6_congress_copy
Create Date: 2026-04-07
"""
from __future__ import annotations

from alembic import op

revision = "v6b_congress_trade_unique_fix"
down_revision = "v6_congress_copy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the global unique index on capitol_trade_id
    op.drop_index("uq_congress_trades_capitol_trade_id", table_name="congress_trades", if_exists=True)
    # Also try the implicit constraint name pattern PostgreSQL uses
    op.execute("ALTER TABLE congress_trades DROP CONSTRAINT IF EXISTS congress_trades_capitol_trade_id_key")
    # Add composite unique constraint only if it does not already exist
    # (v6 may have already created it if the DB was freshly migrated)
    op.execute(
        "DO $$ BEGIN "
        "IF NOT EXISTS ("
        "  SELECT 1 FROM pg_constraint WHERE conname = 'uq_congress_trades_session_trade'"
        ") THEN "
        "  ALTER TABLE congress_trades ADD CONSTRAINT uq_congress_trades_session_trade "
        "  UNIQUE (session_id, capitol_trade_id); "
        "END IF; "
        "END $$"
    )


def downgrade() -> None:
    op.drop_constraint("uq_congress_trades_session_trade", "congress_trades", type_="unique")
    op.create_unique_constraint(
        "congress_trades_capitol_trade_id_key",
        "congress_trades",
        ["capitol_trade_id"],
    )
