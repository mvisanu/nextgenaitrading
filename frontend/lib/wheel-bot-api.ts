import { apiFetch } from "./api";

export interface WheelBotSession {
  id: number;
  user_id: number;
  symbol: string;
  dry_run: boolean;
  stage: "sell_put" | "sell_call";
  active_contract_symbol: string | null;
  active_order_id: string | null;
  active_premium_received: number | null;
  active_strike: number | null;
  active_expiry: string | null;
  shares_qty: number;
  cost_basis_per_share: number | null;
  total_premium_collected: number;
  status: "active" | "cancelled" | "completed";
  last_action: string | null;
}

export interface WheelBotSummary {
  session_id: number;
  date: string;
  stage: string;
  symbol: string;
  active_contract_symbol: string | null;
  shares_qty: number;
  cost_basis_per_share: number | null;
  total_premium_collected: number;
  account_equity: number;
  account_cash: number;
  total_return_pct: number;
  last_action: string | null;
}

export interface WheelBotSetupRequest {
  symbol?: string;
  dry_run?: boolean;
}

export const setupWheelBot = (
  payload: WheelBotSetupRequest
): Promise<WheelBotSession> =>
  apiFetch("/api/v1/wheel-bot/setup", {
    method: "POST",
    body: JSON.stringify({ symbol: "TSLA", dry_run: true, ...payload }),
  });

export const listWheelSessions = (): Promise<WheelBotSession[]> =>
  apiFetch("/api/v1/wheel-bot/sessions");

export const getWheelSession = (id: number): Promise<WheelBotSession> =>
  apiFetch(`/api/v1/wheel-bot/sessions/${id}`);

export const cancelWheelSession = (id: number): Promise<void> =>
  apiFetch(`/api/v1/wheel-bot/sessions/${id}`, { method: "DELETE" });

export const getWheelSummary = (id: number): Promise<WheelBotSummary> =>
  apiFetch(`/api/v1/wheel-bot/sessions/${id}/summary`);

export const wheelBotApi = {
  setup: setupWheelBot,
  list: listWheelSessions,
  get: getWheelSession,
  cancel: cancelWheelSession,
  summary: getWheelSummary,
};
