# Frontend simplification

The route count fell from 37 to 14 pages, including authentication, the root redirect, and individual stock/strategy details. There are five primary workspaces plus Settings.

The primary navigation now follows a stock trading workflow: Overview, Research, Strategies, Trade, and Portfolio. Settings is a secondary destination. Desktop and mobile use the same navigation definition.

## Retained workflows

| Workspace | Tools |
| --- | --- |
| Overview | Stock chart, indicators, drawings, quote watchlist, news, recent strategy runs |
| Research | Stock screener, watchlist and buy zones, ideas, alerts |
| Strategies | Strategy builder, conservative/aggressive/squeeze modes, parameter optimizers, backtest history, saved Pine scripts, techniques and trading guide |
| Trade | Paper and broker orders, auto-buy, trailing stops; options and existing wheel/copy/BTC automation under More tools |
| Portfolio | Recorded holdings and orders, a separate manual ledger, trade journal |
| Settings | Account, broker credentials, password, automation schedules, help |

Active bot management is retained even for non-stock tools so users can inspect and stop existing sessions. No backend bots, orders, schedules, holdings, credentials, or strategy engines were removed or changed operationally by this refactor.

## Removed pages

Commodity overview/signals/performance/risk, the commodities guide, crypto morning brief, and the static multi-chart page were removed from the frontend. Their URLs redirect to the relevant retained workspace. Other former top-level pages became lazy-loaded workspace sections rather than duplicated shells. Individual stock, backtest, and saved-script detail URLs remain available.

`frontend/lib/legacy-routes.json` is the redirect map. Redirects are temporary to avoid permanently caching the new information architecture. Existing query strings survive redirects and login; old backtest run links resolve to individual results.

## Correctness fixes

- Removed static ticker prices, permanent market-open badges, the decorative global live/paper switch, fake connection status, and nonfunctional settings controls.
- Removed default demo portfolio holdings/activity and the synthetic performance chart. Manual data remains accessible separately and is labeled unverified. Missing marks are unavailable rather than substituted with cost; broker-backed rows cannot be edited through local-only controls.
- Stock chart watchlist rows now consume fetched prices. Default watchlists contain stocks with no seeded quotes. Malformed saved watchlists fall back safely.
- Backtest summaries share compounded return, peak-to-trough drawdown, population-standard-deviation Sharpe-like, and strict win calculations. Failed trade loads do not become false zero-trade successes. The template builder no longer silently switches strategy/timeframe to find trades.
- Restored Bollinger Squeeze in the builder and request/profile schemas, matching the existing backend engine. Strategy forms reset when switching modes and offer only supported backtest timeframes. They clearly perform historical simulation without a live-order toggle.
- Paper trades are labeled paper in the journal. Orders validate finite positive amounts; changing a signal input clears the previous result and late responses for old inputs are ignored. Order logs retain the submitted context.
- Added query-preserving login redirects, consolidated navigation, mobile drawer labels and dismissal, loading/error handling, and accessible selected-state/form labels.

## Validation scope

Frontend production build, lint, TypeScript, 281 passing unit/regression tests across 23 suites, all 26 legacy redirects verified over HTTP, and a desktop/mobile browser pass using local read-only fixtures. The browser fixtures do not connect to a brokerage or submit orders. Backend schema validation covers the restored squeeze mode. Historical strategy profitability, live market-data quality, and end-to-end broker execution were not validated by this UI refactor.

Deploy the frontend together with the small backend schema updates to expose squeeze backtests consistently.
