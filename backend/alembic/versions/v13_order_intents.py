"""Persist order intent before broker submission and isolate confirmed fill accounting."""
from alembic import op
import sqlalchemy as sa
revision = "v13_order_intents"
down_revision = "v12_rls_alembic_version"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("broker_orders", sa.Column("client_order_id", sa.String(64), nullable=True))
    op.add_column("broker_orders", sa.Column("request_fingerprint", sa.String(64), nullable=True))
    for table in ("broker_orders", "position_snapshots"):
        op.add_column(table, sa.Column("credential_id", sa.Integer(), nullable=True))
        op.create_foreign_key(f"fk_{table}_credential", table, "broker_credentials", ["credential_id"], ["id"], ondelete="SET NULL")
        op.add_column(table, sa.Column("broker_paper", sa.Boolean(), nullable=False, server_default=sa.false()))
    for name in ("applied_filled_quantity", "applied_filled_notional"):
        op.add_column("broker_orders", sa.Column(name, sa.Float(), nullable=False, server_default="0"))
    op.create_unique_constraint("uq_order_user_client", "broker_orders", ["user_id", "client_order_id"])

def downgrade():
    op.drop_constraint("uq_order_user_client", "broker_orders", type_="unique")
    for table in ("broker_orders", "position_snapshots"):
        op.drop_constraint(f"fk_{table}_credential", table, type_="foreignkey")
        op.drop_column(table, "credential_id")
        op.drop_column(table, "broker_paper")
    for name in ("client_order_id", "request_fingerprint", "applied_filled_quantity", "applied_filled_notional"):
        op.drop_column("broker_orders", name)
