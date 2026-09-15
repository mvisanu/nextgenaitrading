import type { TradeLogEntry } from "./tradeLog";

export type JournalMode = "paper" | "live" | "dry-run" | "unknown";
export const journalModeLabels: Record<JournalMode, string> = { paper: "Paper", live: "Live", "dry-run": "Preview only", unknown: "Manual / unknown" };
export function journalMode(trade: TradeLogEntry): JournalMode {
  if (trade.executionMode) return trade.executionMode;
  if (trade.type === "Paper Order" || trade.preNotes.startsWith("[PAPER]")) return "paper";
  if (trade.dryRun === true) return "dry-run";
  if (trade.dryRun === false && (trade.source === "auto-buy" || trade.source === "live-trading")) return "live";
  return "unknown";
}
export function journalStrategy(trade: TradeLogEntry): string {
  return trade.strategy || trade.preNotes.match(/(?:^|\|)\s*Strategy:\s*([^|]+)/)?.[1].trim()
    || (trade.source === "auto-buy" ? "Auto-buy" : trade.source === "manual" ? trade.type : "") || "Unspecified";
}
export function summarizeJournal(trades: TradeLogEntry[]) {
  const groups = new Map<string, { mode: JournalMode; strategy: string; recorded: number; closed: number; wins: number; pnl: number }>();
  for (const trade of trades) {
    const mode = journalMode(trade), strategy = journalStrategy(trade);
    if (mode === "dry-run") continue;
    const key = JSON.stringify([mode, strategy]);
    const group = groups.get(key) ?? { mode, strategy, recorded: 0, closed: 0, wins: 0, pnl: 0 };
    group.recorded++;
    if (trade.netPnl != null && Number.isFinite(trade.netPnl)) {
      group.closed++; group.pnl += trade.netPnl;
      if (trade.netPnl > 0) group.wins++;
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.mode.localeCompare(b.mode) || a.strategy.localeCompare(b.strategy));
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function journalCSV(trades: TradeLogEntry[]): string {
  const headers = ["Date", "Stock", "Strategy", "Mode", "Type", "Source", "Timeframe", "Side", "Outcome", "Net P&L", "Fees", "R", "Risk %", "Confidence", "Range %", "Amount", "Limit", "Duration", "Notes"];
  return [headers, ...trades.map(t => [t.date, t.pair, journalStrategy(t), journalModeLabels[journalMode(t)], t.type, t.source, t.timeframe, t.position, t.outcome, t.netPnl, t.totalFees, t.rFactor, t.riskPct, t.confidence, t.rangePct, t.amountUsd, t.limit, t.duration, t.preNotes])]
    .map(row => row.map(csvCell).join(",")).join("\r\n");
}
