import { z } from "zod";

export const chartTimeframes = ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "2h", "4h", "1d", "1wk", "1mo"] as const;
export const selectionSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9^][A-Z0-9.^/-]{0,19}$/),
  timeframe: z.enum(chartTimeframes),
  strategy: z.enum(["conservative", "aggressive", "squeeze", "ai-pick", "buy-low-sell-high"]),
});
export type TradingSelection = z.infer<typeof selectionSchema>;
export const DEFAULT_SELECTION: TradingSelection = { symbol: "AAPL", timeframe: "1d", strategy: "conservative" };

export function selectionFromParams(params: Pick<URLSearchParams, "get">, saved: TradingSelection): TradingSelection {
  const result = { ...saved };
  for (const field of ["symbol", "timeframe", "strategy"] as const) {
    const raw = params.get(field) ?? (field === "symbol" ? params.get("ticker") : null);
    const parsed = selectionSchema.shape[field].safeParse(raw);
    if (parsed.success) Object.assign(result, { [field]: parsed.data });
  }
  return result;
}

export function tradingHref(path: string, selection: TradingSelection): string {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query);
  params.delete("ticker");
  Object.entries(selection).forEach(([key, value]) => params.set(key, value));
  return `${pathname}?${params}`;
}
