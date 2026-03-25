# FRONTEND2.md — NextGenStock v2 Frontend Implementation

Generated: 2026-03-24
Implements: Wave 9–11 and T-47 from tasks2.md

---

## New TypeScript Interfaces

All added to `frontend/types/index.ts`:

### Buy Zone
| Interface | Description |
|---|---|
| `BuyZoneSnapshot` | Full snapshot from `GET /api/stocks/{ticker}/buy-zone` — all scoring fields, explanation array, model version |

### Theme Score
| Interface | Description |
|---|---|
| `ThemeScoreResult` | Theme scoring result with `theme_scores_by_category: Record<string, number>`, component scores, explanation |

### Alerts
| Interface | Description |
|---|---|
| `AlertType` | Union type of 6 alert type strings |
| `PriceAlertRule` | Alert rule record from backend |
| `CreateAlertRequest` | POST body for creating an alert |
| `UpdateAlertRequest` | PATCH body for updating an alert |

### Ideas
| Interface | Description |
|---|---|
| `WatchlistIdeaTicker` | Linked ticker entry with `near_earnings` flag |
| `WatchlistIdea` | Full idea record including `rank_score` and `tickers[]` |
| `CreateIdeaRequest` | POST body for creating an idea |
| `UpdateIdeaRequest` | PATCH body for updating an idea |

### Auto-Buy
| Interface | Description |
|---|---|
| `AutoBuyDecisionState` | Union type of 8 decision state strings |
| `AutoBuySettings` | User auto-buy settings record |
| `UpdateAutoBuySettingsRequest` | PATCH body for settings |
| `AutoBuyDecisionLog` | Single decision log entry |
| `AutoBuyDryRunResult` | Dry run simulation result with reason codes |

### Opportunities
| Interface | Description |
|---|---|
| `OpportunityRow` | Single row in the opportunities table |

---

## New API Functions

All added to `frontend/lib/api.ts`:

### `buyZoneApi`
| Function | Method + Endpoint |
|---|---|
| `get(ticker)` | `GET /api/stocks/{ticker}/buy-zone` |
| `recalculate(ticker)` | `POST /api/stocks/{ticker}/recalculate-buy-zone` |

### `themeScoreApi`
| Function | Method + Endpoint |
|---|---|
| `get(ticker)` | `GET /api/stocks/{ticker}/theme-score` |
| `recompute(ticker)` | `POST /api/stocks/{ticker}/theme-score/recompute` |

### `alertsApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/alerts` |
| `create(body)` | `POST /api/alerts` |
| `update(id, body)` | `PATCH /api/alerts/{id}` |
| `delete(id)` | `DELETE /api/alerts/{id}` |

### `ideasApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/ideas` |
| `create(body)` | `POST /api/ideas` |
| `update(id, body)` | `PATCH /api/ideas/{id}` |
| `delete(id)` | `DELETE /api/ideas/{id}` |

### `autoBuyApi`
| Function | Method + Endpoint |
|---|---|
| `getSettings()` | `GET /api/auto-buy/settings` |
| `updateSettings(body)` | `PATCH /api/auto-buy/settings` |
| `decisionLog(limit?)` | `GET /api/auto-buy/decision-log?limit={n}` |
| `dryRun(ticker)` | `POST /api/auto-buy/dry-run/{ticker}` |

### `opportunitiesApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/opportunities` |

---

## New Components

### `components/buy-zone/ThemeScoreBadge.tsx`
**Props:** `{ scoresByCategory: Record<string, number>; className?: string }`

Renders one Badge per theme with score > 0. Colors: gray (< 0.30), amber (0.30–0.60), green (≥ 0.60). Theme names are title-cased from snake_case keys.

### `components/buy-zone/BuyZoneCard.tsx`
**Props:** `{ snapshot: BuyZoneSnapshot; className?: string }`

Displays: zone range (low/high), current price, invalidation price, confidence progress bar (inline div — `@radix-ui/react-progress` not installed), entry quality bar, expected 30d/90d returns, expected drawdown, expandable explanation list (native toggle — `@radix-ui/react-collapsible` not installed), model version, and calculation timestamp.

Uses approved probabilistic vocabulary throughout. "Scenario-based estimate" and "positive outcome rate" labels are displayed for all return fields.

### `components/buy-zone/HistoricalOutcomePanel.tsx`
**Props:** `{ snapshot: BuyZoneSnapshot; className?: string }`

Displays positive outcome rate bars for 30d and 90d horizons. Color-coded: green (≥ 60%), amber (45–60%), red (< 45%). Includes expected return stat blocks with "scenario-based estimate" sublabels. Disclaimer text is always visible.

### `components/buy-zone/BuyZoneAnalysisPanel.tsx`
**Props:** `{ ticker: string; alertRule?: PriceAlertRule; autoBuyEligible?: boolean; className?: string }`

Collapsible panel (native toggle). On open, fetches buy zone and theme score data using TanStack Query. Renders `BuyZoneCard`, `HistoricalOutcomePanel`, and `ThemeScoreBadge`. Includes inline alert enable/disable `Switch` (calls `PATCH /api/alerts/{id}`) and a Recalculate button with spinner. Used as row expansion in `/opportunities`.

### `components/alerts/AlertConfigForm.tsx`
**Props:** `{ onSuccess?: () => void }`

React Hook Form + Zod validation. Fields: ticker, alert type (Select, 6 options), proximity_pct (shown conditionally when type is `near_buy_zone`), cooldown_minutes, market_hours_only (Switch), enabled (Switch). Submits `POST /api/alerts` via `alertsApi.create`. Invalidates `["alerts"]` query on success.

### `components/ideas/IdeaForm.tsx`
**Props:** `{ existing?: WatchlistIdea; onSuccess?: () => void }`

Create/edit form. Fields: title, thesis (textarea), conviction_score (HTML `<input type="range">` 1–10 — `@radix-ui/react-slider` not installed), theme tags (checkbox grid using `SUPPORTED_THEMES`), tickers_raw (comma-separated text input), watch_only (Switch with tooltip), tradable (Switch). Submits create or update via `ideasApi`. Exports `SUPPORTED_THEMES` constant.

### `components/ideas/IdeaList.tsx`
**Props:** `{ ideas: WatchlistIdea[]; isLoading?: boolean }`

Renders idea cards sorted by `rank_score` (sort is backend-provided). Each card shows: title, watch-only/non-tradable badges, linked tickers, thesis preview (2-line clamp), theme tags, conviction score, rank score, last updated date. Edit button opens a Dialog with `IdeaForm` (edit mode). Delete button opens a confirmation Dialog. Handles loading skeleton and empty state.

---

## New Pages

### `/opportunities` — `app/opportunities/page.tsx`
Watchlist + buy zone dashboard. Auth guard redirects to `/login?callbackUrl=/opportunities`.

Table columns: ticker, price, buy zone range, distance %, confidence badge, theme score, alert status (Bell/BellOff icon), auto-buy eligibility (Zap icon), last updated.

Features: text search filter, alert status filter (All/Enabled/Disabled), sort controls for 4 columns (confidence, distance, theme score, ticker). Row click expands `BuyZoneAnalysisPanel` inline using a second table row spanning all columns.

### `/ideas` — `app/ideas/page.tsx`
Idea manager. Auth guard. `IdeaList` with data from `GET /api/ideas`. "New Idea" button in page header opens Dialog with `IdeaForm`. Edit and delete flows are handled inside `IdeaList`.

### `/alerts` — `app/alerts/page.tsx`
Alert rule manager. Auth guard. Alert rule cards with inline enable/disable `Switch`. "New Alert" button opens Dialog with `AlertConfigForm`. Delete with confirmation Dialog. Empty state with call-to-action button.

### `/auto-buy` — `app/auto-buy/page.tsx`
Auto-buy controls. Auth guard. Two-column layout on large screens.

**Settings panel:** Master enable Switch (requires confirmation Dialog before enabling). Paper/Live mode Switch (requires second confirmation Dialog before switching to live). Max trade amount input. Confidence threshold HTML range slider. Max expected drawdown HTML range slider. Earnings blackout Switch. Allowed broker accounts checkbox list (populated from `GET /broker/credentials`).

**Dry Run panel:** Ticker input + Dry Run button. Shows full decision result with state badge (color-coded) and reason codes (green = PASSED, red = FAILED prefix).

**Decision log table:** Last 50 entries. Columns: timestamp, ticker, state badge (color-coded per `AutoBuyDecisionState`), reason code pills, mode (dry/live). State badge colors: green = order_filled/ready_to_buy/ready_to_alert (amber), red = blocked_by_risk/order_rejected, gray = candidate/cancelled.

Persistent risk disclaimer banner at top of page. Prominent warnings on enable and live-mode confirmation Dialogs. No language implying guaranteed outcomes anywhere on this page.

---

## Sidebar Navigation Changes

`frontend/components/layout/Sidebar.tsx` updated.

Four new links added after `/trade-log`, before `/profile`:

| Route | Label | Icon |
|---|---|---|
| `/opportunities` | Opportunities | `Crosshair` |
| `/ideas` | Ideas | `Lightbulb` |
| `/alerts` | Alerts | `Bell` |
| `/auto-buy` | Auto-Buy | `Zap` |

New icons imported from `lucide-react`: `Crosshair`, `Lightbulb`, `Bell`, `Zap`.

---

## Middleware Route Protection

`frontend/middleware.ts` updated. Four new routes added to `PROTECTED_PREFIXES`:

```ts
"/opportunities",
"/ideas",
"/alerts",
"/auto-buy",
```

Unauthenticated access redirects to `/login?callbackUrl=<path>`. Pattern is identical to all existing protected routes.

---

## Design Decisions and Assumptions

### Missing shadcn/ui primitives
The spec references `Collapsible`, `Progress`, and a slider component, none of which are installed in the project (`@radix-ui/react-collapsible`, `@radix-ui/react-progress`, `@radix-ui/react-slider` absent from `package.json`). Per the constraint "use existing shadcn/ui components — DO NOT install new UI libraries", these were replaced with equivalent native implementations:

- **Collapsible** → `useState` boolean toggle + ChevronDown/ChevronRight icon button. Visually and functionally identical.
- **Progress bar** → Plain `<div>` with `width: N%` styling and Tailwind classes. Used in `BuyZoneCard` and `HistoricalOutcomePanel`.
- **Slider** → HTML `<input type="range">` with `accent-primary` Tailwind class. Used in `IdeaForm` (conviction score) and `auto-buy/page.tsx` (confidence threshold, drawdown sliders). The `onMouseUp`/`onTouchEnd` pattern is used to debounce API calls on the settings sliders.

### Multi-select for broker accounts
No multi-select component is installed. Implemented as a labeled checkbox list styled to match the existing design system.

### Alert toggle on BuyZoneAnalysisPanel
The panel accepts an optional `alertRule` prop. When present, it renders an inline `Switch`. When absent (no alert configured for that ticker), the switch is hidden. The opportunities page passes the alert rule from its `alertRules` query using a ticker → rule map.

### Auto-buy settings: numeric field save strategy
The confidence threshold and drawdown sliders save on `onMouseUp`/`onTouchEnd` to avoid making a PATCH request on every drag event. The max trade amount saves on `onBlur`. This is consistent with the pattern used in existing forms.

### IdeaForm: tickers_raw field
The Zod schema stores `tickers_raw` as a plain `string` (comma-separated). Parsing into `string[]` and mapping to `{ ticker, is_primary }` objects happens inside the mutation function. This avoids TypeScript type conflicts with `z.transform()` in React Hook Form's typed `defaultValues`.

### Opportunities page: no chart
Per tasks2.md assumption "No new charting libraries — the `/opportunities` page uses Recharts for metric sparklines". The table-based layout with expandable `BuyZoneAnalysisPanel` rows fulfills the spec without adding sparklines, which were described as optional. This is noted as a minor design decision — sparklines could be added later using the existing Recharts dependency.

### Banned language compliance
All components and pages were written to avoid the banned vocabulary list. Specific replacements made:
- "Expected return" always labeled "scenario-based estimate" as sublabel text
- "Positive outcome rate" used for all historical win rate displays
- "High-probability entry zone" used instead of "buy zone" in user-facing headers where appropriate
- No "safe", "guaranteed", "certain", or command-form "buy now" appears anywhere in the new code
