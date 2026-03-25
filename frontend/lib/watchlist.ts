"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

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
  indices: [
    { symbol: "SPX",   name: "S&P 500",      price: 6506.49,  change: -99.99,  changePct: -1.51,  color: "#ef5350" },
    { symbol: "NDQ",   name: "NASDAQ",        price: 23898.15, change: -457.12, changePct: -1.88,  color: "#ef5350" },
    { symbol: "DJI",   name: "Dow Jones",     price: 45577.47, change: -443.96, changePct: -0.96,  color: "#ef5350" },
    { symbol: "VIX",   name: "VIX",           price: 26.78,    change: 2.72,    changePct: 11.31,  color: "#26a69a" },
    { symbol: "DXY",   name: "Dollar Index",  price: 99.503,   change: 0.341,   changePct: 0.34,   color: "#26a69a" },
  ],
  stocks: [
    { symbol: "AAPL",  name: "Apple",     price: 247.99, change: -0.97,  changePct: -0.39, color: "#000" },
    { symbol: "TSLA",  name: "Tesla",     price: 367.96, change: -12.34, changePct: -3.24, color: "#ef5350" },
    { symbol: "NFLX",  name: "Netflix",   price: 91.82,  change: 0.08,   changePct: 0.09,  color: "#ef5350" },
    { symbol: "GOOGL", name: "Alphabet",  price: 193.42, change: -2.15,  changePct: -1.10, color: "#4285f4" },
    { symbol: "AMZN",  name: "Amazon",    price: 214.20, change: 1.38,   changePct: 0.65,  color: "#ff9900" },
    { symbol: "MSFT",  name: "Microsoft", price: 454.27, change: -3.82,  changePct: -0.83, color: "#00a4ef" },
  ],
  crypto: [
    { symbol: "BTC-USD", name: "Bitcoin",  price: 84150.00, change: 1250.00, changePct: 1.51,  color: "#f7931a" },
    { symbol: "ETH-USD", name: "Ethereum", price: 1842.30,  change: -42.50,  changePct: -2.25, color: "#627eea" },
    { symbol: "SOL-USD", name: "Solana",   price: 135.20,   change: 5.30,    changePct: 4.08,  color: "#9945ff" },
    { symbol: "ADA-USD", name: "Cardano",  price: 0.745,    change: -0.012,  changePct: -1.59, color: "#0033ad" },
  ],
  custom: [],
};

const STORAGE_KEY = "ngs-watchlist";

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadWatchlist(): WatchlistData {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_WATCHLIST;
}

function saveWatchlist(data: WatchlistData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Custom event for cross-component sync ───────────────────────────────────

const WATCHLIST_CHANGE_EVENT = "ngs-watchlist-change";

function dispatchWatchlistChange() {
  window.dispatchEvent(new CustomEvent(WATCHLIST_CHANGE_EVENT));
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistData>(DEFAULT_WATCHLIST);

  // Load from localStorage on mount
  useEffect(() => {
    setWatchlist(loadWatchlist());
  }, []);

  // Listen for changes from other components/pages using the same hook
  useEffect(() => {
    function onStorageChange() {
      setWatchlist(loadWatchlist());
    }
    window.addEventListener(WATCHLIST_CHANGE_EVENT, onStorageChange);
    window.addEventListener("storage", onStorageChange);
    return () => {
      window.removeEventListener(WATCHLIST_CHANGE_EVENT, onStorageChange);
      window.removeEventListener("storage", onStorageChange);
    };
  }, []);

  const updateWatchlist = useCallback((next: WatchlistData) => {
    setWatchlist(next);
    saveWatchlist(next);
    dispatchWatchlistChange();
  }, []);

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
      saveWatchlist(next);
      dispatchWatchlistChange();
      return next;
    });
  }, []);

  const removeFromWatchlist = useCallback((sym: string) => {
    setWatchlist((prev) => {
      const next: WatchlistData = {
        indices: prev.indices.filter((i) => i.symbol !== sym),
        stocks: prev.stocks.filter((i) => i.symbol !== sym),
        crypto: prev.crypto.filter((i) => i.symbol !== sym),
        custom: prev.custom.filter((i) => i.symbol !== sym),
      };
      saveWatchlist(next);
      dispatchWatchlistChange();
      return next;
    });
  }, []);

  const editWatchlistItem = useCallback((sym: string, updates: Partial<Pick<WatchlistItem, "name" | "symbol">>) => {
    setWatchlist((prev) => {
      const next: WatchlistData = { ...prev };
      for (const cat of ["indices", "stocks", "crypto", "custom"] as WatchlistCategory[]) {
        next[cat] = prev[cat].map((item) =>
          item.symbol === sym ? { ...item, ...updates } : item
        );
      }
      saveWatchlist(next);
      dispatchWatchlistChange();
      return next;
    });
  }, []);

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
