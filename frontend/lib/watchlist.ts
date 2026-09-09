"use client";

import { useCallback, useMemo } from "react";
import { z } from "zod";
import { useAuth } from "./auth-context";
import { useAccountStorage } from "./account-storage";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  color: string;
}

export type WatchlistCategory = "indices" | "stocks" | "crypto" | "custom";

export type WatchlistData = Record<WatchlistCategory, WatchlistItem[]>;

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_WATCHLIST: WatchlistData = {
  indices: [],
  stocks: [
    { symbol: "AAPL", name: "Apple", price: 0, change: 0, changePct: 0, color: "#26a69a" },
    { symbol: "MSFT", name: "Microsoft", price: 0, change: 0, changePct: 0, color: "#26a69a" },
    { symbol: "GOOGL", name: "Alphabet", price: 0, change: 0, changePct: 0, color: "#26a69a" },
    { symbol: "AMZN", name: "Amazon", price: 0, change: 0, changePct: 0, color: "#26a69a" },
  ],
  crypto: [],
  custom: [],
};

const itemSchema = z.object({ symbol: z.string().min(1), name: z.string(), price: z.number().finite(), change: z.number().finite(), changePct: z.number().finite(), color: z.string() }).transform(item => ({ ...item, price: 0, change: 0, changePct: 0 }));
export const watchlistSchema = z.object({ indices: z.array(itemSchema), stocks: z.array(itemSchema), crypto: z.array(itemSchema), custom: z.array(itemSchema) });
export function useWatchlist() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useAccountStorage(user?.id, "watchlist", watchlistSchema, DEFAULT_WATCHLIST);
  const updateWatchlist = setWatchlist;

  const addToWatchlist = useCallback((category: WatchlistCategory, sym: string, name?: string) => {
    setWatchlist((prev) => {
      const existing = flattenWatchlist(prev);
      if (existing.some((i) => i.symbol === sym)) return prev;
      const newItem: WatchlistItem = {
        symbol: sym,
        name: name ?? sym,
        price: 0,
        change: 0,
        changePct: 0,
        color: "#2962ff",
      };
      const next = { ...prev, [category]: [...prev[category], newItem] };
      return next;
    });
  }, [setWatchlist]);

  const removeFromWatchlist = useCallback((sym: string) => {
    setWatchlist((prev) => {
      const next: WatchlistData = {
        indices: prev.indices.filter((i) => i.symbol !== sym),
        stocks: prev.stocks.filter((i) => i.symbol !== sym),
        crypto: prev.crypto.filter((i) => i.symbol !== sym),
        custom: prev.custom.filter((i) => i.symbol !== sym),
      };
      return next;
    });
  }, [setWatchlist]);

  const editWatchlistItem = useCallback((sym: string, updates: Partial<Pick<WatchlistItem, "name" | "symbol">>) => {
    setWatchlist((prev) => {
      const next: WatchlistData = { ...prev };
      for (const cat of ["indices", "stocks", "crypto", "custom"] as WatchlistCategory[]) {
        next[cat] = prev[cat].map((item) =>
          item.symbol === sym ? { ...item, ...updates } : item
        );
      }
      return next;
    });
  }, [setWatchlist]);

  const allItems = useMemo(() => flattenWatchlist(watchlist), [watchlist]);

  const isInWatchlist = useCallback(
    (sym: string) => allItems.some((i) => i.symbol === sym),
    [allItems]
  );

  return {
    watchlist,
    allItems,
    updateWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    editWatchlistItem,
    isInWatchlist,
  };
}

export function flattenWatchlist(data: WatchlistData): WatchlistItem[] {
  return [...data.indices, ...data.stocks, ...data.crypto, ...data.custom];
}
