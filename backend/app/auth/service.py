"""
Auth service — minimal after Supabase migration.

All authentication is handled by Supabase (magic links) on the frontend.
The backend validates Supabase JWTs in dependencies.py.

This module retains the in-memory failed-attempt tracker so that
test_reset.py can clear it between E2E test runs.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

# ── In-memory login attempt tracking (retained for test_reset.py) ────────────
_failed_attempts: dict[str, list[datetime]] = defaultdict(list)
