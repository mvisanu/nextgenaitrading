"""v12 enable RLS on alembic_version (the one table v10 missed)

Revision ID: v12_rls_alembic_version
Revises: v11_unforce_rls
Create Date: 2026-08-18

v10_enable_rls enumerated 37 application tables by hand. public.alembic_version
was not among them -- Alembic creates that table itself, so it never appeared in
any model file and never made the list. It therefore stayed the single table in
a PostgREST-exposed schema with no row level security, which Supabase's linter
reports as rls_disabled_in_public (0013).

This is not a cosmetic finding. Supabase's default privileges grant ALL on new
public tables to anon and authenticated, so an unauthenticated caller could
UPDATE or DELETE the stored revision hash through the REST API. Losing that row
makes Alembic believe the database is unmigrated and attempt to re-run every
migration from scratch; corrupting it to an unknown value makes `alembic upgrade
head` fail outright. Either outcome wedges container startup.

Fix: ENABLE row level security and define no policies, which denies every
unprivileged role. Privileges are additionally revoked from anon/authenticated
so PostgREST drops the table from its schema cache and callers get a permission
error rather than a silent empty result.

DO NOT ADD `FORCE ROW LEVEL SECURITY` HERE. That is precisely the mistake v10
made and v11 had to undo: FORCE removes the table-owner bypass, and the FastAPI
backend connects as the owner via asyncpg. Forcing RLS with no policy present
would deny the owner too -- and for this table specifically that means Alembic
could no longer read or write its own version row, breaking every migration run.
ENABLE alone satisfies the linter while leaving the owner bypass intact.

Both statements are idempotent: re-enabling RLS on a table that already has it
is a no-op, as is revoking a privilege that was already revoked. This migration
is safe to run against a database where the fix was already applied by hand.
"""
from __future__ import annotations

from alembic import op

revision = "v12_rls_alembic_version"
down_revision = "v11_unforce_rls"
branch_labels = None
depends_on = None

_TABLE = "alembic_version"

# anon and authenticated are created by Supabase's bootstrap. A plain Postgres
# instance (local docker-compose, CI) has neither, and an unguarded REVOKE
# against a missing role raises and aborts the migration -- which, since
# migrations run at container startup, would wedge the whole service. Same
# defensive posture as v11's to_regclass() guard.
_API_ROLES = ("anon", "authenticated")


def _guarded_grant_change(statement: str) -> None:
    roles_array = ", ".join(f"'{r}'" for r in _API_ROLES)
    op.execute(
        f"""
        DO $$
        DECLARE
            r text;
        BEGIN
            FOREACH r IN ARRAY ARRAY[{roles_array}]
            LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
                    EXECUTE format('{statement}', r);
                END IF;
            END LOOP;
        END $$;
        """
    )


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regclass('public.{_TABLE}') IS NOT NULL THEN
                EXECUTE 'ALTER TABLE public.{_TABLE} ENABLE ROW LEVEL SECURITY';
            END IF;
        END $$;
        """
    )
    _guarded_grant_change(
        f"REVOKE ALL ON TABLE public.{_TABLE} FROM %I"
    )


def downgrade() -> None:
    # Restores the pre-migration state: Supabase's default grant plus RLS off.
    _guarded_grant_change(
        f"GRANT ALL ON TABLE public.{_TABLE} TO %I"
    )
    op.execute(
        f"""
        DO $$
        BEGIN
            IF to_regclass('public.{_TABLE}') IS NOT NULL THEN
                EXECUTE 'ALTER TABLE public.{_TABLE} DISABLE ROW LEVEL SECURITY';
            END IF;
        END $$;
        """
    )
