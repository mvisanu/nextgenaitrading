#!/usr/bin/env python3
"""
sync_to_obsidian.py — Auto-sync repo CLAUDE.md to the Obsidian vault.

Wired to Claude Code SessionStart hook so it runs at the start of every
session. Also safe to run manually:

    python sync_to_obsidian.py

Only copies when content has actually changed (MD5 comparison), so
it adds no overhead on unchanged sessions.
"""

import hashlib
import re
import shutil
import sys
from datetime import date, datetime
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────

REPO_ROOT = Path(__file__).parent

VAULT_PROJECT = Path(
    r"C:\Users\Bruce\OneDrive\Documents\obsidian\claude_code_obsidian"
    r"\projects\nextgetaitrading"
)

SRC_CLAUDE = REPO_ROOT / "CLAUDE.md"
DST_CLAUDE = VAULT_PROJECT / "CLAUDE.md"
DST_STATUS = VAULT_PROJECT / "status.md"
DST_LOG    = VAULT_PROJECT / "wiki" / "_log.md"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def _sync_claude_md() -> bool:
    """Copy CLAUDE.md to vault if content differs. Returns True if updated."""
    if DST_CLAUDE.exists() and _md5(SRC_CLAUDE) == _md5(DST_CLAUDE):
        return False
    shutil.copy2(SRC_CLAUDE, DST_CLAUDE)
    return True


def _update_status_sync_date():
    """Rewrite the 'Last CLAUDE.md sync' date in status.md."""
    if not DST_STATUS.exists():
        return
    today = date.today().isoformat()
    text = DST_STATUS.read_text(encoding="utf-8")
    # Matches the date line that follows the sync header (blank line between)
    updated = re.sub(
        r"(## Last CLAUDE\.md sync\n\n)\d{4}-\d{2}-\d{2}",
        rf"\g<1>{today}",
        text,
    )
    if updated != text:
        DST_STATUS.write_text(updated, encoding="utf-8")


def _append_log_entry():
    """Append a SYNC entry to wiki/_log.md, creating the file if absent."""
    DST_LOG.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    entry = (
        f"\n## {timestamp} SYNC\n"
        f"- CLAUDE.md re-synced from repo (auto via SessionStart hook)\n"
        f"- Sync triggered by: new Claude Code session\n"
    )
    if DST_LOG.exists():
        existing = DST_LOG.read_text(encoding="utf-8")
        DST_LOG.write_text(existing + entry, encoding="utf-8")
    else:
        DST_LOG.write_text(
            "# NextGenAI Trading — Session Log\n" + entry,
            encoding="utf-8",
        )


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    if not SRC_CLAUDE.exists():
        print("sync_to_obsidian: CLAUDE.md not found in repo — skipping")
        return 0

    if not VAULT_PROJECT.exists():
        print(
            f"sync_to_obsidian: vault path not found "
            f"({VAULT_PROJECT}) — skipping"
        )
        return 0

    try:
        updated = _sync_claude_md()
    except Exception as exc:
        print(f"sync_to_obsidian: copy failed — {exc}")
        return 1

    if updated:
        try:
            _update_status_sync_date()
            _append_log_entry()
        except Exception as exc:
            # Non-fatal — the copy succeeded, metadata update failed
            print(f"sync_to_obsidian: metadata update failed — {exc}")

        print(f"sync_to_obsidian: synced to vault ({date.today().isoformat()})")
    else:
        print("sync_to_obsidian: CLAUDE.md unchanged — no sync needed")

    return 0


if __name__ == "__main__":
    sys.exit(main())
