import type {
  WheelBotSessionResponse,
  WheelBotSetupRequest,
  WheelBotSummaryResponse,
} from "@/types";
import { apiFetch } from "./api";

export const wheelBotApi = {
  setup: (payload: WheelBotSetupRequest): Promise<WheelBotSessionResponse> =>
    apiFetch("/api/v1/wheel-bot/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (): Promise<WheelBotSessionResponse[]> =>
    apiFetch("/api/v1/wheel-bot/sessions"),

  getSession: (id: number): Promise<WheelBotSessionResponse> =>
    apiFetch(`/api/v1/wheel-bot/sessions/${id}`),

  cancelSession: (id: number): Promise<void> =>
    apiFetch(`/api/v1/wheel-bot/sessions/${id}`, { method: "DELETE" }),

  getSummary: (id: number): Promise<WheelBotSummaryResponse> =>
    apiFetch(`/api/v1/wheel-bot/sessions/${id}/summary`),
};
