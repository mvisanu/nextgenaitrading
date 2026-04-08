import { apiFetch } from "./api";
import type {
  CongressCopySessionOut,
  CongressCopySetupRequest,
  CongressTradeOut,
  CongressCopiedOrderOut,
  PoliticianSummary,
} from "@/types";

export const congressCopyApi = {
  listPoliticians: (limit = 20): Promise<PoliticianSummary[]> =>
    apiFetch(`/api/v1/congress-copy/politicians?limit=${limit}`),

  setup: (payload: CongressCopySetupRequest): Promise<CongressCopySessionOut> =>
    apiFetch("/api/v1/congress-copy/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (): Promise<CongressCopySessionOut[]> =>
    apiFetch("/api/v1/congress-copy/sessions"),

  getSession: (id: number): Promise<CongressCopySessionOut> =>
    apiFetch(`/api/v1/congress-copy/sessions/${id}`),

  cancelSession: (id: number): Promise<void> =>
    apiFetch(`/api/v1/congress-copy/sessions/${id}`, { method: "DELETE" }),

  listTrades: (sessionId: number): Promise<CongressTradeOut[]> =>
    apiFetch(`/api/v1/congress-copy/sessions/${sessionId}/trades`),

  listOrders: (sessionId: number): Promise<CongressCopiedOrderOut[]> =>
    apiFetch(`/api/v1/congress-copy/sessions/${sessionId}/orders`),
};
