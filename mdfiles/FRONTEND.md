# NextGenStock — Frontend Architecture & Handoff

## Part 1: Core Trading Platform (V1)

**Version:** 1.0
**Date:** 2026-03-19
**Stack:** Next.js 14+ (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · TanStack Query v5

---

### 1. Project Structure

```
frontend/
  app/
    (auth)/
      login/page.tsx
      register/page.tsx
    dashboard/page.tsx
    strategies/page.tsx
    backtests/page.tsx
    live-trading/page.tsx
    artifacts/page.tsx
    profile/page.tsx
    layout.tsx               # root layout: font + QueryProvider + AuthProvider + Toaster
    globals.css
  components/
    ui/                      # shadcn/ui primitives (generated via CLI)
      button.tsx, card.tsx, input.tsx, label.tsx, badge.tsx,
      dialog.tsx, tabs.tsx, table.tsx, select.tsx, alert.tsx,
      scroll-area.tsx, sheet.tsx, separator.tsx, toast.tsx,
      sonner.tsx, switch.tsx, skeleton.tsx, dropdown-menu.tsx
    charts/
      PriceChart.tsx          # Lightweight Charts candlestick + volume + signal markers
      EquityCurve.tsx         # Recharts area chart + bar chart
      OptimizationScatter.tsx # Plotly scatter (AI Pick / BLSH only)
    layout/
      Sidebar.tsx             # Fixed left nav with links + user info
      TopNav.tsx              # Page header with title + actions
      AppShell.tsx            # Combines Sidebar + TopNav + <main> content
    strategy/
      StrategyModeSelector.tsx  # 4-tab mode selector
      StrategyForm.tsx          # Run form: symbol, timeframe, leverage, dry-run toggle
      ResultsPanel.tsx          # Post-run display: KPIs, PriceChart, EquityCurve, trades
  hooks/
    useAuth.ts               # Convenience re-export of AuthContext hook
  lib/
    api.ts                   # Typed fetch wrappers for all backend endpoints
    auth.ts                  # getCurrentUser(), silent refresh, logout
    queryClient.ts           # TanStack Query client singleton
    utils.ts                 # cn(), formatCurrency(), formatPct(), formatDate()
  types/
    index.ts                 # All TypeScript interface definitions (DTOs)
  middleware.ts              # JWT cookie check → redirect to /login
  tailwind.config.ts
  tsconfig.json
  package.json
  next.config.js
  .env.local.example
```

---

### 2. TypeScript Interfaces (All DTOs)

```typescript
// types/index.ts

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface UserResponse {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ─── Profile ─────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: number;
  user_id: number;
  display_name: string | null;
  timezone: string | null;
  default_symbol: string | null;
  default_mode: "conservative" | "aggressive" | "ai-pick" | "buy-low-sell-high" | null;
}

export interface UpdateProfileRequest {
  display_name?: string;
  timezone?: string;
  default_symbol?: string;
  default_mode?: "conservative" | "aggressive" | "ai-pick" | "buy-low-sell-high";
}

// ─── Broker Credentials ──────────────────────────────────────────────────────
export type BrokerProvider = "alpaca" | "robinhood";

export interface BrokerCredential {
  id: number;
  user_id: number;
  provider: BrokerProvider;
  profile_name: string;
  api_key: string;          // masked: "****ABCD"
  base_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBrokerCredentialRequest {
  provider: BrokerProvider;
  profile_name: string;
  api_key: string;
  secret_key: string;
  base_url?: string;
  paper_trading?: boolean;  // Alpaca only
}

export interface UpdateBrokerCredentialRequest {
  profile_name?: string;
  api_key?: string;
  secret_key?: string;
  base_url?: string;
  is_active?: boolean;
}

export interface BrokerTestResult {
  ok: boolean;
}

// ─── Strategy / Backtests ────────────────────────────────────────────────────
export type StrategyMode = "conservative" | "aggressive" | "ai-pick" | "buy-low-sell-high";
export type Timeframe = "1d" | "1h" | "4h" | "1wk";

export interface RunStrategyRequest {
  symbol: string;
  timeframe: Timeframe;
  mode: StrategyMode;
  leverage?: number;
  dry_run: boolean;
}

export interface StrategyRun {
  id: number;
  user_id: number;
  created_at: string;
  run_type: string;
  mode_name: string;
  strategy_family: string | null;
  symbol: string;
  timeframe: string;
  leverage: number | null;
  min_confirmations: number | null;
  trailing_stop_pct: number | null;
  current_regime: string | null;
  current_signal: string | null;
  confirmation_count: number | null;
  selected_variant_name: string | null;
  selected_variant_score: number | null;
  notes: string | null;
  error_message: string | null;
}

export interface BacktestTrade {
  id: number;
  user_id: number;
  strategy_run_id: number;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  return_pct: number;
  leveraged_return_pct: number;
  pnl: number;
  holding_hours: number;
  exit_reason: string;
  mode_name: string;
}

export interface BacktestSummary {
  run: StrategyRun;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_like: number;
  trade_count: number;
  win_rate: number;
}

export interface VariantBacktestResult {
  id: number;
  user_id: number;
  strategy_run_id: number;
  created_at: string;
  mode_name: string;
  variant_name: string;
  family_name: string | null;
  symbol: string;
  timeframe: string;
  parameter_json: Record<string, unknown>;
  train_return: number;
  validation_return: number;
  test_return: number;
  validation_score: number;
  max_drawdown: number;
  sharpe_like: number;
  trade_count: number;
  selected_winner: boolean;
}

// ─── Chart Data ───────────────────────────────────────────────────────────────
export interface CandleBar {
  time: string;   // "YYYY-MM-DD"
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SignalMarker {
  time: string;
  position: "aboveBar" | "belowBar";
  color: string;
  shape: "arrowUp" | "arrowDown";
  text: string;
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface ChartData {
  candles: CandleBar[];
  signals: SignalMarker[];
  equity: EquityPoint[];
}

export interface OptimizationChartData {
  variants: VariantBacktestResult[];
}

// ─── Live Trading ─────────────────────────────────────────────────────────────
export interface SignalCheckRequest {
  symbol: string;
  timeframe: Timeframe;
  credential_id: number;
}

export interface SignalCheckResult {
  symbol: string;
  regime: string;
  signal: string;
  confirmation_count: number;
  strategy_run_id: number;
}

export interface ExecuteOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  credential_id: number;
  dry_run: boolean;
  strategy_run_id?: number;
}

export interface BrokerOrder {
  id: number;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number | null;
  notional_usd: number | null;
  broker_order_id: string | null;
  status: string | null;
  filled_price: number | null;
  filled_quantity: number | null;
  mode_name: string | null;
  dry_run: boolean;
  error_message: string | null;
  created_at: string;
}

export interface PositionSnapshot {
  id: number;
  symbol: string;
  position_side: string;
  quantity: number;
  avg_entry_price: number;
  mark_price: number | null;
  unrealized_pnl: number | null;
  realized_pnl: number | null;
  is_open: boolean;
  strategy_mode: string | null;
  created_at: string;
}

export interface LiveStatus {
  credential_id: number | null;
  provider: BrokerProvider | null;
  profile_name: string | null;
  connected: boolean;
}

// ─── Artifacts ────────────────────────────────────────────────────────────────
export interface Artifact {
  id: number;
  user_id: number;
  strategy_run_id: number;
  created_at: string;
  mode_name: string;
  variant_name: string;
  pine_script_version: string;
  notes: string | null;
  selected_winner: boolean;
  symbol: string;
}

export interface ArtifactWithCode extends Artifact {
  pine_script_code: string;
}

// ─── API Error ────────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  status: number;
}
```

---

### 3. Routes

| Path | Type | Page |
|------|------|------|
| `/login` | Public | Login form |
| `/register` | Public | Register form |
| `/dashboard` | Protected | KPIs, recent runs, sparklines |
| `/strategies` | Protected | Mode selector, run form, results |
| `/backtests` | Protected | Leaderboard, run detail drawer |
| `/live-trading` | Protected | Signal check, execute order, positions |
| `/artifacts` | Protected | Pine Script viewer and download |
| `/profile` | Protected | User info, broker credentials |

Middleware protects all routes except `/login`, `/register`, and `/_next/*`.

---

### 4. API Call Shapes (`lib/api.ts`)

All calls use `NEXT_PUBLIC_API_BASE_URL`. All calls include `credentials: 'include'`. On 401, a silent refresh is attempted once; on second 401, redirect to `/login`.

#### Auth
```
POST /auth/register       body: RegisterRequest           → UserResponse (201)
POST /auth/login          body: LoginRequest              → UserResponse (200)
GET  /auth/me             —                               → UserResponse
POST /auth/refresh        —                               → { ok: true }
POST /auth/logout         —                               → { ok: true }
```

#### Profile
```
GET  /profile             —                               → UserProfile
PATCH /profile            body: UpdateProfileRequest      → UserProfile
```

#### Broker
```
GET    /broker/credentials                  —                                 → BrokerCredential[]
POST   /broker/credentials                  body: CreateBrokerCredentialRequest → BrokerCredential
PATCH  /broker/credentials/{id}             body: UpdateBrokerCredentialRequest → BrokerCredential
DELETE /broker/credentials/{id}             —                                 → { ok: true }
POST   /broker/credentials/{id}/test        —                                 → BrokerTestResult
```

#### Backtests
```
POST /backtests/run               body: RunStrategyRequest  → BacktestSummary
GET  /backtests                   ?limit=50                 → StrategyRun[]
GET  /backtests/{id}              —                         → BacktestSummary
GET  /backtests/{id}/trades       —                         → BacktestTrade[]
GET  /backtests/{id}/leaderboard  —                         → VariantBacktestResult[]
GET  /backtests/{id}/chart-data   —                         → ChartData
```

#### Strategies
```
POST /strategies/ai-pick/run              body: RunStrategyRequest → BacktestSummary
POST /strategies/buy-low-sell-high/run    body: RunStrategyRequest → BacktestSummary
GET  /strategies/runs                     ?limit=50                → StrategyRun[]
GET  /strategies/runs/{id}                —                        → BacktestSummary
GET  /strategies/runs/{id}/optimization-chart — → OptimizationChartData
```

#### Live Trading
```
POST /live/run-signal-check   body: SignalCheckRequest    → SignalCheckResult
POST /live/execute            body: ExecuteOrderRequest   → BrokerOrder
GET  /live/orders             ?limit=50                   → BrokerOrder[]
GET  /live/positions          —                           → PositionSnapshot[]
GET  /live/status             —                           → LiveStatus
GET  /live/chart-data         ?symbol=X&interval=1d       → { candles: CandleBar[] }
```

#### Artifacts
```
GET /artifacts         —   → Artifact[]
GET /artifacts/{id}    —   → Artifact
GET /artifacts/{id}/pine-script — → { code: string }
```

---

### 5. Authentication Flow

#### Backend Issues
- `access_token` cookie (HTTP-only, SameSite=Lax, 15 min)
- `refresh_token` cookie (HTTP-only, SameSite=Lax, 7 days)

#### Middleware (`middleware.ts`)
- Runs on all paths matching `/((?!_next/static|_next/image|favicon.ico).*)`
- Reads `access_token` cookie from the request
- If missing on a protected route → redirect to `/login?callbackUrl=<path>`
- Does NOT decode the JWT (edge runtime limitation) — just checks presence
- Backend authoritative validation via `GET /auth/me` on page hydration

#### AuthContext
- Wraps `app/layout.tsx`
- On mount: calls `GET /auth/me` via TanStack Query
- Exposes `{ user, isLoading, logout }`
- `logout()`: calls `POST /auth/logout` → clears query cache → `router.push('/login')`

#### 401 Interceptor (`lib/api.ts`)
1. Any API response that returns 401
2. Attempt `POST /auth/refresh`
3. If refresh succeeds → retry original request
4. If refresh fails → `router.push('/login')`

---

### 6. State Management (TanStack Query)

#### Query Keys
```typescript
const QUERY_KEYS = {
  me: ['auth', 'me'],
  profile: ['profile'],
  brokerCredentials: ['broker', 'credentials'],
  backtests: ['backtests'],
  backtest: (id: number) => ['backtests', id],
  backtestTrades: (id: number) => ['backtests', id, 'trades'],
  backtestLeaderboard: (id: number) => ['backtests', id, 'leaderboard'],
  backtestChartData: (id: number) => ['backtests', id, 'chart-data'],
  strategyRuns: ['strategies', 'runs'],
  strategyRun: (id: number) => ['strategies', 'runs', id],
  optimizationChart: (id: number) => ['strategies', 'runs', id, 'optimization-chart'],
  liveStatus: ['live', 'status'],
  liveOrders: ['live', 'orders'],
  livePositions: ['live', 'positions'],
  liveChartData: (symbol: string, interval: string) => ['live', 'chart-data', symbol, interval],
  artifacts: ['artifacts'],
  artifact: (id: number) => ['artifacts', id],
  artifactCode: (id: number) => ['artifacts', id, 'pine-script'],
};
```

#### QueryClient Config
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,         // 401 handled by interceptor, not retry
      refetchOnWindowFocus: false,
    },
  },
})
```

#### Mutation Patterns
- Run strategy → `useMutation` → on success invalidate `strategyRuns` + `backtests`
- Run backtest → `useMutation` → on success invalidate `backtests`
- Execute order → `useMutation` → on success invalidate `liveOrders` + `livePositions`
- Save profile → `useMutation` → on success invalidate `profile`
- Add/delete broker credential → `useMutation` → on success invalidate `brokerCredentials`

---

### 7. Design System

#### Colors (Tailwind custom)
```
Background:  #0a0a0a  (bg-background)
Card:        #111111  (bg-card)
Border:      #1f1f1f  (border-border)
Green:       #22c55e  (text-green-500 / bg-green-500)
Red:         #ef4444  (text-red-500 / bg-red-500)
Muted text:  #888888  (text-muted-foreground)
```

#### Typography
- Font: `Inter` (next/font/google)
- Base size: 14px
- Monospace (Pine Script code): `JetBrains Mono` or system `font-mono`

#### shadcn/ui Components Per Page

| Page | Components |
|------|-----------|
| Login / Register | `Card`, `CardHeader`, `CardContent`, `Form`, `Input`, `Label`, `Button` |
| Dashboard | `Card`, `CardHeader`, `CardContent`, `Badge`, `Table`, `TableRow`, `TableCell`, `Skeleton` |
| Strategies | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Card`, `Input`, `Select`, `Button`, `Switch`, `Badge`, `Skeleton` |
| Backtests | `Table`, `Card`, `Badge`, `Button`, `Dialog`, `Skeleton` |
| Live Trading | `Alert`, `AlertDescription`, `Select`, `Input`, `Button`, `Switch`, `Dialog`, `Badge`, `Card`, `Table` |
| Artifacts | `Table`, `Card`, `ScrollArea`, `Button`, `Badge` |
| Profile | `Card`, `Form`, `Input`, `Label`, `Select`, `Button`, `Badge`, `Dialog`, `Alert`, `Switch`, `Separator` |
| AppShell / Sidebar | `Sheet` (mobile), `Button`, `Badge`, `Separator` |

---

### 8. Chart Specifications

#### PriceChart (`components/charts/PriceChart.tsx`)
- **Library:** `lightweight-charts`
- **Type:** Candlestick + histogram volume series
- **Props:** `data: CandleBar[]`, `signals?: SignalMarker[]`, `symbol?: string`, `height?: number`
- **Series:** CandlestickSeries (up=#22c55e, down=#ef4444) + HistogramSeries (volume, priceScaleId="volume", scaleMargins top=0.8)
- **Markers:** Signal markers on candlestick series (arrowUp=green below bar, arrowDown=red above bar)
- **Resize:** ResizeObserver on container ref
- **Init:** `useEffect` + `useRef<HTMLDivElement>` — must cleanup `chart.remove()` on unmount
- **SSR:** `"use client"` directive required

#### EquityCurve (`components/charts/EquityCurve.tsx`)
- **Library:** `recharts`
- **Type:** AreaChart (equity) stacked above BarChart (per-trade PnL)
- **Props:** `trades: BacktestTrade[]`, `equityPoints?: EquityPoint[]`
- **AreaChart data:** `{ date: string, equity: number }[]` derived from trades if equityPoints not provided
- **ReferenceLine:** y=100 (initial equity baseline)
- **Colors:** stroke=#22c55e, fill=#22c55e22 (positive), stroke=#ef4444 for negative bars
- **Always wrapped in** `<ResponsiveContainer width="100%" height={240}>`

#### OptimizationScatter (`components/charts/OptimizationScatter.tsx`)
- **Library:** `react-plotly.js` (dynamic import, ssr: false)
- **Type:** scatter
- **X axis:** max_drawdown (Max Drawdown %)
- **Y axis:** validation_return (Validation Return %)
- **Marker size:** 14 if winner, 8 otherwise
- **Marker color:** #22c55e if winner, #378ADD otherwise
- **Hover text:** variant_name + parameters from parameter_json
- **Background:** transparent (paper_bgcolor + plot_bgcolor)
- **Props:** `variants: VariantBacktestResult[]`

---

### 9. Page Specifications

#### `/login`
- Center-aligned `Card` (max-w-sm)
- Email + Password inputs with React Hook Form + Zod validation
- Submit → `POST /auth/login` → on success `router.push('/dashboard')`
- Error → `toast.error(detail)` from Sonner
- Link to `/register`
- No AppShell (public page)

#### `/register`
- Center-aligned `Card` (max-w-sm)
- Email, Password, Confirm Password with Zod: email format, min 8 chars, passwords match
- Submit → `POST /auth/register` → on success `router.push('/login')` with success toast
- Error → `toast.error(detail)`
- Link to `/login`
- No AppShell (public page)

#### `/dashboard`
- AppShell wrapper
- **KPI Cards row** (4 cards): Total Runs, Win Rate (%), Best PnL, Active Positions
  - Data: derived from `GET /strategies/runs` + `GET /live/positions`
- **Recent Runs Table**: last 10 strategy runs from `GET /strategies/runs?limit=10`
  - Columns: Symbol, Mode, Signal, Regime, Created
  - Regime/signal as `Badge` (bull=green, bear=red, uncertain=gray)
- **Equity Sparkline**: mini EquityCurve for most recent backtest (height=120)
- **Quick Launch** button → `/strategies`
- Loading: `Skeleton` cards + table rows

#### `/strategies`
- AppShell wrapper
- `Tabs` with 4 tabs: Conservative | Aggressive | AI Pick | Buy Low / Sell High
- Each tab renders `StrategyForm` with mode locked + `ResultsPanel` below on success
- **StrategyForm** props: `mode`, `defaultSymbol?`, `defaultTimeframe?`
  - Symbol: text input, placeholder "AAPL, BTC-USD, SPY"
  - Timeframe: Select with options 1d / 1h / 4h / 1wk
  - Leverage: optional number input (placeholder: mode default)
  - Dry Run: Switch (default ON)
  - Submit: `useMutation` on `POST /backtests/run` or optimizer endpoint
  - Loading: spinner in button, disable form
- **ResultsPanel** props: `run: BacktestSummary`, `chartData: ChartData`, `trades: BacktestTrade[]`, `variants?: VariantBacktestResult[]`
  - KPI grid: total return, max drawdown, Sharpe, trade count
  - `PriceChart` with signal markers
  - `EquityCurve`
  - Trade table (scrollable, max-h-64)
  - If AI Pick / BLSH: variant leaderboard + `OptimizationScatter`
  - Link to artifact if winner generated

#### `/backtests`
- AppShell wrapper
- "New Backtest" button → opens `Dialog` with `StrategyForm`
- **Leaderboard Table**: `GET /backtests?limit=50`
  - Columns: Symbol, Mode, Timeframe, Trades, Best Score, Created, Actions
  - Sortable by clicking column headers (client-side sort)
  - Row click → expand detail below table (or sheet on mobile)
- **Run Detail** (on row select):
  - Summary metric cards
  - `PriceChart` (from chart-data endpoint)
  - `EquityCurve`
  - Trade table (paginated client-side, 20/page)
  - Variant leaderboard (if AI Pick / BLSH)

#### `/live-trading`
- AppShell wrapper
- **Risk Disclaimer**: persistent `Alert` (variant="destructive") always visible at top
- **Broker Selector**: `Select` from `GET /broker/credentials`; shows provider `Badge` next to dropdown
- **Symbol + Timeframe** inputs
- **Signal Check**: Button → `POST /live/run-signal-check` → shows signal card with regime/signal/confirmations
- **Dry Run Toggle**: `Switch` (default ON); disabling → `Dialog` confirmation: "You are switching to LIVE mode. Real money will be used."
- **Live Mode Banner**: `Alert` (variant="destructive") shown when dry_run=false: "LIVE MODE — real money at risk"
- **Execute Order**: side select (buy/sell), quantity input, Execute button → `POST /live/execute`
- **Price Chart**: `PriceChart` for selected symbol from `GET /live/chart-data`
- **Positions Table**: `GET /live/positions` + manual Refresh button
- **Orders Table**: `GET /live/orders` + manual Refresh button

#### `/artifacts`
- AppShell wrapper
- **Artifacts Table**: `GET /artifacts`
  - Columns: Mode, Variant, Symbol, Timeframe, Created, Actions
  - Actions: View, Download, Copy
- **Detail Panel** (on row click): expands below or in Sheet
  - Metadata: strategy run link, mode, variant, symbol, created date
  - Pine Script code in `ScrollArea` (font-mono, max-h-96)
  - Copy button (navigator.clipboard.writeText from `GET /artifacts/{id}/pine-script`)
  - Download button (creates `.pine` Blob and triggers download)
- Code NOT syntax-highlighted with external lib — use `<pre className="font-mono text-sm">` in ScrollArea (keeps deps lean)

#### `/profile`
- AppShell wrapper
- **User Info Section** (`Card`):
  - Display name, timezone (IANA text input), default symbol, default mode Select
  - `PATCH /profile` on Save → success toast
- **Password Change Section** (`Card`):
  - Current password, new password, confirm new password
  - Separate form, separate submit (calls a password change endpoint if added, otherwise note as placeholder)
- **Broker Credentials Section** (`Card`):
  - List: each row shows `profile_name`, provider `Badge`, masked `api_key`, Edit / Test / Delete buttons
  - "Add Credential" → `Dialog` with adaptive form:
    - Provider dropdown (alpaca default, robinhood)
    - Alpaca: API Key ID, Secret Key (type="password"), Paper Trading Switch
    - Robinhood: API Key, Private Key (type="password"), warning `Alert`
    - Profile name input
    - Save + Test Connection buttons
  - Test → `POST /broker/credentials/{id}/test` → toast "Connected" or "Connection failed"
  - Delete → `Dialog` confirmation → `DELETE /broker/credentials/{id}`

---

### 10. Middleware Logic (`middleware.ts`)

```typescript
// Protected route prefixes
const PROTECTED = ['/dashboard', '/strategies', '/backtests', '/live-trading', '/artifacts', '/profile'];
// Public routes (auth not needed)
const PUBLIC = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const hasToken = request.cookies.has('access_token');

  if (isProtected && !hasToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
```

---

### 11. Folder Naming Conventions

- Files: `PascalCase.tsx` for components, `camelCase.ts` for lib/hooks/types
- Hooks: prefix `use` (e.g., `useAuth.ts`, `useBrokerCredentials.ts`)
- Query keys: defined as constants in `lib/queryKeys.ts` or inline in `lib/api.ts`
- No barrel `index.ts` re-exports — import directly from file paths
- All `"use client"` components explicitly declare the directive at the top

---

### 12. Environment Variables

```bash
# .env.local.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Only `NEXT_PUBLIC_API_BASE_URL` is needed. No secrets belong in the frontend.

---

### 13. Error Handling Rules

| HTTP Status | Frontend Behavior |
|-------------|------------------|
| 401 | Attempt silent refresh once; on failure redirect to `/login` |
| 403 | Show `toast.error("Access denied")` |
| 422 | Show `toast.error(detail)` — includes symbol validation errors |
| 500 | Show `toast.error("Server error. Please try again.")` |
| Network error | Show `toast.error("Unable to connect to server.")` |

---

### 14. Responsive Layout

- **Desktop (≥1024px):** Fixed left sidebar (w-64), main content takes remaining width
- **Tablet (768–1023px):** Sidebar collapses; hamburger button in TopNav → `Sheet` slides in
- **Mobile (<768px):** Full-width layout, Sheet for nav, horizontal scroll for tables

---

### 15. Assumptions

1. Backend sets cookie name `access_token` — middleware checks this exact name.
2. `PATCH /profile` uses partial body; password change is a stretch goal and placeholder in the UI.
3. Live positions/orders refresh on demand only (no polling), per TASKS.md OQ-03.
4. Pine Script code is displayed in a `<pre>` block inside `ScrollArea` — no external syntax highlighter added to keep bundle size down.
5. The Plotly `OptimizationScatter` chart renders `max_drawdown` on X axis and `validation_return` on Y axis (matches PRD reference implementation).
6. `/register` redirects to `/login` post-registration (not auto-login), keeping auth flow simple.
7. Broker credential form "Test Connection" on newly created credentials uses the returned `id` from the POST response.

---

## Part 2: Buy Zone, Alerts, Auto-Buy & Ideas (V2)

Generated: 2026-03-24
Implements: Wave 9–11 and T-47 from tasks2.md

---

### New TypeScript Interfaces

All added to `frontend/types/index.ts`:

#### Buy Zone
| Interface | Description |
|---|---|
| `BuyZoneSnapshot` | Full snapshot from `GET /api/stocks/{ticker}/buy-zone` — all scoring fields, explanation array, model version |

#### Theme Score
| Interface | Description |
|---|---|
| `ThemeScoreResult` | Theme scoring result with `theme_scores_by_category: Record<string, number>`, component scores, explanation |

#### Alerts
| Interface | Description |
|---|---|
| `AlertType` | Union type of 6 alert type strings |
| `PriceAlertRule` | Alert rule record from backend |
| `CreateAlertRequest` | POST body for creating an alert |
| `UpdateAlertRequest` | PATCH body for updating an alert |

#### Ideas
| Interface | Description |
|---|---|
| `WatchlistIdeaTicker` | Linked ticker entry with `near_earnings` flag |
| `WatchlistIdea` | Full idea record including `rank_score` and `tickers[]` |
| `CreateIdeaRequest` | POST body for creating an idea |
| `UpdateIdeaRequest` | PATCH body for updating an idea |

#### Auto-Buy
| Interface | Description |
|---|---|
| `AutoBuyDecisionState` | Union type of 8 decision state strings |
| `AutoBuySettings` | User auto-buy settings record |
| `UpdateAutoBuySettingsRequest` | PATCH body for settings |
| `AutoBuyDecisionLog` | Single decision log entry |
| `AutoBuyDryRunResult` | Dry run simulation result with reason codes |

#### Opportunities
| Interface | Description |
|---|---|
| `OpportunityRow` | Single row in the opportunities table |

---

### New API Functions

All added to `frontend/lib/api.ts`:

#### `buyZoneApi`
| Function | Method + Endpoint |
|---|---|
| `get(ticker)` | `GET /api/stocks/{ticker}/buy-zone` |
| `recalculate(ticker)` | `POST /api/stocks/{ticker}/recalculate-buy-zone` |

#### `themeScoreApi`
| Function | Method + Endpoint |
|---|---|
| `get(ticker)` | `GET /api/stocks/{ticker}/theme-score` |
| `recompute(ticker)` | `POST /api/stocks/{ticker}/theme-score/recompute` |

#### `alertsApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/alerts` |
| `create(body)` | `POST /api/alerts` |
| `update(id, body)` | `PATCH /api/alerts/{id}` |
| `delete(id)` | `DELETE /api/alerts/{id}` |

#### `ideasApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/ideas` |
| `create(body)` | `POST /api/ideas` |
| `update(id, body)` | `PATCH /api/ideas/{id}` |
| `delete(id)` | `DELETE /api/ideas/{id}` |

#### `autoBuyApi`
| Function | Method + Endpoint |
|---|---|
| `getSettings()` | `GET /api/auto-buy/settings` |
| `updateSettings(body)` | `PATCH /api/auto-buy/settings` |
| `decisionLog(limit?)` | `GET /api/auto-buy/decision-log?limit={n}` |
| `dryRun(ticker)` | `POST /api/auto-buy/dry-run/{ticker}` |

#### `opportunitiesApi`
| Function | Method + Endpoint |
|---|---|
| `list()` | `GET /api/opportunities` |

---

### New Components

#### `components/buy-zone/ThemeScoreBadge.tsx`
**Props:** `{ scoresByCategory: Record<string, number>; className?: string }`

Renders one Badge per theme with score > 0. Colors: gray (< 0.30), amber (0.30–0.60), green (≥ 0.60). Theme names are title-cased from snake_case keys.

#### `components/buy-zone/BuyZoneCard.tsx`
**Props:** `{ snapshot: BuyZoneSnapshot; className?: string }`

Displays: zone range (low/high), current price, invalidation price, confidence progress bar (inline div — `@radix-ui/react-progress` not installed), entry quality bar, expected 30d/90d returns, expected drawdown, expandable explanation list (native toggle — `@radix-ui/react-collapsible` not installed), model version, and calculation timestamp.

Uses approved probabilistic vocabulary throughout. "Scenario-based estimate" and "positive outcome rate" labels are displayed for all return fields.

#### `components/buy-zone/HistoricalOutcomePanel.tsx`
**Props:** `{ snapshot: BuyZoneSnapshot; className?: string }`

Displays positive outcome rate bars for 30d and 90d horizons. Color-coded: green (≥ 60%), amber (45–60%), red (< 45%). Includes expected return stat blocks with "scenario-based estimate" sublabels. Disclaimer text is always visible.

#### `components/buy-zone/BuyZoneAnalysisPanel.tsx`
**Props:** `{ ticker: string; alertRule?: PriceAlertRule; autoBuyEligible?: boolean; className?: string }`

Collapsible panel (native toggle). On open, fetches buy zone and theme score data using TanStack Query. Renders `BuyZoneCard`, `HistoricalOutcomePanel`, and `ThemeScoreBadge`. Includes inline alert enable/disable `Switch` (calls `PATCH /api/alerts/{id}`) and a Recalculate button with spinner. Used as row expansion in `/opportunities`.

#### `components/alerts/AlertConfigForm.tsx`
**Props:** `{ onSuccess?: () => void }`

React Hook Form + Zod validation. Fields: ticker, alert type (Select, 6 options), proximity_pct (shown conditionally when type is `near_buy_zone`), cooldown_minutes, market_hours_only (Switch), enabled (Switch). Submits `POST /api/alerts` via `alertsApi.create`. Invalidates `["alerts"]` query on success.

#### `components/ideas/IdeaForm.tsx`
**Props:** `{ existing?: WatchlistIdea; onSuccess?: () => void }`

Create/edit form. Fields: title, thesis (textarea), conviction_score (HTML `<input type="range">` 1–10 — `@radix-ui/react-slider` not installed), theme tags (checkbox grid using `SUPPORTED_THEMES`), tickers_raw (comma-separated text input), watch_only (Switch with tooltip), tradable (Switch). Submits create or update via `ideasApi`. Exports `SUPPORTED_THEMES` constant.

#### `components/ideas/IdeaList.tsx`
**Props:** `{ ideas: WatchlistIdea[]; isLoading?: boolean }`

Renders idea cards sorted by `rank_score` (sort is backend-provided). Each card shows: title, watch-only/non-tradable badges, linked tickers, thesis preview (2-line clamp), theme tags, conviction score, rank score, last updated date. Edit button opens a Dialog with `IdeaForm` (edit mode). Delete button opens a confirmation Dialog. Handles loading skeleton and empty state.

---

### New Pages

#### `/opportunities` — `app/opportunities/page.tsx`
Watchlist + buy zone dashboard. Auth guard redirects to `/login?callbackUrl=/opportunities`.

Table columns: ticker, price, buy zone range, distance %, confidence badge, theme score, alert status (Bell/BellOff icon), auto-buy eligibility (Zap icon), last updated.

Features: text search filter, alert status filter (All/Enabled/Disabled), sort controls for 4 columns (confidence, distance, theme score, ticker). Row click expands `BuyZoneAnalysisPanel` inline using a second table row spanning all columns.

#### `/ideas` — `app/ideas/page.tsx`
Idea manager. Auth guard. `IdeaList` with data from `GET /api/ideas`. "New Idea" button in page header opens Dialog with `IdeaForm`. Edit and delete flows are handled inside `IdeaList`.

#### `/alerts` — `app/alerts/page.tsx`
Alert rule manager. Auth guard. Alert rule cards with inline enable/disable `Switch`. "New Alert" button opens Dialog with `AlertConfigForm`. Delete with confirmation Dialog. Empty state with call-to-action button.

#### `/auto-buy` — `app/auto-buy/page.tsx`
Auto-buy controls. Auth guard. Two-column layout on large screens.

**Settings panel:** Master enable Switch (requires confirmation Dialog before enabling). Paper/Live mode Switch (requires second confirmation Dialog before switching to live). Max trade amount input. Confidence threshold HTML range slider. Max expected drawdown HTML range slider. Earnings blackout Switch. Allowed broker accounts checkbox list (populated from `GET /broker/credentials`).

**Dry Run panel:** Ticker input + Dry Run button. Shows full decision result with state badge (color-coded) and reason codes (green = PASSED, red = FAILED prefix).

**Decision log table:** Last 50 entries. Columns: timestamp, ticker, state badge (color-coded per `AutoBuyDecisionState`), reason code pills, mode (dry/live). State badge colors: green = order_filled/ready_to_buy/ready_to_alert (amber), red = blocked_by_risk/order_rejected, gray = candidate/cancelled.

Persistent risk disclaimer banner at top of page. Prominent warnings on enable and live-mode confirmation Dialogs. No language implying guaranteed outcomes anywhere on this page.

---

### Sidebar Navigation Changes

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

### Middleware Route Protection

`frontend/middleware.ts` updated. Four new routes added to `PROTECTED_PREFIXES`:

```ts
"/opportunities",
"/ideas",
"/alerts",
"/auto-buy",
```

Unauthenticated access redirects to `/login?callbackUrl=<path>`. Pattern is identical to all existing protected routes.

---

### Design Decisions and Assumptions

#### Missing shadcn/ui primitives
The spec references `Collapsible`, `Progress`, and a slider component, none of which are installed in the project (`@radix-ui/react-collapsible`, `@radix-ui/react-progress`, `@radix-ui/react-slider` absent from `package.json`). Per the constraint "use existing shadcn/ui components — DO NOT install new UI libraries", these were replaced with equivalent native implementations:

- **Collapsible** → `useState` boolean toggle + ChevronDown/ChevronRight icon button. Visually and functionally identical.
- **Progress bar** → Plain `<div>` with `width: N%` styling and Tailwind classes. Used in `BuyZoneCard` and `HistoricalOutcomePanel`.
- **Slider** → HTML `<input type="range">` with `accent-primary` Tailwind class. Used in `IdeaForm` (conviction score) and `auto-buy/page.tsx` (confidence threshold, drawdown sliders). The `onMouseUp`/`onTouchEnd` pattern is used to debounce API calls on the settings sliders.

#### Multi-select for broker accounts
No multi-select component is installed. Implemented as a labeled checkbox list styled to match the existing design system.

#### Alert toggle on BuyZoneAnalysisPanel
The panel accepts an optional `alertRule` prop. When present, it renders an inline `Switch`. When absent (no alert configured for that ticker), the switch is hidden. The opportunities page passes the alert rule from its `alertRules` query using a ticker → rule map.

#### Auto-buy settings: numeric field save strategy
The confidence threshold and drawdown sliders save on `onMouseUp`/`onTouchEnd` to avoid making a PATCH request on every drag event. The max trade amount saves on `onBlur`. This is consistent with the pattern used in existing forms.

#### IdeaForm: tickers_raw field
The Zod schema stores `tickers_raw` as a plain `string` (comma-separated). Parsing into `string[]` and mapping to `{ ticker, is_primary }` objects happens inside the mutation function. This avoids TypeScript type conflicts with `z.transform()` in React Hook Form's typed `defaultValues`.

#### Opportunities page: no chart
Per tasks2.md assumption "No new charting libraries — the `/opportunities` page uses Recharts for metric sparklines". The table-based layout with expandable `BuyZoneAnalysisPanel` rows fulfills the spec without adding sparklines, which were described as optional. This is noted as a minor design decision — sparklines could be added later using the existing Recharts dependency.

#### Banned language compliance
All components and pages were written to avoid the banned vocabulary list. Specific replacements made:
- "Expected return" always labeled "scenario-based estimate" as sublabel text
- "Positive outcome rate" used for all historical win rate displays
- "High-probability entry zone" used instead of "buy zone" in user-facing headers where appropriate
- No "safe", "guaranteed", "certain", or command-form "buy now" appears anywhere in the new code

---

## Part 3: Watchlist Scanner, Buy Signals & Idea Engine (V3)

**Date:** 2026-03-24
**Tasks implemented:** T3-22 through T3-30 (T3-32 → T3-42 per the user-visible task numbering), T3-42 (Sidebar scanner status)
**Status:** Complete — TypeScript compiles with zero errors

---

### 1. Summary of Changes

V3 adds three visible capabilities to the frontend:

1. **Opportunities page** — WatchlistTable replaces the legacy watchlist sidebar panel. Users add/remove tickers directly in the table, see live signal status (BuyNowBadge), ideal entry price, 90d win rate, and expandable row detail (EstimatedEntryPanel). Page polls every 5 minutes.

2. **Ideas page** — The "Suggested Ideas" tab now renders `IdeaFeed` (V3 auto-generated idea cards from `GET /api/ideas/generated`) instead of the legacy `GET /api/scanner/ideas` V2 feed. "My Ideas" tab and `IdeaForm` are unchanged.

3. **Sidebar scanner status dot** — A small pulsing green dot appears next to "Opportunities" in the sidebar when the scanner is active and has tickers in queue.

---

### 2. New and Modified Files

#### New files

| Path | Description |
|---|---|
| `frontend/components/opportunities/BuyNowBadge.tsx` | Signal status badge with 4 states + 10-condition tooltip |
| `frontend/components/opportunities/EstimatedEntryPanel.tsx` | Expanded-row panel with entry zone, ideal price, win rate, drawdown, invalidation |
| `frontend/components/opportunities/WatchlistTable.tsx` | Full V3 watchlist table with add/remove/alert-toggle, all 10 columns |
| `frontend/components/ideas/AddToWatchlistButton.tsx` | One-click add with default/loading/added states |
| `frontend/components/ideas/GeneratedIdeaCard.tsx` | Auto-generated idea card (ticker, moat, financials, entry priority, news link) |
| `frontend/components/ideas/IdeaFeed.tsx` | Filterable/sortable feed with source tabs, theme chips, last-scan banner |

#### Modified files

| Path | Change |
|---|---|
| `frontend/types/index.ts` | Added V3 types (see Section 3); extended `OpportunityRow` with signal-status fields |
| `frontend/lib/api.ts` | Added `watchlistApi`, `generatedIdeasApi`; extended `scannerApi` (see Section 4) |
| `frontend/app/opportunities/page.tsx` | Replaced with V3 `WatchlistTable`-centric layout; 5-min poll |
| `frontend/app/ideas/page.tsx` | "Suggested" tab now renders `IdeaFeed`; badge count from `generatedIdeasApi.list` |
| `frontend/components/layout/Sidebar.tsx` | Added `ScannerStatusDot` component; polls `/api/scanner/status` every 5 min |

---

### 3. New TypeScript Types (`frontend/types/index.ts`)

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

### 4. New API Client Functions (`frontend/lib/api.ts`)

#### `watchlistApi` (new)
```typescript
watchlistApi.add(ticker)                          → POST /api/watchlist
watchlistApi.remove(ticker)                       → DELETE /api/watchlist/{ticker}
watchlistApi.toggleAlert(ticker, alert_enabled)   → PATCH /api/watchlist/{ticker}/alert
```

#### `generatedIdeasApi` (new)
```typescript
generatedIdeasApi.list(params?)    → GET /api/ideas/generated?source=&theme=&limit=
generatedIdeasApi.addToWatchlist(id) → POST /api/ideas/generated/{id}/add-to-watchlist
generatedIdeasApi.lastScan()       → GET /api/ideas/generated/last-scan
```

#### `scannerApi` extended
```typescript
scannerApi.status()   → GET /api/scanner/status
scannerApi.runNow()   → POST /api/scanner/run-now
```

---

### 5. Component Props

#### `BuyNowBadge`
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

#### `EstimatedEntryPanel`
```typescript
interface EstimatedEntryPanelProps {
  row: OpportunityRow;
  className?: string;
}
```
- Reads `buy_zone_low/high`, `ideal_entry_price`, `backtest_win_rate_90d`, `expected_drawdown`, `invalidation_price`, `backtest_confidence`, `suppressed_reason` from the row
- Required wording: "This is not a guaranteed price." is rendered literally

#### `WatchlistTable`
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

#### `AddToWatchlistButton`
```typescript
interface AddToWatchlistButtonProps {
  ideaId: number;
  ticker: string;
  added_to_watchlist: boolean;
  className?: string;
}
```
- Initialises in "Added" (green, disabled) when `added_to_watchlist=true`
- Calls `generatedIdeasApi.addToWatchlist(ideaId)` on click
- Toast: "{TICKER} added to watchlist. Alert created for buy zone entry."

#### `GeneratedIdeaCard`
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

#### `IdeaFeed`
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

#### `ScannerStatusDot` (in Sidebar)
- Polls `scannerApi.status()` every 5 minutes
- Green `animate-pulse` dot when `market_hours_active=true` AND `tickers_in_queue > 0`
- Static dimmed green when active but queue empty
- Gray when market closed or data unavailable
- Tooltip: "Scanner active — N tickers in queue"

---

### 6. Page Modifications

#### `/opportunities` (page.tsx rewritten)
- Auth guard preserved (redirects to `/login`)
- `WatchlistTable` is now the primary content
- `GET /api/opportunities` polled every 5 minutes via `refetchInterval`
- `data-testid="page-title"` preserved as a screen-reader-only `<h1>`
- Legacy watchlist sidebar panel removed (superseded by WatchlistTable's inline add/remove)
- Legacy `BuyZoneAnalysisPanel`, scan-result toast, and alert filter bar removed (superseded)

#### `/ideas` (page.tsx updated)
- "Suggested Ideas" tab now renders `IdeaFeed` (uses `GET /api/ideas/generated`)
- Legacy `SuggestedIdeasPanel` (which used `GET /api/scanner/ideas`) removed
- Badge count on "Suggested Ideas" tab uses `generatedIdeasApi.list` preload query
- "My Ideas" tab, `IdeaList`, "New Idea" button, and `IdeaForm` dialog are unchanged

---

### 7. V3 Frontend → Backend Endpoint Map

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

### 8. Assumptions Made (Minor Ambiguities)

1. **Theme filter on WatchlistTable**: `OpportunityRow` does not carry `theme_tags[]` directly (only `theme_score_total`). Theme chip filtering in `WatchlistTable` is currently a no-op pass-through because there's no per-ticker tag list available from the opportunities endpoint. The filter is structurally wired; actual theme filtering can be enabled once `theme_tags` is added to `OpportunityOut` in the backend.

2. **`ideasApi` vs `generatedIdeasApi`**: The V3 generated-idea API client is exported as `generatedIdeasApi` (separate from the existing `ideasApi` which handles manual WatchlistIdea CRUD). This keeps concerns separated and avoids breaking existing imports.

3. **`ScannerStatusDot` auth**: The dot uses `useQuery` without an `enabled: !!user` guard because it is only rendered inside `<Sidebar>` which is itself only rendered inside authenticated `<AppShell>`. Adding the guard would require prop-drilling `user` into the Sidebar component.

4. **`generatedIdeasApi.list` query key**: Uses `["generated-ideas", activeTab, themeString]` so different filter combinations are cached independently. This is intentional — switching between "All" and "News" tabs uses separate cache entries.

5. **`IdeaFeed` refresh behaviour**: `scannerApi.runNow()` failure (e.g., outside market hours) is silently swallowed with an informational toast, then the ideas list is re-fetched anyway. This is per spec ("ideas expire after 24 hours" implies stale data is still useful to show).

6. **Prohibited language audit**: All rendered strings have been checked. No instances of "guaranteed", "safe", "certain to go up", or "can't lose" appear anywhere. The `EstimatedEntryPanel` uses the exact required wording: "This is not a guaranteed price."

---

### 9. Spec Gaps Encountered (None Blocking)

- `GET /api/opportunities` is expected (T3-19) to return the V3 extended fields (`signal_status`, `condition_details`, etc.). Until the backend T3-19 is deployed, these fields will be `null` and the UI will render `PENDING` / "Calculating..." states gracefully.
- `GET /api/scanner/status` and `POST /api/scanner/run-now` (T3-20) are new backend endpoints. Until deployed, `ScannerStatusDot` will render nothing (query returns undefined) and `scannerApi.runNow()` will throw (caught by toast handler).
- `GET /api/ideas/generated` and related endpoints (T3-21) are new. Until deployed, `IdeaFeed` shows the empty state: "No ideas generated yet."

All gaps are handled gracefully — the UI degrades cleanly to loading/empty states without errors.
