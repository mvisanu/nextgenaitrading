/**
 * Shared trade log utility — writes trade entries to localStorage
 * so they appear on the /trade-log page.
 *
 * Used by:
 *   - /live-trading (on order execution)
 *   - /auto-buy (on order_filled / order_submitted decisions)
 */

const STORAGE_KEY = "ngs-trade-log";

export interface TradeLogEntry {
  id: string;
  date: string;
  pair: string;
  type: string;
  timeframe: string;
  position: "Long" | "Short";
  outcome: "win" | "breakeven" | "loss" | "";
  netPnl: number | null;
  totalFees: number | null;
  rFactor: number | null;
  riskPct: number | null;
  confidence: number | null;
  rangePct: number | null;
  limit: number | null;
  duration: string;
  preNotes: string;
  /** Source of this trade entry */
  source?: "manual" | "live-trading" | "auto-buy";
  /** Dollar amount of the order */
  amountUsd?: number | null;
  /** Whether this was a dry-run order */
  dryRun?: boolean;
}

function readLog(): TradeLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLog(entries: TradeLogEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  // Dispatch storage event so the trade-log page picks up the change
  window.dispatchEvent(new Event("storage"));
}

/**
 * Append a trade to the log from live trading.
 */
export function logLiveTrade(params: {
  symbol: string;
  side: "buy" | "sell";
  amountUsd: number | null;
  dryRun: boolean;
  timeframe: string;
  mode: string;
  signal?: string | null;
  confirmationCount?: number | null;
}) {
  const entries = readLog();
  const today = new Date().toISOString().split("T")[0];

  entries.push({
    id: crypto.randomUUID(),
    date: today,
    pair: params.symbol,
    type: params.dryRun ? "Dry Run" : "Live Order",
    timeframe: params.timeframe,
    position: params.side === "buy" ? "Long" : "Short",
    outcome: "",
    netPnl: null,
    totalFees: null,
    rFactor: null,
    riskPct: null,
    confidence: null,
    rangePct: null,
    limit: params.amountUsd,
    duration: "",
    preNotes: [
      `${params.dryRun ? "[DRY RUN] " : ""}${params.side.toUpperCase()} via Live Trading`,
      `Strategy: ${params.mode}`,
      params.signal ? `Signal: ${params.signal}` : null,
      params.confirmationCount != null ? `Confirmations: ${params.confirmationCount}/8` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    source: "live-trading",
    amountUsd: params.amountUsd,
    dryRun: params.dryRun,
  });

  writeLog(entries);
}

/**
 * Append a trade to the log from auto-buy decisions.
 */
export function logAutoBuyTrade(params: {
  ticker: string;
  state: string;
  dryRun: boolean;
  reasonCodes: string[];
  confidenceScore?: number | null;
  currentPrice?: number | null;
  orderAmount?: number | null;
}) {
  const entries = readLog();
  const today = new Date().toISOString().split("T")[0];

  entries.push({
    id: crypto.randomUUID(),
    date: today,
    pair: params.ticker,
    type: params.dryRun ? "Auto-Buy Dry Run" : "Auto-Buy",
    timeframe: "1d",
    position: "Long",
    outcome: "",
    netPnl: null,
    totalFees: null,
    rFactor: null,
    riskPct: null,
    confidence: params.confidenceScore != null ? Math.round(params.confidenceScore * 5) : null,
    rangePct: null,
    limit: params.orderAmount ?? null,
    duration: "",
    preNotes: [
      `${params.dryRun ? "[DRY RUN] " : ""}Auto-Buy: ${params.state.replace(/_/g, " ")}`,
      params.currentPrice != null ? `Price: $${params.currentPrice.toFixed(2)}` : null,
      params.reasonCodes.length > 0
        ? `Checks: ${params.reasonCodes.slice(0, 3).join(", ")}${params.reasonCodes.length > 3 ? ` +${params.reasonCodes.length - 3} more` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
    source: "auto-buy",
    amountUsd: params.orderAmount ?? null,
    dryRun: params.dryRun,
  });

  writeLog(entries);
}
