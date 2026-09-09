import type { BacktestSummary, BacktestTrade, StrategyRun } from "@/types";

/** Closed-trade metrics, using the same compounding and population deviation as the engine. */
export function summarizeBacktest(run: StrategyRun, trades: BacktestTrade[]): BacktestSummary {
  const ordered = [...trades].sort((a, b) => Date.parse(a.entry_time) - Date.parse(b.entry_time));
  const returns = ordered.map((trade) => trade.leveraged_return_pct ?? trade.return_pct * (run.leverage ?? 1));
  if (returns.some((value) => !Number.isFinite(value))) throw new Error("Backtest contains invalid returns");
  let equity = 1;
  let peak = 1;
  let drawdown = 0;
  for (const value of returns) {
    equity *= 1 + value / 100;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, (peak - equity) / peak);
  }
  const mean = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const deviation = returns.length ? Math.sqrt(returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length) : 0;
  return {
    run,
    total_return_pct: (equity - 1) * 100,
    max_drawdown_pct: drawdown * 100,
    sharpe_like: deviation > 0 ? mean / deviation : 0,
    trade_count: returns.length,
    win_rate: returns.length ? returns.filter((value) => value > 0).length / returns.length : 0,
  };
}
