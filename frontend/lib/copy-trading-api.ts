// frontend/lib/copy-trading-api.ts
import type {
  CopiedTradeOut,
  CopyTradingSessionOut,
  CreateCopySessionRequest,
  PoliticianRankingOut,
} from "@/types";
import { apiFetch } from "./api";

export const copyTradingApi = {
  getRankings: (): Promise<PoliticianRankingOut[]> =>
    apiFetch("/api/v1/copy-trading/rankings"),

  createSession: (payload: CreateCopySessionRequest): Promise<CopyTradingSessionOut> =>
    apiFetch("/api/v1/copy-trading/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (): Promise<CopyTradingSessionOut[]> =>
    apiFetch("/api/v1/copy-trading/sessions"),

  getSession: (id: number): Promise<CopyTradingSessionOut> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}`),

  cancelSession: (id: number): Promise<void> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}`, { method: "DELETE" }),

  getSessionTrades: (id: number): Promise<CopiedTradeOut[]> =>
    apiFetch(`/api/v1/copy-trading/sessions/${id}/trades`),

  getAllTrades: (): Promise<CopiedTradeOut[]> =>
    apiFetch("/api/v1/copy-trading/trades"),
};
