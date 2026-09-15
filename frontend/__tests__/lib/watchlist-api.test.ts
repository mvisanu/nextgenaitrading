import { watchlistApi } from "@/lib/api";
jest.mock("@/lib/supabase", () => ({ getSupabaseBrowserClient: () => null }));

test("alert toggle sends the field required by the backend contract", async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ticker: "NVDA", alert_enabled: false }) });
  try {
    await watchlistApi.toggleAlert("NVDA", false);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/watchlist/NVDA/alert"), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: false }) }));
  } finally { global.fetch = original; }
});
