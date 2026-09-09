import { summarizeBacktest } from "@/lib/backtest-summary";
import type { BacktestTrade, StrategyRun } from "@/types";

const run = { leverage: 2 } as StrategyRun;
const trade = (value: number, day = 1) => ({ leveraged_return_pct: value, return_pct: value / 2, entry_time: `2026-01-${String(day).padStart(2, "0")}` }) as BacktestTrade;

test("compounds returns rather than adding gains and losses", () => {
  const summary = summarizeBacktest(run, [trade(50), trade(-50, 2)]);
  expect(summary.total_return_pct).toBeCloseTo(-25);
  expect(summary.max_drawdown_pct).toBeCloseTo(50);
});
test("drawdown includes consecutive losses from the equity peak", () => {
  expect(summarizeBacktest(run, [trade(20), trade(-10, 2), trade(-10, 3)]).max_drawdown_pct).toBeCloseTo(19);
});
test("orders trades chronologically and excludes break-even trades from wins", () => {
  const summary = summarizeBacktest(run, [trade(-10, 3), trade(0, 2), trade(20)]);
  expect(summary.win_rate).toBeCloseTo(1 / 3);
  expect(summary.max_drawdown_pct).toBeCloseTo(10);
});
test("all wins have zero drawdown and empty results have finite metrics", () => {
  expect(summarizeBacktest(run, [trade(10), trade(10, 2)]).max_drawdown_pct).toBe(0);
  expect(summarizeBacktest(run, []).sharpe_like).toBe(0);
});
test("rejects invalid data instead of displaying false performance", () => {
  expect(() => summarizeBacktest(run, [trade(NaN)])).toThrow("invalid returns");
});
