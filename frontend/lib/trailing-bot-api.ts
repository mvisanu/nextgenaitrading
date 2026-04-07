import type { TrailingBotSessionOut, TrailingBotSetupRequest } from "@/types";
import { apiFetch } from "./api";

export const trailingBotApi = {
  setup: (payload: TrailingBotSetupRequest): Promise<TrailingBotSessionOut> =>
    apiFetch("/api/v1/trailing-bot/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  list: (): Promise<TrailingBotSessionOut[]> =>
    apiFetch("/api/v1/trailing-bot/sessions"),

  get: (id: number): Promise<TrailingBotSessionOut> =>
    apiFetch(`/api/v1/trailing-bot/sessions/${id}`),

  cancel: (id: number): Promise<void> =>
    apiFetch(`/api/v1/trailing-bot/sessions/${id}`, { method: "DELETE" }),
};
