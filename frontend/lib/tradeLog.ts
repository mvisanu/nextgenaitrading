/**
 * Shared trade log utility — writes trade entries to localStorage
 * so they appear on the /trade-log page.
 *
 * Used by:
 *   - /live-trading (on order execution)
 *   - /auto-buy (on order_filled / order_submitted decisions)
 */

import { z } from "zod";
import { readAccountData, writeAccountData, useAccountStorage, type AccountId } from "./account-storage";
import { useAuth } from "./auth-context";
const STORAGE_KEY = "trade-log";

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
  executionMode?: "paper" | "dry-run" | "live";
}

const nullableNumber = z.number().finite().nullable();
export const tradeLogSchema = z.array(z.object({
  id: z.string(), date: z.string(), pair: z.string(), type: z.string(), timeframe: z.string(),
  position: z.enum(["Long", "Short"]), outcome: z.enum(["win", "breakeven", "loss", ""]),
  netPnl: nullableNumber, totalFees: nullableNumber, rFactor: nullableNumber, riskPct: nullableNumber,
  confidence: nullableNumber, rangePct: nullableNumber, limit: nullableNumber, duration: z.string(), preNotes: z.string(),
  source: z.enum(["manual", "live-trading", "auto-buy"]).optional(), amountUsd: nullableNumber.optional(),
  dryRun: z.boolean().optional(), executionMode: z.enum(["paper", "dry-run", "live"]).optional(),
}));
const EMPTY: TradeLogEntry[] = [];
export function useTradeLog() {
  const { user } = useAuth();
  return useAccountStorage(user?.id, STORAGE_KEY, tradeLogSchema, EMPTY);
}
function readLog(accountId: AccountId) { return readAccountData(accountId, STORAGE_KEY, tradeLogSchema, EMPTY); }
function writeLog(accountId: AccountId, entries: TradeLogEntry[]) { writeAccountData(accountId, STORAGE_KEY, tradeLogSchema, entries); }

/**
 * Append a trade to the log from live trading.
 */
export function logLiveTrade(params: {
  accountId: AccountId;
  id?: string;
  symbol: string;
  side: "buy" | "sell";
  amountUsd: number | null;
  dryRun: boolean;
  paper?: boolean;
  closing?: boolean;
  realizedPnl?: number | null;
  timeframe: string;
  mode: string;
  signal?: string | null;
  confirmationCount?: number | null;
}) {
  const entries = [...readLog(params.accountId)];
  if (params.id && entries.some(entry => entry.id === params.id)) return;
  const today = new Date().toISOString().split("T")[0];

  entries.push({
    id: params.id ?? crypto.randomUUID(),
    date: today,
    pair: params.symbol,
    type: params.paper ? "Paper Order" : params.dryRun ? "Dry Run" : "Live Order",
    timeframe: params.timeframe,
    position: params.closing ? (params.side === "buy" ? "Short" : "Long") : (params.side === "buy" ? "Long" : "Short"),
    outcome: params.realizedPnl == null ? "" : params.realizedPnl > 0 ? "win" : params.realizedPnl < 0 ? "loss" : "breakeven",
    netPnl: params.realizedPnl ?? null,
    totalFees: null,
    rFactor: null,
    riskPct: null,
    confidence: null,
    rangePct: null,
    limit: params.amountUsd,
    duration: "",
    preNotes: [
      `${params.paper ? "[PAPER] " : params.dryRun ? "[DRY RUN] " : ""}${params.side.toUpperCase()} via Live Trading`,
      `Strategy: ${params.mode}`,
      params.signal ? `Signal: ${params.signal}` : null,
      params.confirmationCount != null ? `Confirmations: ${params.confirmationCount}/8` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    source: "live-trading",
    amountUsd: params.amountUsd,
    dryRun: params.paper || params.dryRun,
    executionMode: params.paper ? "paper" : params.dryRun ? "dry-run" : "live",
  });

  writeLog(params.accountId, entries);
}

/**
 * Append a trade to the log from auto-buy decisions.
 */
export function logAutoBuyTrade(params: {
  accountId: AccountId;
  id?: string;
  ticker: string;
  state: string;
  dryRun: boolean;
  reasonCodes: string[];
  confidenceScore?: number | null;
  currentPrice?: number | null;
  orderAmount?: number | null;
}) {
  const entries = [...readLog(params.accountId)];
  if (params.id && entries.some(entry => entry.id === params.id)) return;
  const today = new Date().toISOString().split("T")[0];

  entries.push({
    id: params.id ?? crypto.randomUUID(),
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

  writeLog(params.accountId, entries);
}
