# Status — 2026-06-11

## Working
- **All backend test suites green**: v2–v5 (499 passed), v6 standalone (66), v9 (57), root auth/gold (93). Baseline at session start was 39 failures across these suites.
- App imports cleanly (`from app.main import app` OK).
- All four CLAUDE.md "Known Bugs" fixed (see `_log.md` for details).

## Fixed this session
- `morning_brief.py`: EMA-200 ZeroDivisionError guard + bias logic (Below EMA-200 now always Bearish).
- `politician_scraper_service.py`: `_fetch_raw()` raises new `QuiverFetchError` when API down and no cache; returns stale cache with warning otherwise.
- `copy_trading_service.py`: session creation aborts (API 503) if Quiver unreachable — prevents unseeded session from bulk-copying all historical trades on first poll; seeding failures now re-raise. Options fallback builds OCC symbols via validated `_build_occ_symbol()` (proper date parsing — old code corrupted MM/DD/YYYY expiries — plus regex check).
- `core/security.py`: internally-minted access/refresh JWTs now include `aud="authenticated"` — previously `decode_token()` could never validate the app's own tokens.
- Perf/cost (Render 512 MB constraints): `moat_scoring_service` + `theme_scoring_service` now use cached `get_ticker_info()` instead of direct `yf.Ticker().info`; `run_live_scanner` uses one DB session for the whole run (was one per user — pool churn with pool_size=2); `run_idea_generator` merged two sequential sessions into one; `gc.collect()` added to `run_news_scanner` + `prune_old_signals`; deprecated `get_event_loop()` → `get_running_loop()` in `idea_generator_service` + `scanner_service`.
- Stale tests repaired: auto-buy fixtures missing `target_buy_price`, trailing-bot mocks returning falsy cancel result, theme/moat mocks patching `yf` directly, entry-priority cross-test pollution from shared yfinance info cache (autouse cache-clear fixture added).

## Pending / notes
- `tests/v7/` does not exist despite CLAUDE.md referencing it — wheel bot has no test suite.
- 2 pre-existing failures? None — everything green as of this session.
- `politician-copy-trading/trade_history.db` has uncommitted changes (pre-existing, untouched).
- Frontend untouched this session (scan found no violations: no `Promise.allSettled` price polling, `dangerouslySetInnerHTML` uses are static/sanitized).
