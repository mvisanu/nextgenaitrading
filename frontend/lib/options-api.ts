/**
 * lib/options-api.ts
 *
 * Typed fetch wrappers for the Options Trading Engine API (/api/v4/options).
 * Mirrors the pattern from lib/api.ts — uses apiFetch() with Bearer token.
 */

import { apiFetch } from "./api";

//localhost:8000";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OptionContractOut {
  symbol: string;
  expiration: string;
  strike: number;
  option_type: "call" | "put";
  bid: number;
  ask: number;
  mid: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  illiquid: boolean;
}

export interface ExpirationsOut {
  symbol: string;
  expirations: string[];
}

export interface ScanFilterIn {
  symbol: string;
  expiration: string;
  min_delta?: number;
  max_delta?: number;
  min_oi?: number;
  min_volume?: number;
  min_iv_rank?: number;
  strategy_bias?: "bullish" | "bearish" | "neutral" | "any";
  underlying_price?: number;
}

export interface IVRankOut {
  symbol: string;
  current_iv: number;
  iv_rank: number;
  iv_percentile: number;
}

export interface SignalLegOut {
  symbol: string;
  strike: number;
  option_type: "call" | "put";
  expiration: string;
  delta: number;
  theta: number;
}

export interface OptionsSignalOut {
  symbol: string;
  strategy: string;
  confidence: number;
  iv_rank: number;
  iv_percentile: number;
  underlying_trend: string;
  days_to_earnings: number | null;
  signal_time: string;
  blocked: boolean;
  block_reason: string | null;
  legs: SignalLegOut[];
}

export interface OptionsRiskModelOut {
  max_profit: number;
  max_loss: number;
  breakeven_prices: number[];
  profit_at_expiry: Record<string, number>;
  probability_of_profit: number;
  risk_reward_ratio: number;
  theta_per_day: number;
  days_to_expiry: number;
  margin_required: number;
  passes_risk_gate: boolean;
  risk_gate_failures: string[];
}

export interface OptionsPositionOut {
  id: number;
  symbol: string;
  strategy: string;
  legs: Record<string, unknown>[];
  broker: string;
  order_id: string | null;
  status: string;
  max_profit: number;
  max_loss: number;
  breakeven_prices: number[];
  probability_of_profit: number;
  iv_rank_at_entry: number;
  days_to_expiry_at_entry: number;
  dry_run: boolean;
  opened_at: string;
  closed_at: string | null;
  realized_pnl: number | null;
}

export interface ExecuteSignalIn {
  symbol: string;
  strategy: string;
  legs: SignalLegOut[];
  iv_rank: number;
  iv_percentile: number;
  underlying_trend: string;
  confidence: number;
  dry_run: boolean;
  underlying_price?: number;
}

export interface ExecutionResultOut {
  symbol: string;
  status: string;
  block_reason: string | null;
  order_id: string | null;
  dry_run: boolean;
  risk_model: OptionsRiskModelOut | null;
}

export interface OptionsExecutionOut {
  id: number;
  symbol: string;
  status: string;
  block_reason: string | null;
  dry_run: boolean;
  executed_at: string;
}

export interface PortfolioGreeksOut {
  net_delta: number;
  net_gamma: number;
  net_theta: number;
  net_vega: number;
  position_count: number;
}

// ─── Auth helper (mirrors lib/api.ts) ────────────────────────────────────────

const V4 = "/api/v4/options";

export const optionsApi = {
  getExpirations: (symbol: string): Promise<ExpirationsOut> =>
    apiFetch(`${V4}/expirations?symbol=${encodeURIComponent(symbol)}`),

  getChain: (symbol: string, expiration: string, underlyingPrice = 100): Promise<OptionContractOut[]> =>
    apiFetch(
      `${V4}/chain?symbol=${encodeURIComponent(symbol)}&expiration=${expiration}&underlying_price=${underlyingPrice}`
    ),

  scan: (filter: ScanFilterIn): Promise<OptionContractOut[]> =>
    apiFetch(`${V4}/scan`, { method: "POST", body: JSON.stringify(filter) }),

  getSignals: (): Promise<OptionsSignalOut[]> =>
    apiFetch(`${V4}/signals`),

  getPositions: (): Promise<OptionsPositionOut[]> =>
    apiFetch(`${V4}/positions`),

  execute: (body: ExecuteSignalIn): Promise<ExecutionResultOut> =>
    apiFetch(`${V4}/execute`, { method: "POST", body: JSON.stringify(body) }),

  getRisk: (symbol: string, strategy: string, underlyingPrice = 100): Promise<OptionsRiskModelOut> =>
    apiFetch(`${V4}/risk?symbol=${encodeURIComponent(symbol)}&strategy=${strategy}&underlying_price=${underlyingPrice}`),

  getPortfolioGreeks: (): Promise<PortfolioGreeksOut> =>
    apiFetch(`${V4}/greeks/portfolio`),

  getIVRank: (symbol: string): Promise<IVRankOut> =>
    apiFetch(`${V4}/iv/${encodeURIComponent(symbol)}`),

  getExecutions: (limit = 50): Promise<OptionsExecutionOut[]> =>
    apiFetch(`${V4}/executions?limit=${limit}`),
};
