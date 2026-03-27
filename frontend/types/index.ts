// ─── Auth ────────────────────────────────────────────────────────────────────

export interface UserResponse {
  id: number | string;
  email: string;
  is_active: boolean;
  created_at: string;
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

export type Timeframe = "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

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
  time: string | number; // "YYYY-MM-DD" for daily+, Unix seconds for intraday
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SignalMarker {
  time: string | number;
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
  mode: "conservative" | "aggressive" | "squeeze";
  credential_id: number;
}

export interface ConfirmationDetail {
  name: string;
  met: boolean;
  value: string;
}

export interface SqueezeData {
  bb_upper: number;
  bb_lower: number;
  bb_middle: number;
  bb_width_pct: number;
  bb_width_percentile: number;
  is_squeeze: boolean;
  squeeze_strength: number;
  breakout_state: "none" | "bullish" | "bearish";
  breakout_confirmed: boolean;
  bars_since_squeeze: number;
}

export interface BollingerOverlayBar {
  time: string | number;
  upper: number;
  lower: number;
  middle: number;
  is_squeeze: boolean;
}

export interface SignalCheckResult {
  symbol: string;
  regime: string;
  signal: string;
  confirmation_count: number;
  strategy_run_id: number;
  reason: string | null;
  confirmation_details: ConfirmationDetail[];
  squeeze?: SqueezeData | null;
}

export interface ExecuteOrderRequest {
  symbol: string;
  side: "buy" | "sell";
  quantity?: number;
  notional_usd?: number;
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

// ─── Buy Zone ─────────────────────────────────────────────────────────────────

export interface BuyZoneSnapshot {
  id: number;
  user_id: number | null;
  ticker: string;
  current_price: number;
  buy_zone_low: number;
  buy_zone_high: number;
  confidence_score: number;
  entry_quality_score: number;
  expected_return_30d: number;
  expected_return_90d: number;
  expected_drawdown: number;
  positive_outcome_rate_30d: number;
  positive_outcome_rate_90d: number;
  invalidation_price: number;
  horizon_days: number;
  explanation_json: string[];
  feature_payload_json: Record<string, unknown>;
  model_version: string;
  created_at: string;
}

// ─── Theme Score ──────────────────────────────────────────────────────────────

export interface ThemeScoreResult {
  ticker: string;
  theme_score_total: number;
  theme_scores_by_category: Record<string, number>;
  narrative_momentum_score: number;
  sector_tailwind_score: number;
  macro_alignment_score: number;
  user_conviction_score: number;
  explanation: string[];
  created_at: string;
  updated_at: string;
}

// ─── Price Alert Rules ────────────────────────────────────────────────────────

export type AlertType =
  | "entered_buy_zone"
  | "near_buy_zone"
  | "below_invalidation"
  | "confidence_improved"
  | "theme_score_increased"
  | "macro_deterioration";

export interface PriceAlertRule {
  id: number;
  user_id: number;
  ticker: string;
  alert_type: AlertType;
  threshold_json: Record<string, unknown>;
  cooldown_minutes: number;
  market_hours_only: boolean;
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAlertRequest {
  ticker: string;
  alert_type: AlertType;
  threshold_json?: Record<string, unknown>;
  cooldown_minutes?: number;
  market_hours_only?: boolean;
  enabled?: boolean;
}

export interface UpdateAlertRequest {
  alert_type?: AlertType;
  threshold_json?: Record<string, unknown>;
  cooldown_minutes?: number;
  market_hours_only?: boolean;
  enabled?: boolean;
}

// ─── Watchlist Ideas ──────────────────────────────────────────────────────────

export interface WatchlistIdeaTicker {
  id: number;
  idea_id: number;
  ticker: string;
  is_primary: boolean;
  near_earnings: boolean;
}

export interface WatchlistIdea {
  id: number;
  user_id: number;
  title: string;
  thesis: string;
  conviction_score: number;
  watch_only: boolean;
  tradable: boolean;
  tags_json: string[];
  metadata_json: Record<string, unknown>;
  rank_score: number;
  tickers: WatchlistIdeaTicker[];
  created_at: string;
  updated_at: string;
}

export interface CreateIdeaRequest {
  title: string;
  thesis: string;
  conviction_score: number;
  watch_only?: boolean;
  tradable?: boolean;
  tags_json?: string[];
  tickers?: { ticker: string; is_primary: boolean }[];
}

export interface UpdateIdeaRequest {
  title?: string;
  thesis?: string;
  conviction_score?: number;
  watch_only?: boolean;
  tradable?: boolean;
  tags_json?: string[];
  tickers?: { ticker: string; is_primary: boolean }[];
}

// ─── Auto-Buy ─────────────────────────────────────────────────────────────────

export type AutoBuyDecisionState =
  | "candidate"
  | "ready_to_alert"
  | "ready_to_buy"
  | "blocked_by_risk"
  | "order_submitted"
  | "order_filled"
  | "order_rejected"
  | "cancelled";

export interface AutoBuySettings {
  id: number;
  user_id: number;
  enabled: boolean;
  paper_mode: boolean;
  confidence_threshold: number;
  max_trade_amount: number;
  max_position_percent: number;
  max_expected_drawdown: number;
  allow_near_earnings: boolean;
  allowed_account_ids_json: number[];
  execution_timeframe: string | null;
  start_date: string | null;
  end_date: string | null;
  target_buy_price: number | null;
  target_sell_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateAutoBuySettingsRequest {
  enabled?: boolean;
  paper_mode?: boolean;
  confirm_live_trading?: boolean;
  confidence_threshold?: number;
  max_trade_amount?: number;
  max_position_percent?: number;
  max_expected_drawdown?: number;
  allow_near_earnings?: boolean;
  allowed_account_ids_json?: number[];
  execution_timeframe?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  target_buy_price?: number | null;
  target_sell_price?: number | null;
}

export interface AutoBuyDecisionLog {
  id: number;
  user_id: number;
  ticker: string;
  decision_state: AutoBuyDecisionState;
  reason_codes_json: string[];
  signal_payload_json: Record<string, unknown>;
  order_payload_json: Record<string, unknown> | null;
  dry_run: boolean;
  created_at: string;
}

export interface AutoBuyDryRunResult {
  ticker: string;
  decision_state: AutoBuyDecisionState;
  reason_codes: string[];
  signal_payload: Record<string, unknown>;
  order_payload: Record<string, unknown> | null;
  dry_run: true;
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export interface OpportunityRow {
  ticker: string;
  alert_enabled: boolean;
  created_at: string;

  // Buy zone / pricing (from WatchlistOpportunityOut)
  buy_zone_low: number | null;
  buy_zone_high: number | null;
  ideal_entry_price: number | null;
  current_price: number | null;
  distance_to_zone_pct: number | null;

  // Confidence
  backtest_confidence: number | null;
  backtest_win_rate_90d: number | null;

  // Signal
  signal_strength: string | null;   // "STRONG_BUY" | "SUPPRESSED" | null
  all_conditions_pass: boolean;
  suppressed_reason: string | null;

  // Individual condition flags
  price_in_zone: boolean | null;
  above_50d_ma: boolean | null;
  above_200d_ma: boolean | null;
  rsi_value: number | null;
  rsi_confirms: boolean | null;
  volume_confirms: boolean | null;
  near_support: boolean | null;
  trend_regime_bullish: boolean | null;
  not_near_earnings: boolean | null;
  no_duplicate_in_cooldown: boolean | null;

  // Risk
  invalidation_price: number | null;
  expected_drawdown: number | null;
  last_signal_at: string | null;
}

// ─── Scanner ─────────────────────────────────────────────────────────────────

export interface EstimatedBuyPriceOut {
  ticker: string;
  estimated_buy_price: number | null;
  current_price: number;
  signal: string; // "buy" | "sell" | "hold" | "error"
  regime: string | null;
  confirmation_count: number;
  min_confirmations: number;
  confirmations_needed: string[];
  buy_zone_low: number | null;
  buy_zone_high: number | null;
}

export interface ScanResultOut extends EstimatedBuyPriceOut {
  notification_sent: boolean;
  scanned_at: string;
}

export interface GeneratedIdeaOut {
  ticker: string;
  title: string;
  thesis: string;
  signal: string;
  regime: string | null;
  confirmation_count: number;
  momentum_20d: number;
  momentum_60d: number;
  volume_score: number;
  theme_score: number | null;
  composite_score: number;
  current_price: number;
  tags: string[];
  generated_at: string;
}

// ─── V3: Watchlist (user_watchlist table) ─────────────────────────────────────

export interface WatchlistEntry {
  ticker: string;
  user_id: number;
  alert_enabled: boolean;
  created_at: string;
}

// ─── V3: BuyNow Signal ────────────────────────────────────────────────────────

export interface ConditionDetail {
  key: string;
  pass_: boolean;
}

export type SignalStatus = "STRONG_BUY" | "WATCHING" | "NOT_READY" | "PENDING";

export interface BuyNowSignalOut {
  id: number;
  user_id: number;
  ticker: string;
  buy_zone_low: number;
  buy_zone_high: number;
  ideal_entry_price: number;
  backtest_confidence: number;
  backtest_win_rate_90d: number;
  current_price: number;
  price_in_zone: boolean;
  above_50d_ma: boolean;
  above_200d_ma: boolean;
  rsi_value: number;
  rsi_confirms: boolean;
  volume_confirms: boolean;
  near_support: boolean;
  trend_regime_bullish: boolean;
  all_conditions_pass: boolean;
  signal_strength: "STRONG_BUY" | "SUPPRESSED";
  suppressed_reason: string | null;
  invalidation_price: number;
  expected_drawdown: number;
  condition_details: ConditionDetail[];
  created_at: string;
}

// ─── V3: Scanner status ───────────────────────────────────────────────────────

export interface ScannerStatus {
  last_scan_at: string | null;
  next_scan_at: string | null;
  tickers_in_queue: number;
  market_hours_active: boolean;
}

export interface RunNowResult {
  tickers_scanned: number;
  strong_buy_signals: number;
  strong_buy_tickers: string[];
  error_tickers: string[];
}

// ─── V3: Generated Ideas (DB feed) ───────────────────────────────────────────

export type EntryPriority = "52W_LOW" | "WEEKLY_SUPPORT" | "BOTH" | "STANDARD";
export type IdeaSource = "news" | "theme" | "technical" | "merged";

export interface GeneratedIdeaRow {
  id: number;
  ticker: string;
  company_name: string;
  source: IdeaSource;
  reason_summary: string;
  news_headline: string | null;
  news_url: string | null;
  news_source: string | null;
  catalyst_type: string | null;
  current_price: number;
  buy_zone_low: number | null;
  buy_zone_high: number | null;
  ideal_entry_price: number | null;
  confidence_score: number;
  historical_win_rate_90d: number | null;
  theme_tags: string[];
  megatrend_tags: string[];
  moat_score: number;
  moat_description: string | null;
  financial_quality_score: number;
  financial_flags: string[];
  near_52w_low: boolean;
  at_weekly_support: boolean;
  entry_priority: EntryPriority;
  idea_score: number;
  generated_at: string;
  expires_at: string;
  added_to_watchlist: boolean;
}

// ─── V3: Extended OpportunityRow (signal-status fields added) ─────────────────

// Extended fields added to OpportunityRow (declared below — kept as one interface)

export interface AddToWatchlistResult {
  ticker: string;
  watchlist_entry_created: boolean;
  alert_rule_created: boolean;
  idea_id: number;
}

export interface LastScanResult {
  last_scan_at: string | null;
  ideas_generated: number;
  next_scan_at: string | null;
}

// ── TradingView Screener + TA ──────────────────────────────────────

export type AssetUniverse = "stocks" | "crypto" | "forex" | "etf";

export interface ScreenerFilter {
  field: string;
  operator: string;
  value?: number | string | (number | string)[];
}

export interface ScreenerRequest {
  universe: AssetUniverse;
  filters?: ScreenerFilter[];
  sort_by?: string;
  sort_order?: "asc" | "desc";
  limit?: number;
  markets?: string[];
  preset?: string;
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  exchange?: string;
  close: number;
  change: number;
  change_pct: number;
  volume: number;
  market_cap?: number;
  rsi?: number;
  sma50?: number;
  sma200?: number;
  sector?: string;
  recommendation?: string;
  [key: string]: unknown;  // extra columns
}

export interface ScreenerResult {
  rows: ScreenerRow[];
  universe: AssetUniverse;
  total: number;
  timestamp: string;
}

export type TATimeframe = "5m" | "15m" | "1h" | "4h" | "1D" | "1W" | "1M";

export interface TARequest {
  symbol: string;
  exchange?: string;
  timeframe?: TATimeframe;
}

export interface TAIndicator {
  name: string;
  value: number | string | null;
  signal?: "BUY" | "SELL" | "NEUTRAL";
}

export interface TAResult {
  symbol: string;
  exchange: string;
  timeframe: string;
  recommendation: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  buy_count: number;
  sell_count: number;
  neutral_count: number;
  indicators: TAIndicator[];
  moving_averages?: TAIndicator[];
  oscillators?: TAIndicator[];
  volume_data?: {
    volume_ratio?: number;
    price_change?: number;
    confirmation?: string;
  };
  raw?: Record<string, unknown>;
}

export interface ScreenerPreset {
  key: string;
  name: string;
  description: string;
}

export interface TopMoverRow {
  symbol: string;
  exchange: string;
  close: number;
  change: number;
  change_pct: number;
  volume: number;
  bb_rating?: number;
  rsi?: number;
  [key: string]: unknown;
}

// ─── News Feed ──────────────────────────────────────────────────────────────

export interface NewsItem {
  headline: string;
  source: string;
  published_at: string | null;
  url: string;
  snippet: string;
  tickers_mentioned: string[];
  theme_tags: string[];
  relevance_score: number;
}
