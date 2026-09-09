# Trading reliability refactor

The five workspaces remain: Overview, Research, Strategies, Trade, and Portfolio.

## Implemented changes

1. **Paper accounting:** a pure, immutable engine reserves entry collateral for shorts and releases it with realized P&L on covers. Opposite-side orders close at most the held quantity; they never silently flip positions. The UI and journal use actual fills, including realized gains/losses. Nonfinite amounts, invalid prices, insufficient opening cash, and invalid resets are rejected.
2. **Account data:** paper portfolios, watchlists, journals, manual holdings/activity, chart drawings, and pending order intents use validated storage under the signed-in account ID. Reads synchronize across components and browser tabs. Auth changes unmount account UI and remove old query data. Older unscoped records are preserved; Settings provides an explicit ownership-confirmed import/export. Import does not overwrite existing account datasets and recalculates legacy paper cash from the ledger.
3. **Strategy semantics:** Script templates export Pine Script for independent testing. Reference backtests are labeled as tests of the predefined app engine; they do not execute the generated script. Results identify this distinction, and unsupported reference timeframes require an explicit supported selection. Ineffective automation strategy cards and the false “Commit Configuration” action were removed.
4. **Components:** order submission/recovery, broker ledger, signal displays, automation inputs, automation queries, and template generation have separate modules. Automation inputs validate amounts/dates, and settings mutations are serialized. An unavailable settings request no longer shows editable defaults as though they were saved settings.
5. **API/query consistency:** options and same-origin market-data proxies share JSON/error handling. HTTP status codes and FastAPI field errors remain available to callers. Shared credential/order/position/automation query keys include the account ID, with coordinated refresh and a common polling interval. Mutation requests are not automatically retried.
6. **Execution recovery:** the service validates ownership and commits a unique client order intent before broker submission. Replays compare the original request and reconcile by broker client ID. The UI persists the exact request across reloads, blocks another submission while its outcome is unknown, and can recover the saved request. Auto-buy uses the same service with a stable ID derived from its source snapshot. Pending orders can be reconciled from the broker ledger. Confirmed incremental fills update positions once, in the same transaction as the fill cursor; simulations and unfilled orders do not create positions. Delayed responses cannot regress a recovered terminal status. Dollar orders remain dollar orders instead of being converted using stale estimated prices.

## Database rollout

Apply `backend/alembic/versions/v13_order_intents.py` with the backend release (`alembic upgrade head`). It follows the existing `v12_rls_alembic_version` migration, which was preserved. The migration adds order identity, request fingerprints, broker/account mode, and fill-application cursors. Existing order IDs are nullable to retain historical records. New execution requires this migration; coordinate the backend and frontend release.

The migration is prepared and its revision chain is checked locally. It has **not** been applied to a deployed database, and this work has not been deployed.

## Practical limits

- Historical broker snapshots with no credential attribution are preserved; the refactor does not reconstruct or silently delete old positions. Recorded positions are the application's ledger, not a full broker account balance.
- Automated fill updates cover the shared manual-stock/auto-buy execution path. Other dedicated bot engines retain their own execution services.
- Broker lookup can lag submission or fail. An unknown outcome remains blocked; a timeout or temporary not-found response never authorizes a fresh broker POST. A saved request is replayed with the same ID.
- Explicit paper/live order execution uses the standard Alpaca environment selected for the saved intent; a custom credential URL cannot redirect paper execution to the live host.
- Auto-buy's existing spread check is unavailable and its liquidity check is a minimum-price filter. The UI now states these limitations. A stored sizing reference is not a limit-order trigger; unsupported sell-target controls were removed.
- Browser storage is local to the device and can be unavailable or cleared. Account scoping is not encryption or server backup. Independent simultaneous edits from different tabs are still subject to browser storage's last-write behavior.

## Verification

Frontend regression tests cover paper long/short accounting, partial/oversized closes, storage isolation and malformed values, readable HTTP errors, double-submit protection, timeout/remount recovery, immutable saved requests, and account changes. Backend tests use an isolated SQLite ledger and mocked brokers; they cover replay, confirmed partial fills, ownership, invalid inputs, stale responses, and auto-buy duplicate/budget handling. SQLite tests do not substitute for a PostgreSQL deployment migration/concurrency check.

Production build, lint/type checks, and desktop/mobile browser review use local fixtures. Browser review exercises paper fills and journal persistence; no real broker orders are placed.

Final local results: 307 frontend tests in 27 suites and 18 backend execution tests passed; production build and lint passed.
