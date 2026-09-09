import { DEFAULT_SELECTION, selectionFromParams, tradingHref } from "@/lib/trading-selection";

test("research links preserve symbol, timeframe and strategy without carrying live execution", () => {
  const selection = { ...DEFAULT_SELECTION, symbol: "BRK.B", timeframe: "4h" as const, strategy: "squeeze" as const };
  const url = new URL(tradingHref("/trade?view=order", selection), "https://example.test");
  expect(url.searchParams.get("view")).toBe("order");
  expect(selectionFromParams(url.searchParams, DEFAULT_SELECTION)).toEqual(selection);
  expect(url.searchParams.has("executionMode")).toBe(false);
});

test("legacy ticker links and unsupported chart intervals remain readable", () => {
  expect(selectionFromParams(new URLSearchParams("ticker=nvda&timeframe=2m&strategy=ai-pick"), DEFAULT_SELECTION))
    .toEqual({ symbol: "NVDA", timeframe: "2m", strategy: "ai-pick" });
});

test("invalid URL fields do not overwrite the saved selection", () => {
  const saved = { ...DEFAULT_SELECTION, symbol: "MSFT" };
  expect(selectionFromParams(new URLSearchParams("symbol=%3Cscript%3E&timeframe=invalid&strategy=live"), saved)).toEqual(saved);
});
