"""
conftest.py for v6 tests (Congress Copy Bot).

The congress-copy-bot lives in a git worktree at .worktrees/congress-copy-bot/.
Its backend uses the same `app.*` namespace as the main backend.

To avoid namespace collisions, run v6 tests in isolation:

    cd backend && pytest tests/v6/

When running the full suite (pytest tests/v5/ tests/v6/), v6 tests are skipped
automatically via the _IMPORT_OK guard in each test file — this is expected.

The newer test files (test_politician_scraper_service, test_politician_ranker_service,
test_copy_trading_service) use importlib.util to load modules directly from file
paths, bypassing the `app.*` namespace entirely, so they coexist with the worktree
tests without sys.path conflicts.
"""
