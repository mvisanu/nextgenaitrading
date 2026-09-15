import { logLiveTrade } from "@/lib/tradeLog";

beforeEach(() => localStorage.clear());
test("paper fills remain distinct from live orders in the journal", () => {
  logLiveTrade({ accountId: "test", symbol: "AAPL", side: "buy", amountUsd: 100, dryRun: false, paper: true, timeframe: "1d", mode: "conservative" });
  const [entry] = JSON.parse(localStorage.getItem("ngs:user:test:trade-log")!);
  expect(entry).toMatchObject({ type: "Paper Order", dryRun: true, executionMode: "paper" });
  expect(entry.preNotes).toContain("[PAPER]");
});
test("a malformed saved log does not prevent a new entry", () => {
  localStorage.setItem("ngs:user:test:trade-log", "{}");
  logLiveTrade({ accountId: "test", symbol: "AAPL", side: "buy", amountUsd: 100, dryRun: false, timeframe: "1d", mode: "conservative" });
  expect(JSON.parse(localStorage.getItem("ngs:user:test:trade-log")!)[0].executionMode).toBe("live");
});
