"""
Pre-migration state repair.

If alembic_version contains only '5bafc0ec3474' (the merge head) AND alembic
can't locate the corresponding migration file, reset the table to the two
pre-merge heads so 'alembic upgrade head' can reapply the merge cleanly.

The file-existence guard is critical: once the merge file exists in
alembic/versions/, a DB sitting at '5bafc0ec3474' is in a perfectly valid
state and 'alembic upgrade head' will advance it normally (→ v8 → v9 → ...).
Rewinding it in that case would re-run v8's CREATE TABLE against tables that
already exist, crashing the migration, killing start.sh (set -e), and leaving
Render serving the previous (stale) container — which is exactly the
"route 404s in prod but exists in source" failure mode this guard prevents.

Run once at container startup, before alembic upgrade head.
"""
from __future__ import annotations

import asyncio
import os
import re
from pathlib import Path

STALE_REVISION = "5bafc0ec3474"
PRE_MERGE_HEADS = ("v6b_congress_trade_unique_fix", "v7c_wheel_bot_credential")
_VERSIONS_DIR = Path(__file__).parent / "alembic" / "versions"


def _merge_file_exists() -> bool:
    """True if a migration file declaring revision == STALE_REVISION is present."""
    if not _VERSIONS_DIR.is_dir():
        return False
    needle = f'"{STALE_REVISION}"'
    needle_single = f"'{STALE_REVISION}'"
    for path in _VERSIONS_DIR.glob("*.py"):
        try:
            text = path.read_text(encoding="utf-8")
        except OSError:
            continue
        # Only count it as the merge file if it *defines* the revision,
        # not merely references it as a down_revision.
        if (f"revision = {needle}" in text or f"revision = {needle_single}" in text
                or f"revision: str = {needle}" in text or f"revision: str = {needle_single}" in text):
            return True
    return False


async def _connect():
    import asyncpg  # already in requirements.txt

    url = os.environ["DATABASE_URL"]
    url = re.sub(r"^postgresql\+asyncpg://", "postgresql://", url)

    ssl = None
    if "ssl=require" in url:
        url = re.sub(r"[?&]ssl=require", "", url)
        ssl = "require"

    return await asyncpg.connect(url, ssl=ssl, statement_cache_size=0, timeout=30)


async def fix() -> None:
    conn = await _connect()
    try:
        rows = await conn.fetch("SELECT version_num FROM alembic_version")
        current = {r["version_num"] for r in rows}
        print(f"[migrate_fix] alembic_version = {current}", flush=True)

        if current == {STALE_REVISION} and not _merge_file_exists():
            print(
                f"[migrate_fix] Stale merge head detected ('{STALE_REVISION}' not in "
                f"migration files). Resetting to pre-merge heads: {PRE_MERGE_HEADS}",
                flush=True,
            )
            await conn.execute("DELETE FROM alembic_version")
            for head in PRE_MERGE_HEADS:
                await conn.execute(
                    "INSERT INTO alembic_version (version_num) VALUES ($1)", head
                )
            print("[migrate_fix] Reset complete — alembic will reapply the merge.", flush=True)
        elif current == {STALE_REVISION}:
            print(
                f"[migrate_fix] DB at merge head '{STALE_REVISION}' and merge file exists — "
                "valid state, leaving alembic to advance it normally.",
                flush=True,
            )
        else:
            print("[migrate_fix] No fix needed.", flush=True)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(fix())
