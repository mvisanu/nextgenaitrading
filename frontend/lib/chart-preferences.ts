"use client";

import { z } from "zod";
import { useAccountStorage } from "./account-storage";
import { useAuth } from "./auth-context";

const schema = z.object({
  showMA: z.boolean(), showMACD: z.boolean(), showRSI: z.boolean(),
  showFVG: z.boolean(), showBollinger: z.boolean(), showDrawings: z.boolean(),
  showNews: z.boolean(), showWatchlist: z.boolean(), chartScale: z.enum(["linear", "log"]),
});
export type ChartPreferences = z.infer<typeof schema>;
const defaults: ChartPreferences = { showMA: false, showMACD: false, showRSI: false, showFVG: false, showBollinger: false, showDrawings: true, showNews: true, showWatchlist: true, chartScale: "linear" };
export function useChartPreferences() {
  const { user } = useAuth();
  return useAccountStorage(user?.id, "chart-preferences", schema, defaults);
}
