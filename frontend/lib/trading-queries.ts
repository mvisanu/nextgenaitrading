import type { QueryClient } from "@tanstack/react-query";
import type { AccountId } from "./account-storage";
export const tradingKeys = {
  account: (id: AccountId) => ["account", id] as const,
  credentials: (id: AccountId) => ["account", id, "broker", "credentials"] as const,
  live: (id: AccountId) => ["account", id, "live"] as const,
  positions: (id: AccountId) => ["account", id, "live", "positions"] as const,
  orders: (id: AccountId) => ["account", id, "live", "orders"] as const,
  automation: (id: AccountId) => ["account", id, "auto-buy"] as const,
  settings: (id: AccountId) => ["account", id, "auto-buy", "settings"] as const,
  decisions: (id: AccountId) => ["account", id, "auto-buy", "decision-log"] as const,
};
export const LIVE_REFRESH_MS = 15_000;
export function refreshTrading(client: QueryClient, id: AccountId) {
  return Promise.all([
    client.invalidateQueries({ queryKey: tradingKeys.live(id) }),
    client.invalidateQueries({ queryKey: tradingKeys.automation(id) }),
  ]);
}
