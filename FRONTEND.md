# FRONTEND.md — NextGenStock Frontend Specification

**Version:** 1.0
**Date:** 2026-03-19
**Stack:** Next.js 14+ (App Router) · TypeScript (strict) · Tailwind CSS · shadcn/ui · TanStack Query v5

---

## 1. Project Structure

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

## 2. TypeScript Interfaces (All DTOs)

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

## 3. Routes

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

## 4. API Call Shapes (`lib/api.ts`)

All calls use `NEXT_PUBLIC_API_BASE_URL`. All calls include `credentials: 'include'`. On 401, a silent refresh is attempted once; on second 401, redirect to `/login`.

### Auth
```
POST /auth/register       body: RegisterRequest           → UserResponse (201)
POST /auth/login          body: LoginRequest              → UserResponse (200)
GET  /auth/me             —                               → UserResponse
POST /auth/refresh        —                               → { ok: true }
POST /auth/logout         —                               → { ok: true }
```

### Profile
```
GET  /profile             —                               → UserProfile
PATCH /profile            body: UpdateProfileRequest      → UserProfile
```

### Broker
```
GET    /broker/credentials                  —                                 → BrokerCredential[]
POST   /broker/credentials                  body: CreateBrokerCredentialRequest → BrokerCredential
PATCH  /broker/credentials/{id}             body: UpdateBrokerCredentialRequest → BrokerCredential
DELETE /broker/credentials/{id}             —                                 → { ok: true }
POST   /broker/credentials/{id}/test        —                                 → BrokerTestResult
```

### Backtests
```
POST /backtests/run               body: RunStrategyRequest  → BacktestSummary
GET  /backtests                   ?limit=50                 → StrategyRun[]
GET  /backtests/{id}              —                         → BacktestSummary
GET  /backtests/{id}/trades       —                         → BacktestTrade[]
GET  /backtests/{id}/leaderboard  —                         → VariantBacktestResult[]
GET  /backtests/{id}/chart-data   —                         → ChartData
```

### Strategies
```
POST /strategies/ai-pick/run              body: RunStrategyRequest → BacktestSummary
POST /strategies/buy-low-sell-high/run    body: RunStrategyRequest → BacktestSummary
GET  /strategies/runs                     ?limit=50                → StrategyRun[]
GET  /strategies/runs/{id}                —                        → BacktestSummary
GET  /strategies/runs/{id}/optimization-chart — → OptimizationChartData
```

### Live Trading
```
POST /live/run-signal-check   body: SignalCheckRequest    → SignalCheckResult
POST /live/execute            body: ExecuteOrderRequest   → BrokerOrder
GET  /live/orders             ?limit=50                   → BrokerOrder[]
GET  /live/positions          —                           → PositionSnapshot[]
GET  /live/status             —                           → LiveStatus
GET  /live/chart-data         ?symbol=X&interval=1d       → { candles: CandleBar[] }
```

### Artifacts
```
GET /artifacts         —   → Artifact[]
GET /artifacts/{id}    —   → Artifact
GET /artifacts/{id}/pine-script — → { code: string }
```

---

## 5. Authentication Flow

### Backend Issues
- `access_token` cookie (HTTP-only, SameSite=Lax, 15 min)
- `refresh_token` cookie (HTTP-only, SameSite=Lax, 7 days)

### Middleware (`middleware.ts`)
- Runs on all paths matching `/((?!_next/static|_next/image|favicon.ico).*)`
- Reads `access_token` cookie from the request
- If missing on a protected route → redirect to `/login?callbackUrl=<path>`
- Does NOT decode the JWT (edge runtime limitation) — just checks presence
- Backend authoritative validation via `GET /auth/me` on page hydration

### AuthContext
- Wraps `app/layout.tsx`
- On mount: calls `GET /auth/me` via TanStack Query
- Exposes `{ user, isLoading, logout }`
- `logout()`: calls `POST /auth/logout` → clears query cache → `router.push('/login')`

### 401 Interceptor (`lib/api.ts`)
1. Any API response that returns 401
2. Attempt `POST /auth/refresh`
3. If refresh succeeds → retry original request
4. If refresh fails → `router.push('/login')`

---

## 6. State Management (TanStack Query)

### Query Keys
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

### QueryClient Config
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

### Mutation Patterns
- Run strategy → `useMutation` → on success invalidate `strategyRuns` + `backtests`
- Run backtest → `useMutation` → on success invalidate `backtests`
- Execute order → `useMutation` → on success invalidate `liveOrders` + `livePositions`
- Save profile → `useMutation` → on success invalidate `profile`
- Add/delete broker credential → `useMutation` → on success invalidate `brokerCredentials`

---

## 7. Design System

### Colors (Tailwind custom)
```
Background:  #0a0a0a  (bg-background)
Card:        #111111  (bg-card)
Border:      #1f1f1f  (border-border)
Green:       #22c55e  (text-green-500 / bg-green-500)
Red:         #ef4444  (text-red-500 / bg-red-500)
Muted text:  #888888  (text-muted-foreground)
```

### Typography
- Font: `Inter` (next/font/google)
- Base size: 14px
- Monospace (Pine Script code): `JetBrains Mono` or system `font-mono`

### shadcn/ui Components Per Page

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

## 8. Chart Specifications

### PriceChart (`components/charts/PriceChart.tsx`)
- **Library:** `lightweight-charts`
- **Type:** Candlestick + histogram volume series
- **Props:** `data: CandleBar[]`, `signals?: SignalMarker[]`, `symbol?: string`, `height?: number`
- **Series:** CandlestickSeries (up=#22c55e, down=#ef4444) + HistogramSeries (volume, priceScaleId="volume", scaleMargins top=0.8)
- **Markers:** Signal markers on candlestick series (arrowUp=green below bar, arrowDown=red above bar)
- **Resize:** ResizeObserver on container ref
- **Init:** `useEffect` + `useRef<HTMLDivElement>` — must cleanup `chart.remove()` on unmount
- **SSR:** `"use client"` directive required

### EquityCurve (`components/charts/EquityCurve.tsx`)
- **Library:** `recharts`
- **Type:** AreaChart (equity) stacked above BarChart (per-trade PnL)
- **Props:** `trades: BacktestTrade[]`, `equityPoints?: EquityPoint[]`
- **AreaChart data:** `{ date: string, equity: number }[]` derived from trades if equityPoints not provided
- **ReferenceLine:** y=100 (initial equity baseline)
- **Colors:** stroke=#22c55e, fill=#22c55e22 (positive), stroke=#ef4444 for negative bars
- **Always wrapped in** `<ResponsiveContainer width="100%" height={240}>`

### OptimizationScatter (`components/charts/OptimizationScatter.tsx`)
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

## 9. Page Specifications

### `/login`
- Center-aligned `Card` (max-w-sm)
- Email + Password inputs with React Hook Form + Zod validation
- Submit → `POST /auth/login` → on success `router.push('/dashboard')`
- Error → `toast.error(detail)` from Sonner
- Link to `/register`
- No AppShell (public page)

### `/register`
- Center-aligned `Card` (max-w-sm)
- Email, Password, Confirm Password with Zod: email format, min 8 chars, passwords match
- Submit → `POST /auth/register` → on success `router.push('/login')` with success toast
- Error → `toast.error(detail)`
- Link to `/login`
- No AppShell (public page)

### `/dashboard`
- AppShell wrapper
- **KPI Cards row** (4 cards): Total Runs, Win Rate (%), Best PnL, Active Positions
  - Data: derived from `GET /strategies/runs` + `GET /live/positions`
- **Recent Runs Table**: last 10 strategy runs from `GET /strategies/runs?limit=10`
  - Columns: Symbol, Mode, Signal, Regime, Created
  - Regime/signal as `Badge` (bull=green, bear=red, uncertain=gray)
- **Equity Sparkline**: mini EquityCurve for most recent backtest (height=120)
- **Quick Launch** button → `/strategies`
- Loading: `Skeleton` cards + table rows

### `/strategies`
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

### `/backtests`
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

### `/live-trading`
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

### `/artifacts`
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

### `/profile`
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

## 10. Middleware Logic (`middleware.ts`)

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

## 11. Folder Naming Conventions

- Files: `PascalCase.tsx` for components, `camelCase.ts` for lib/hooks/types
- Hooks: prefix `use` (e.g., `useAuth.ts`, `useBrokerCredentials.ts`)
- Query keys: defined as constants in `lib/queryKeys.ts` or inline in `lib/api.ts`
- No barrel `index.ts` re-exports — import directly from file paths
- All `"use client"` components explicitly declare the directive at the top

---

## 12. Environment Variables

```bash
# .env.local.example
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Only `NEXT_PUBLIC_API_BASE_URL` is needed. No secrets belong in the frontend.

---

## 13. Error Handling Rules

| HTTP Status | Frontend Behavior |
|-------------|------------------|
| 401 | Attempt silent refresh once; on failure redirect to `/login` |
| 403 | Show `toast.error("Access denied")` |
| 422 | Show `toast.error(detail)` — includes symbol validation errors |
| 500 | Show `toast.error("Server error. Please try again.")` |
| Network error | Show `toast.error("Unable to connect to server.")` |

---

## 14. Responsive Layout

- **Desktop (≥1024px):** Fixed left sidebar (w-64), main content takes remaining width
- **Tablet (768–1023px):** Sidebar collapses; hamburger button in TopNav → `Sheet` slides in
- **Mobile (<768px):** Full-width layout, Sheet for nav, horizontal scroll for tables

---

## 15. Assumptions

1. Backend sets cookie name `access_token` — middleware checks this exact name.
2. `PATCH /profile` uses partial body; password change is a stretch goal and placeholder in the UI.
3. Live positions/orders refresh on demand only (no polling), per TASKS.md OQ-03.
4. Pine Script code is displayed in a `<pre>` block inside `ScrollArea` — no external syntax highlighter added to keep bundle size down.
5. The Plotly `OptimizationScatter` chart renders `max_drawdown` on X axis and `validation_return` on Y axis (matches PRD reference implementation).
6. `/register` redirects to `/login` post-registration (not auto-login), keeping auth flow simple.
7. Broker credential form "Test Connection" on newly created credentials uses the returned `id` from the POST response.
