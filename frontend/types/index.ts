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
  default_mode: StrategyMode | null;
}

export interface UpdateProfileRequest {
  display_name?: string;
  timezone?: string;
  default_symbol?: string;
  default_mode?: StrategyMode;
}

// ─── Broker Credentials ──────────────────────────────────────────────────────

export type BrokerProvider = "alpaca" | "robinhood";

export interface BrokerCredential {
  id: number;
  user_id: number;
  provider: BrokerProvider;
  profile_name: string;
  api_key: string; // masked: "****ABCD"
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
  paper_trading?: boolean; // Alpaca only
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

export type StrategyMode =
  | "conservative"
  | "aggressive"
  | "ai-pick"
  | "buy-low-sell-high";

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
  time: string; // "YYYY-MM-DD"
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
