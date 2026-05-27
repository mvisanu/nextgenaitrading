/**
 * Typed fetch wrappers for /api/v1/btc-bot/*.
 *
 * Uses the shared apiFetch helper which attaches Bearer tokens and handles 401 redirects.
 */
import { apiFetch } from "./api";

export type BtcBotSession = {
  id: number;
  user_id: number;
  status: "active" | "cooldown" | "ended" | "error";
  original_entry_price: string | null;
  blended_entry_price: string | null;
  total_qty: string;
  initial_buy_usd: string;
  current_floor: string | null;
  trailing_active: boolean;
  trailing_high: string | null;
  ladder_next: number;
  cooldown_until: string | null;
  realized_pnl: string | null;
  last_action_at: string | null;
  created_at: string;
  updated_at: string | null;
  ended_at: string | null;
};

export type BtcBotAction = {
  id: number;
  session_id: number;
  user_id: number;
  action: string;
  btc_price: string | null;
  qty_delta: string | null;
  usd_delta: string | null;
  floor_before: string | null;
  floor_after: string | null;
  alpaca_order_id: string | null;
  notes: string | null;
  created_at: string;
};

export type BtcBotSessionDetail = {
  session: BtcBotSession;
  actions: BtcBotAction[];
};

export const btcBotApi = {
  getCurrentSession(): Promise<BtcBotSession | null> {
    return apiFetch<BtcBotSession | null>("/api/v1/btc-bot/session");
  },

  listSessions(limit = 50, offset = 0): Promise<BtcBotSession[]> {
    return apiFetch<BtcBotSession[]>(
      `/api/v1/btc-bot/sessions?limit=${limit}&offset=${offset}`
    );
  },

  getSessionDetail(id: number): Promise<BtcBotSessionDetail> {
    return apiFetch<BtcBotSessionDetail>(`/api/v1/btc-bot/sessions/${id}`);
  },

  listActions(opts: { action?: string; limit?: number; offset?: number } = {}): Promise<BtcBotAction[]> {
    const params = new URLSearchParams();
    if (opts.action) params.set("action", opts.action);
    params.set("limit", String(opts.limit ?? 50));
    params.set("offset", String(opts.offset ?? 0));
    return apiFetch<BtcBotAction[]>(`/api/v1/btc-bot/actions?${params}`);
  },

  createSession(initialBuyUsd?: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>("/api/v1/btc-bot/sessions", {
      method: "POST",
      body: JSON.stringify(initialBuyUsd != null ? { initial_buy_usd: initialBuyUsd } : {}),
    });
  },

  closeSession(id: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>(`/api/v1/btc-bot/sessions/${id}/close`, {
      method: "POST",
    });
  },

  cancelCooldown(id: number): Promise<BtcBotSession> {
    return apiFetch<BtcBotSession>(`/api/v1/btc-bot/sessions/${id}/cancel-cooldown`, {
      method: "POST",
    });
  },
};
