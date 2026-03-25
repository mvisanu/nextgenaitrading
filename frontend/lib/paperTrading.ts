/**
 * Paper Trading Engine — localStorage-based virtual portfolio
 *
 * Tracks:
 *   - Virtual cash balance (default $100,000)
 *   - Open positions (symbol, qty, avg entry, side)
 *   - Closed trades with realized P&L
 *   - Performance stats (total P&L, win rate, trade count)
 *
 * Used by /live-trading in Paper mode.
 */

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "ngs-paper-portfolio";

export interface PaperPosition {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  avgEntry: number;
  openedAt: string;
}

export interface PaperTrade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  notionalUsd: number;
  timestamp: string;
  /** "open" = opened a position, "close" = closed a position */
  action: "open" | "close";
  realizedPnl: number | null;
}

export interface PaperPortfolio {
  cashBalance: number;
  startingBalance: number;
  positions: PaperPosition[];
  trades: PaperTrade[];
  createdAt: string;
}

function defaultPortfolio(): PaperPortfolio {
  return {
    cashBalance: 100_000,
    startingBalance: 100_000,
    positions: [],
    trades: [],
    createdAt: new Date().toISOString(),
  };
}

function readPortfolio(): PaperPortfolio {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Ensure all fields exist (backward compat)
      return { ...defaultPortfolio(), ...parsed };
    }
  } catch {
    /* ignore */
  }
  return defaultPortfolio();
}

function writePortfolio(p: PaperPortfolio) {
  const json = JSON.stringify(p);
  localStorage.setItem(STORAGE_KEY, json);
  // Update cache so getSnapshot returns the new value immediately
  cachedRaw = json;
  cachedPortfolio = p;
  listeners.forEach((fn) => fn());
}

// ─── useSyncExternalStore for reactive reads ─────────────────────────────────

const listeners = new Set<() => void>();

// Cache the snapshot so getSnapshot returns the same reference unless data changed
let cachedRaw: string | null = null;
let cachedPortfolio: PaperPortfolio = defaultPortfolio();
const SERVER_SNAPSHOT = defaultPortfolio();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): PaperPortfolio {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedPortfolio = raw
      ? { ...defaultPortfolio(), ...JSON.parse(raw) }
      : defaultPortfolio();
  }
  return cachedPortfolio;
}

function getServerSnapshot(): PaperPortfolio {
  return SERVER_SNAPSHOT;
}

export function usePaperPortfolio() {
  const portfolio = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const executePaperOrder = useCallback(
    (params: {
      symbol: string;
      side: "buy" | "sell";
      notionalUsd: number;
      currentPrice: number;
    }) => {
      const p = readPortfolio();
      const quantity = params.notionalUsd / params.currentPrice;
      const now = new Date().toISOString();

      // Check if we have an existing position in this symbol
      const existingIdx = p.positions.findIndex(
        (pos) => pos.symbol === params.symbol
      );

      if (params.side === "buy") {
        if (p.cashBalance < params.notionalUsd) {
          return { success: false, error: "Insufficient paper balance" };
        }

        p.cashBalance -= params.notionalUsd;

        if (existingIdx >= 0 && p.positions[existingIdx].side === "long") {
          // Add to existing long position
          const pos = p.positions[existingIdx];
          const totalQty = pos.quantity + quantity;
          pos.avgEntry =
            (pos.avgEntry * pos.quantity + params.currentPrice * quantity) / totalQty;
          pos.quantity = totalQty;
        } else if (existingIdx >= 0 && p.positions[existingIdx].side === "short") {
          // Close short position
          const pos = p.positions[existingIdx];
          const closeQty = Math.min(pos.quantity, quantity);
          const realizedPnl = closeQty * (pos.avgEntry - params.currentPrice);
          p.cashBalance += realizedPnl; // Add P&L back

          pos.quantity -= closeQty;
          if (pos.quantity <= 0.0001) {
            p.positions.splice(existingIdx, 1);
          }

          p.trades.push({
            id: crypto.randomUUID(),
            symbol: params.symbol,
            side: "buy",
            quantity: closeQty,
            price: params.currentPrice,
            notionalUsd: closeQty * params.currentPrice,
            timestamp: now,
            action: "close",
            realizedPnl,
          });
          writePortfolio(p);
          return { success: true, realizedPnl, action: "close" as const };
        } else {
          // Open new long
          p.positions.push({
            symbol: params.symbol,
            side: "long",
            quantity,
            avgEntry: params.currentPrice,
            openedAt: now,
          });
        }

        p.trades.push({
          id: crypto.randomUUID(),
          symbol: params.symbol,
          side: "buy",
          quantity,
          price: params.currentPrice,
          notionalUsd: params.notionalUsd,
          timestamp: now,
          action: "open",
          realizedPnl: null,
        });
      } else {
        // Sell
        if (existingIdx >= 0 && p.positions[existingIdx].side === "long") {
          // Close long position
          const pos = p.positions[existingIdx];
          const closeQty = Math.min(pos.quantity, quantity);
          const realizedPnl = closeQty * (params.currentPrice - pos.avgEntry);
          p.cashBalance += closeQty * params.currentPrice; // Return cash

          pos.quantity -= closeQty;
          if (pos.quantity <= 0.0001) {
            p.positions.splice(existingIdx, 1);
          }

          p.trades.push({
            id: crypto.randomUUID(),
            symbol: params.symbol,
            side: "sell",
            quantity: closeQty,
            price: params.currentPrice,
            notionalUsd: closeQty * params.currentPrice,
            timestamp: now,
            action: "close",
            realizedPnl,
          });
          writePortfolio(p);
          return { success: true, realizedPnl, action: "close" as const };
        } else {
          // Open new short (or add to existing short)
          if (p.cashBalance < params.notionalUsd) {
            return { success: false, error: "Insufficient paper balance" };
          }
          p.cashBalance -= params.notionalUsd;

          if (existingIdx >= 0 && p.positions[existingIdx].side === "short") {
            const pos = p.positions[existingIdx];
            const totalQty = pos.quantity + quantity;
            pos.avgEntry =
              (pos.avgEntry * pos.quantity + params.currentPrice * quantity) / totalQty;
            pos.quantity = totalQty;
          } else {
            p.positions.push({
              symbol: params.symbol,
              side: "short",
              quantity,
              avgEntry: params.currentPrice,
              openedAt: now,
            });
          }

          p.trades.push({
            id: crypto.randomUUID(),
            symbol: params.symbol,
            side: "sell",
            quantity,
            price: params.currentPrice,
            notionalUsd: params.notionalUsd,
            timestamp: now,
            action: "open",
            realizedPnl: null,
          });
        }
      }

      writePortfolio(p);
      return { success: true, action: "open" as const };
    },
    []
  );

  const resetPortfolio = useCallback((startingBalance = 100_000) => {
    writePortfolio({ ...defaultPortfolio(), startingBalance, cashBalance: startingBalance });
  }, []);

  // Computed stats
  const closedTrades = portfolio.trades.filter((t) => t.action === "close");
  const totalRealizedPnl = closedTrades.reduce(
    (s, t) => s + (t.realizedPnl ?? 0),
    0
  );
  const wins = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  return {
    portfolio,
    executePaperOrder,
    resetPortfolio,
    stats: {
      totalRealizedPnl,
      unrealizedValue: portfolio.positions.reduce(
        (s, p) => s + p.quantity * p.avgEntry,
        0
      ),
      winRate,
      closedTradeCount: closedTrades.length,
      openPositionCount: portfolio.positions.length,
    },
  };
}
