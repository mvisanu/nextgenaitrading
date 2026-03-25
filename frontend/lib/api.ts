/**
 * lib/api.ts
 *
 * Typed fetch wrappers for all NextGenStock backend endpoints.
 * All calls include `credentials: 'include'` so HTTP-only cookies are sent.
 * On a 401 response, a silent refresh is attempted once; on second 401 the
 * user is redirected to /login.
 */

import type {
  UserResponse,
  RegisterRequest,
  LoginRequest,
  UserProfile,
  UpdateProfileRequest,
  BrokerCredential,
  CreateBrokerCredentialRequest,
  UpdateBrokerCredentialRequest,
  BrokerTestResult,
  RunStrategyRequest,
  StrategyRun,
  BacktestSummary,
  BacktestTrade,
  VariantBacktestResult,
  ChartData,
  OptimizationChartData,
  SignalCheckRequest,
  SignalCheckResult,
  ExecuteOrderRequest,
  BrokerOrder,
  PositionSnapshot,
  LiveStatus,
  Artifact,
  BuyZoneSnapshot,
  ThemeScoreResult,
  PriceAlertRule,
  CreateAlertRequest,
  UpdateAlertRequest,
  WatchlistIdea,
  CreateIdeaRequest,
  UpdateIdeaRequest,
  AutoBuySettings,
  UpdateAutoBuySettingsRequest,
  AutoBuyDecisionLog,
  AutoBuyDryRunResult,
  OpportunityRow,
  EstimatedBuyPriceOut,
  ScanResultOut,
  GeneratedIdeaOut,
  // V3 types
  WatchlistEntry,
  GeneratedIdeaRow,
  AddToWatchlistResult,
  LastScanResult,
  ScannerStatus,
  RunNowResult,
  // Screener + TA types
  ScreenerRequest,
  ScreenerResult,
  ScreenerPreset,
  ScreenerRow,
  TARequest,
  TAResult,
  TopMoverRow,
} from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ─── Low-level fetch wrapper ──────────────────────────────────────────────────

let refreshPromise: Promise<void> | null = null;

function refreshTokenOnce(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => {
        if (!r.ok) throw new Error("refresh failed");
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  isRetry = false
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  // On 401, attempt a silent token refresh once, then retry the original request.
  // If the refresh also fails, redirect to /login.
  if (res.status === 401 && !isRetry) {
    try {
      await refreshTokenOnce();
      return apiFetch<T>(path, options, true);
    } catch {
      // Refresh failed — redirect to login
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as {
        detail?: string;
        errors?: { field: string; message: string }[];
      };
      if (body.errors?.length) {
        // Surface specific validation field errors instead of generic "Validation error"
        detail = body.errors
          .map((e) => `${e.field}: ${e.message}`)
          .join("; ");
      } else {
        detail = body.detail ?? detail;
      }
    } catch {
      // Use default detail
    }
    const err = Object.assign(new Error(detail), { status: res.status });
    throw err;
  }

  // 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function get<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}

function patch<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}

function del<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: RegisterRequest) =>
    post<UserResponse>("/auth/register", body),

  login: (body: LoginRequest) => post<UserResponse>("/auth/login", body),

  me: () => get<UserResponse>("/auth/me"),

  refresh: () => post<{ ok: boolean }>("/auth/refresh"),

  logout: () => post<{ ok: boolean }>("/auth/logout"),
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const profileApi = {
  get: () => get<UserProfile>("/profile"),

  update: (body: UpdateProfileRequest) => patch<UserProfile>("/profile", body),
};

// ─── Broker Credentials ───────────────────────────────────────────────────────

export const brokerApi = {
  list: () => get<BrokerCredential[]>("/broker/credentials"),

  create: (body: CreateBrokerCredentialRequest) =>
    post<BrokerCredential>("/broker/credentials", body),

  update: (id: number, body: UpdateBrokerCredentialRequest) =>
    patch<BrokerCredential>(`/broker/credentials/${id}`, body),

  delete: (id: number) => del<{ ok: boolean }>(`/broker/credentials/${id}`),

  test: (id: number) =>
    post<BrokerTestResult>(`/broker/credentials/${id}/test`),
};

// ─── Backtests ────────────────────────────────────────────────────────────────

export const backtestApi = {
  run: (body: RunStrategyRequest) =>
    post<BacktestSummary>("/backtests/run", body),

  list: (limit = 50) => get<StrategyRun[]>(`/backtests?limit=${limit}`),

  get: (id: number) => get<BacktestSummary>(`/backtests/${id}`),

  trades: (id: number) => get<BacktestTrade[]>(`/backtests/${id}/trades`),

  leaderboard: (id: number) =>
    get<VariantBacktestResult[]>(`/backtests/${id}/leaderboard`),

  chartData: (id: number) => get<ChartData>(`/backtests/${id}/chart-data`),
};

// ─── Strategies ───────────────────────────────────────────────────────────────

export const strategyApi = {
  runAiPick: (body: RunStrategyRequest) =>
    post<BacktestSummary>("/strategies/ai-pick/run", body),

  runBuyLowSellHigh: (body: RunStrategyRequest) =>
    post<BacktestSummary>("/strategies/buy-low-sell-high/run", body),

  listRuns: (limit = 50) =>
    get<StrategyRun[]>(`/strategies/runs?limit=${limit}`),

  getRun: (id: number) => get<BacktestSummary>(`/strategies/runs/${id}`),

  optimizationChart: (id: number) =>
    get<OptimizationChartData>(
      `/strategies/runs/${id}/optimization-chart`
    ),
};

// ─── Live Trading ─────────────────────────────────────────────────────────────

export const liveApi = {
  signalCheck: (body: SignalCheckRequest) =>
    post<SignalCheckResult>("/live/run-signal-check", body),

  execute: (body: ExecuteOrderRequest) =>
    post<BrokerOrder>("/live/execute", body),

  orders: (limit = 50) => get<BrokerOrder[]>(`/live/orders?limit=${limit}`),

  positions: () => get<PositionSnapshot[]>("/live/positions"),

  status: () => get<LiveStatus>("/live/status"),

  chartData: (symbol: string, interval: string) =>
    get<{ candles: import("@/types").CandleBar[] }>(
      `/live/chart-data?symbol=${encodeURIComponent(symbol)}&interval=${interval}`
    ),
};

// ─── Artifacts ────────────────────────────────────────────────────────────────

export const artifactApi = {
  list: () => get<Artifact[]>("/artifacts"),

  get: (id: number) => get<Artifact>(`/artifacts/${id}`),

  pineScript: (id: number) =>
    get<{ id: number; variant_name: string; symbol: string; pine_script_version: string; pine_script_code: string; code?: string }>(`/artifacts/${id}/pine-script`).then((r) => ({
      ...r,
      // Normalize field name: backend returns pine_script_code, client expects code
      code: r.pine_script_code ?? r.code ?? "",
    })),
};

// ─── Buy Zone ─────────────────────────────────────────────────────────────────

export const buyZoneApi = {
  get: (ticker: string) =>
    get<BuyZoneSnapshot>(`/stocks/${encodeURIComponent(ticker)}/buy-zone`),

  recalculate: (ticker: string) =>
    post<BuyZoneSnapshot>(`/stocks/${encodeURIComponent(ticker)}/recalculate-buy-zone`),
};

// ─── Theme Score ──────────────────────────────────────────────────────────────

export const themeScoreApi = {
  get: (ticker: string) =>
    get<ThemeScoreResult>(`/stocks/${encodeURIComponent(ticker)}/theme-score`),

  recompute: (ticker: string) =>
    post<ThemeScoreResult>(`/stocks/${encodeURIComponent(ticker)}/theme-score/recompute`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const alertsApi = {
  list: () => get<PriceAlertRule[]>("/alerts"),

  create: (body: CreateAlertRequest) => post<PriceAlertRule>("/alerts", body),

  update: (id: number, body: UpdateAlertRequest) =>
    patch<PriceAlertRule>(`/alerts/${id}`, body),

  delete: (id: number) => del<{ ok: boolean }>(`/alerts/${id}`),
};

// ─── Ideas ────────────────────────────────────────────────────────────────────

export const ideasApi = {
  list: () => get<WatchlistIdea[]>("/ideas"),

  create: (body: CreateIdeaRequest) => post<WatchlistIdea>("/ideas", body),

  update: (id: number, body: UpdateIdeaRequest) =>
    patch<WatchlistIdea>(`/ideas/${id}`, body),

  delete: (id: number) => del<{ ok: boolean }>(`/ideas/${id}`),
};

// ─── Auto-Buy ─────────────────────────────────────────────────────────────────

export const autoBuyApi = {
  getSettings: () => get<AutoBuySettings>("/auto-buy/settings"),

  updateSettings: (body: UpdateAutoBuySettingsRequest) =>
    patch<AutoBuySettings>("/auto-buy/settings", body),

  decisionLog: (limit = 50) =>
    get<AutoBuyDecisionLog[]>(`/auto-buy/decision-log?limit=${limit}`),

  dryRun: (ticker: string) =>
    post<AutoBuyDryRunResult>(`/auto-buy/dry-run/${encodeURIComponent(ticker)}`, {}),
};

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunitiesApi = {
  /** V3: enriched watchlist with signal status + all 10 condition flags */
  list: () => get<OpportunityRow[]>("/opportunities/watchlist"),
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

export const scannerApi = {
  estimateBuyPrices: (tickers: string[]) =>
    post<EstimatedBuyPriceOut[]>("/scanner/estimate-buy-prices", { tickers }),

  run: () => post<ScanResultOut[]>("/scanner/run"),

  getIdeas: () => get<GeneratedIdeaOut[]>("/scanner/ideas"),

  saveIdea: (ticker: string) =>
    post<WatchlistIdea>(`/scanner/ideas/${encodeURIComponent(ticker)}/save`),

  // V3 endpoints
  status: () => get<ScannerStatus>("/scanner/status"),

  runNow: () => post<RunNowResult>("/scanner/run-now"),
};

// ─── V3: Watchlist (user_watchlist table) ─────────────────────────────────────

export const watchlistApi = {
  add: (ticker: string) =>
    post<WatchlistEntry>("/watchlist", { ticker }),

  remove: (ticker: string) =>
    del<void>(`/watchlist/${encodeURIComponent(ticker)}`),

  toggleAlert: (ticker: string, alert_enabled: boolean) =>
    patch<WatchlistEntry>(`/watchlist/${encodeURIComponent(ticker)}/alert`, { alert_enabled }),
};

// ─── V3: Generated Ideas (DB feed) ────────────────────────────────────────────

export const generatedIdeasApi = {
  list: (params?: { source?: string; theme?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.source) qs.set("source", params.source);
    if (params?.theme) qs.set("theme", params.theme);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return get<GeneratedIdeaRow[]>(`/ideas/generated${query ? `?${query}` : ""}`);
  },

  addToWatchlist: (id: number) =>
    post<AddToWatchlistResult>(`/ideas/generated/${id}/add-to-watchlist`),

  lastScan: () => get<LastScanResult>("/ideas/generated/last-scan"),

  runNow: () => post<{ generated: number; top_ticker: string | null }>("/ideas/generated/run-now"),
};

// ── TradingView Screener + TA ──────────────────────────────────────

export const screenerTvApi = {
  screen: (params: ScreenerRequest) =>
    fetch("/api/tv-screener", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }).then(r => r.json()) as Promise<ScreenerResult>,

  presets: () =>
    fetch("/api/tv-screener/presets").then(r => r.json()) as Promise<ScreenerPreset[]>,

  fields: (assetType?: string) =>
    fetch(`/api/tv-screener/fields${assetType ? `?type=${assetType}` : ""}`).then(r => r.json()) as Promise<string[]>,

  lookup: (symbols: string[]) =>
    fetch("/api/tv-screener/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbols }),
    }).then(r => r.json()) as Promise<ScreenerRow[]>,
};

export const taApi = {
  analyze: (params: TARequest) =>
    fetch("/api/tv-ta/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }).then(r => r.json()) as Promise<TAResult>,

  topGainers: (exchange?: string, timeframe?: string, limit?: number) =>
    fetch(`/api/tv-ta/top-movers?direction=gainers&exchange=${exchange ?? "KUCOIN"}&timeframe=${timeframe ?? "15m"}&limit=${limit ?? 25}`)
      .then(r => r.json()) as Promise<TopMoverRow[]>,

  topLosers: (exchange?: string, timeframe?: string, limit?: number) =>
    fetch(`/api/tv-ta/top-movers?direction=losers&exchange=${exchange ?? "KUCOIN"}&timeframe=${timeframe ?? "15m"}&limit=${limit ?? 25}`)
      .then(r => r.json()) as Promise<TopMoverRow[]>,

  volumeBreakouts: (exchange?: string, timeframe?: string) =>
    fetch(`/api/tv-ta/volume-breakouts?exchange=${exchange ?? "KUCOIN"}&timeframe=${timeframe ?? "15m"}`)
      .then(r => r.json()) as Promise<TopMoverRow[]>,

  bollingerSqueeze: (exchange?: string, timeframe?: string) =>
    fetch(`/api/tv-ta/bollinger-squeeze?exchange=${exchange ?? "KUCOIN"}&timeframe=${timeframe ?? "4h"}`)
      .then(r => r.json()) as Promise<TopMoverRow[]>,
};
