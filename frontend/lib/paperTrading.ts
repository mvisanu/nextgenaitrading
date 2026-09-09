"use client";
import { useCallback } from "react";
import { useAuth } from "./auth-context";
import { readAccountData, writeAccountData, useAccountStorage } from "./account-storage";
import { applyPaperOrder, createPaperPortfolio, paperPortfolioSchema, type PaperOrder } from "./paper-engine";
export type { PaperPortfolio, PaperPosition, PaperTrade } from "./paper-engine";
const EMPTY = createPaperPortfolio();
const KEY = "paper-portfolio";
export function usePaperPortfolio() {
  const { user } = useAuth();
  const [portfolio] = useAccountStorage(user?.id, KEY, paperPortfolioSchema, EMPTY);
  const executePaperOrder = useCallback((params: PaperOrder) => {
    try {
      const result = applyPaperOrder(readAccountData(user?.id, KEY, paperPortfolioSchema, EMPTY), params, crypto.randomUUID(), new Date().toISOString());
      writeAccountData(user?.id, KEY, paperPortfolioSchema, result.portfolio);
      return { success: true as const, trade: result.trade, realizedPnl: result.trade.realizedPnl, action: result.trade.action };
    } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Could not save paper trade" }; }
  }, [user?.id]);
  const resetPortfolio = useCallback((balance = 100_000) => {
    writeAccountData(user?.id, KEY, paperPortfolioSchema, createPaperPortfolio(balance));
  }, [user?.id]);
  const closed = portfolio.trades.filter(t => t.action === "close");
  return { portfolio, executePaperOrder, resetPortfolio, stats: {
    totalRealizedPnl: closed.reduce((sum, t) => sum + (t.realizedPnl ?? 0), 0),
    unrealizedValue: portfolio.positions.reduce((sum, p) => sum + p.quantity * p.avgEntry, 0),
    winRate: closed.length ? 100 * closed.filter(t => (t.realizedPnl ?? 0) > 0).length / closed.length : 0,
    closedTradeCount: closed.length, openPositionCount: portfolio.positions.length,
  } };
}
