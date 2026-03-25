# FRONTEND3.md — V3 Frontend Handoff

**Date:** 2026-03-24
**Tasks implemented:** T3-22 through T3-30 (T3-32 → T3-42 per the user-visible task numbering), T3-42 (Sidebar scanner status)
**Status:** Complete — TypeScript compiles with zero errors

---

## 1. Summary of Changes

V3 adds three visible capabilities to the frontend:

1. **Opportunities page** — WatchlistTable replaces the legacy watchlist sidebar panel. Users add/remove tickers directly in the table, see live signal status (BuyNowBadge), ideal entry price, 90d win rate, and expandable row detail (EstimatedEntryPanel). Page polls every 5 minutes.

2. **Ideas page** — The "Suggested Ideas" tab now renders `IdeaFeed` (V3 auto-generated idea cards from `GET /api/ideas/generated`) instead of the legacy `GET /api/scanner/ideas` V2 feed. "My Ideas" tab and `IdeaForm` are unchanged.

3. **Sidebar scanner status dot** — A small pulsing green dot appears next to "Opportunities" in the sidebar when the scanner is active and has tickers in queue.

---

## 2. New and Modified Files

### New files

| Path | Description |
|---|---|
| `frontend/components/opportunities/BuyNowBadge.tsx` | Signal status badge with 4 states + 10-condition tooltip |
| `frontend/components/opportunities/EstimatedEntryPanel.tsx` | Expanded-row panel with entry zone, ideal price, win rate, drawdown, invalidation |
| `frontend/components/opportunities/WatchlistTable.tsx` | Full V3 watchlist table with add/remove/alert-toggle, all 10 columns |
| `frontend/components/ideas/AddToWatchlistButton.tsx` | One-click add with default/loading/added states |
| `frontend/components/ideas/GeneratedIdeaCard.tsx` | Auto-generated idea card (ticker, moat, financials, entry priority, news link) |
| `frontend/components/ideas/IdeaFeed.tsx` | Filterable/sortable feed with source tabs, theme chips, last-scan banner |

### Modified files

| Path | Change |
|---|---|
| `frontend/types/index.ts` | Added V3 types (see Section 3); extended `OpportunityRow` with signal-status fields |
| `frontend/lib/api.ts` | Added `watchlistApi`, `generatedIdeasApi`; extended `scannerApi` (see Section 4) |
| `frontend/app/opportunities/page.tsx` | Replaced with V3 `WatchlistTable`-centric layout; 5-min poll |
| `frontend/app/ideas/page.tsx` | "Suggested" tab now renders `IdeaFeed`; badge count from `generatedIdeasApi.list` |
| `frontend/components/layout/Sidebar.tsx` | Added `ScannerStatusDot` component; polls `/api/scanner/status` every 5 min |

---

## 3. New TypeScript Types (`frontend/types/index.ts`)

```typescript
// V3: Per-user watchlist entry (user_watchlist table)
WatchlistEntry         { ticker, user_id, alert_enabled, created_at }

// V3: Single condition from the 10-condition gate
ConditionDetail        { key: string, pass_: boolean }

// V3: Signal status enum
SignalStatus           "STRONG_BUY" | "WATCHING" | "NOT_READY" | "PENDING"

// V3: Full buy-now signal (read model)
BuyNowSignalOut        { all 10 condition booleans + signal_strength + suppressed_reason
                         + condition_details: ConditionDetail[] + backtest fields }

// V3: Scanner status
ScannerStatus          { last_scan_at, next_scan_at, tickers_in_queue, market_hours_active }

// V3: POST /api/scanner/run-now result
RunNowResult           { tickers_scanned, strong_buy_signals, results: ScanResultOut[] }

// V3: Generated idea from DB (GeneratedIdeaDBOut equivalent)
GeneratedIdeaRow       { id, ticker, company_name, source, reason_summary,
                         news_headline, news_url, news_source, catalyst_type,
                         current_price, buy_zone_low/high, ideal_entry_price,
                         confidence_score, historical_win_rate_90d,
                         theme_tags[], megatrend_tags[], moat_score, moat_description,
                         financial_quality_score, financial_flags[],
                         near_52w_low, at_weekly_support, entry_priority,
                         idea_score, generated_at, expires_at, added_to_watchlist }

// V3: Entry priority
EntryPriority          "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD"

// V3: Idea source
IdeaSource             "news" | "theme" | "technical" | "merged"

// V3: Add-to-watchlist result
AddToWatchlistResult   { ticker, watchlist_entry_created, alert_rule_created, idea_id }

// V3: Last scan metadata
LastScanResult         { last_scan_at, ideas_generated, next_scan_at }
```

**Extended existing types:**

`OpportunityRow` now includes these nullable V3 fields (null = `PENDING` / not yet calculated):
```typescript
ideal_entry_price:       number | null
backtest_confidence:     number | null
backtest_win_rate_90d:   number | null
signal_status:           SignalStatus | null
all_conditions_pass:     boolean | null
condition_details:       ConditionDetail[] | null
suppressed_reason:       string | null
invalidation_price:      number | null
expected_drawdown:       number | null
```

---

## 4. New API Client Functions (`frontend/lib/api.ts`)

### `watchlistApi` (new)
```typescript
watchlistApi.add(ticker)                          → POST /api/watchlist
watchlistApi.remove(ticker)                       → DELETE /api/watchlist/{ticker}
watchlistApi.toggleAlert(ticker, alert_enabled)   → PATCH /api/watchlist/{ticker}/alert
```

### `generatedIdeasApi` (new)
```typescript
generatedIdeasApi.list(params?)    → GET /api/ideas/generated?source=&theme=&limit=
generatedIdeasApi.addToWatchlist(id) → POST /api/ideas/generated/{id}/add-to-watchlist
generatedIdeasApi.lastScan()       → GET /api/ideas/generated/last-scan
```

### `scannerApi` extended
```typescript
scannerApi.status()   → GET /api/scanner/status
scannerApi.runNow()   → POST /api/scanner/run-now
```

---

## 5. Component Props

### `BuyNowBadge`
```typescript
interface BuyNowBadgeProps {
  signal_status: SignalStatus | null;
  condition_details?: ConditionDetail[] | null;
  className?: string;
}
```
- **STRONG_BUY**: green badge with `animate-ping` pulsing dot
- **PENDING / null**: amber badge with `animate-spin` spinner
- **WATCHING**: gray "Watching"
- **NOT_READY**: gray "Not Ready"
- Tooltip on hover/focus shows all 10 conditions with CheckCircle2 (green) or XCircle (red)

### `EstimatedEntryPanel`
```typescript
interface EstimatedEntryPanelProps {
  row: OpportunityRow;
  className?: string;
}
```
- Reads `buy_zone_low/high`, `ideal_entry_price`, `backtest_win_rate_90d`, `expected_drawdown`, `invalidation_price`, `backtest_confidence`, `suppressed_reason` from the row
- Required wording: "This is not a guaranteed price." is rendered literally

### `WatchlistTable`
```typescript
interface WatchlistTableProps {
  rows: OpportunityRow[];
  isLoading: boolean;
  onRefetch: () => void;
}
```
- Ticker input + Add button at top (POST /api/watchlist, 409/422 inline errors)
- "Scan Now" button calls `scannerApi.runNow()` and shows toast
- "Ready only" checkbox hides non-STRONG_BUY rows
- Theme chips filter client-side (best-effort; backend supports one theme param)
- Default sort: STRONG_BUY first, then backtest_confidence desc

### `AddToWatchlistButton`
```typescript
interface AddToWatchlistButtonProps {
  ideaId: number;
  ticker: string;
  added_to_watchlist: boolean;
  className?: string;
}
```
- Initialises in "Added ✓" (green, disabled) when `added_to_watchlist=true`
- Calls `generatedIdeasApi.addToWatchlist(ideaId)` on click
- Toast: "{TICKER} added to watchlist. Alert created for buy zone entry."

### `GeneratedIdeaCard`
```typescript
interface GeneratedIdeaCardProps {
  idea: GeneratedIdeaRow;
  className?: string;
}
```
- Renders all fields from PRD3.md Section 5.3
- "Near 52-week low" amber badge when `near_52w_low=true`
- "At weekly support" amber badge when `at_weekly_support=true`
- Moat: green badge (>= 0.70), red badge (< 0.30), gray otherwise
- Financial quality: "Financials unavailable" when `flags` contains `"financials_unavailable"`
- "View Chart" navigates to `/dashboard?ticker={ticker}`
- `relativeTime()` helper computes "X minutes ago" from `generated_at`

### `IdeaFeed`
```typescript
// No props — self-contained with TanStack Query
function IdeaFeed(): JSX.Element
```
- Source tabs: All / News / Theme / Technical → `?source=` param
- Theme chips: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics
- Multi-theme selection uses client-side OR filter when > 1 chip is active
- "Last updated" from `generatedIdeasApi.lastScan()`
- Refresh: calls `scannerApi.runNow()` (graceful if outside market hours) then re-fetches
- `staleTime: 5 * 60_000` on both the ideas query and last-scan query

### `ScannerStatusDot` (in Sidebar)
- Polls `scannerApi.status()` every 5 minutes
- Green `animate-pulse` dot when `market_hours_active=true` AND `tickers_in_queue > 0`
- Static dimmed green when active but queue empty
- Gray when market closed or data unavailable
- Tooltip: "Scanner active — N tickers in queue"

---

## 6. Page Modifications

### `/opportunities` (page.tsx rewritten)
- Auth guard preserved (redirects to `/login`)
- `WatchlistTable` is now the primary content
- `GET /api/opportunities` polled every 5 minutes via `refetchInterval`
- `data-testid="page-title"` preserved as a screen-reader-only `<h1>`
- Legacy watchlist sidebar panel removed (superseded by WatchlistTable's inline add/remove)
- Legacy `BuyZoneAnalysisPanel`, scan-result toast, and alert filter bar removed (superseded)

### `/ideas` (page.tsx updated)
- "Suggested Ideas" tab now renders `IdeaFeed` (uses `GET /api/ideas/generated`)
- Legacy `SuggestedIdeasPanel` (which used `GET /api/scanner/ideas`) removed
- Badge count on "Suggested Ideas" tab uses `generatedIdeasApi.list` preload query
- "My Ideas" tab, `IdeaList`, "New Idea" button, and `IdeaForm` dialog are unchanged

---

## 7. V3 Frontend → Backend Endpoint Map

| Frontend call | Backend endpoint | Task |
|---|---|---|
| `watchlistApi.add()` | POST /api/watchlist | T3-18 |
| `watchlistApi.remove()` | DELETE /api/watchlist/{ticker} | T3-18 |
| `watchlistApi.toggleAlert()` | PATCH /api/watchlist/{ticker}/alert | T3-18b |
| `opportunitiesApi.list()` | GET /api/opportunities (extended) | T3-19 |
| `scannerApi.status()` | GET /api/scanner/status | T3-20 |
| `scannerApi.runNow()` | POST /api/scanner/run-now | T3-20 |
| `generatedIdeasApi.list()` | GET /api/ideas/generated | T3-21 |
| `generatedIdeasApi.addToWatchlist()` | POST /api/ideas/generated/{id}/add-to-watchlist | T3-21 |
| `generatedIdeasApi.lastScan()` | GET /api/ideas/generated/last-scan | T3-21 |

---

## 8. Assumptions Made (Minor Ambiguities)

1. **Theme filter on WatchlistTable**: `OpportunityRow` does not carry `theme_tags[]` directly (only `theme_score_total`). Theme chip filtering in `WatchlistTable` is currently a no-op pass-through because there's no per-ticker tag list available from the opportunities endpoint. The filter is structurally wired; actual theme filtering can be enabled once `theme_tags` is added to `OpportunityOut` in the backend.

2. **`ideasApi` vs `generatedIdeasApi`**: The V3 generated-idea API client is exported as `generatedIdeasApi` (separate from the existing `ideasApi` which handles manual WatchlistIdea CRUD). This keeps concerns separated and avoids breaking existing imports.

3. **`ScannerStatusDot` auth**: The dot uses `useQuery` without an `enabled: !!user` guard because it is only rendered inside `<Sidebar>` which is itself only rendered inside authenticated `<AppShell>`. Adding the guard would require prop-drilling `user` into the Sidebar component.

4. **`generatedIdeasApi.list` query key**: Uses `["generated-ideas", activeTab, themeString]` so different filter combinations are cached independently. This is intentional — switching between "All" and "News" tabs uses separate cache entries.

5. **`IdeaFeed` refresh behaviour**: `scannerApi.runNow()` failure (e.g., outside market hours) is silently swallowed with an informational toast, then the ideas list is re-fetched anyway. This is per spec ("ideas expire after 24 hours" implies stale data is still useful to show).

6. **Prohibited language audit**: All rendered strings have been checked. No instances of "guaranteed", "safe", "certain to go up", or "can't lose" appear anywhere. The `EstimatedEntryPanel` uses the exact required wording: "This is not a guaranteed price."

---

## 9. Spec Gaps Encountered (None Blocking)

- `GET /api/opportunities` is expected (T3-19) to return the V3 extended fields (`signal_status`, `condition_details`, etc.). Until the backend T3-19 is deployed, these fields will be `null` and the UI will render `PENDING` / "Calculating…" states gracefully.
- `GET /api/scanner/status` and `POST /api/scanner/run-now` (T3-20) are new backend endpoints. Until deployed, `ScannerStatusDot` will render nothing (query returns undefined) and `scannerApi.runNow()` will throw (caught by toast handler).
- `GET /api/ideas/generated` and related endpoints (T3-21) are new. Until deployed, `IdeaFeed` shows the empty state: "No ideas generated yet."

All gaps are handled gracefully — the UI degrades cleanly to loading/empty states without errors.
