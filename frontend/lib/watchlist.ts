"use client";

import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useCallback,useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAccountStorage } from "./account-storage";
import { watchlistApi } from "./api";
import { useAuth } from "./auth-context";
import { getErrorMessage } from "./utils";

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
export const watchlistKeys = {
  list: (id: string | number | undefined) => ["account", id, "watchlist"] as const,
  signals: (id: string | number | undefined) => ["account", id, "opportunities"] as const,
};
const EMPTY_WATCHLIST: WatchlistData = { indices: [], stocks: [], crypto: [], custom: [] };

export function useWatchlist() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({ queryKey: watchlistKeys.list(user?.id), queryFn: watchlistApi.list, enabled: !!user, refetchInterval: 60_000 });
  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: watchlistKeys.list(user?.id) }),
      client.invalidateQueries({ queryKey: watchlistKeys.signals(user?.id) }),
    ]);
  }, [client, user?.id]);
  const { mutate, isPending } = useMutation({
    mutationFn: async ({ symbol, remove }: { symbol: string; remove?: boolean }) => {
      if (!user) throw new Error("Sign in to edit your watchlist");
      const normalized = symbol.trim().toUpperCase();
      if (!/^[A-Z0-9^][A-Z0-9.^/-]{0,19}$/.test(normalized)) throw new Error("Enter a valid symbol, such as AAPL or BRK.B");
      try {
        if (remove) await watchlistApi.remove(normalized);
        else await watchlistApi.add(normalized);
      } catch (error) {
        // Repeating an already completed add/remove is safe.
        const status = (error as { status?: number }).status;
        if (!(remove ? status === 404 : status === 409)) throw error;
      }
    },
    onSuccess: refresh,
    onError: (error) => toast.error(getErrorMessage(error, "Watchlist could not be saved. Try again.")),
  });
  const watchlist = useMemo(() => {
    const next: WatchlistData = { indices: [], stocks: [], crypto: [], custom: [] };
    for (const row of query.data ?? []) {
      const category = row.ticker.startsWith("^") ? "indices" : /[-/]USD[T]?$/.test(row.ticker) ? "crypto" : "stocks";
      next[category].push({ symbol: row.ticker, name: row.ticker, price: 0, change: 0, changePct: 0, color: "#2962ff" });
    }
    return next;
  }, [query.data]);
  const allItems = useMemo(() => flattenWatchlist(watchlist), [watchlist]);
  const addToWatchlist = useCallback((_category: WatchlistCategory, symbol: string) => mutate({ symbol }), [mutate]);
  const removeFromWatchlist = useCallback((symbol: string) => mutate({ symbol, remove: true }), [mutate]);
  return { watchlist, allItems, addToWatchlist, removeFromWatchlist,
    isInWatchlist: (symbol: string) => allItems.some(item => item.symbol === symbol),
    isLoading: query.isLoading, error: query.error, refetch: query.refetch,
    isSaving: isPending,
  };
}

/** The former device list is kept intact until the user explicitly imports it. */
export function useLegacyWatchlist() {
  const { user } = useAuth();
  return useAccountStorage(user?.id, "watchlist", watchlistSchema, EMPTY_WATCHLIST);
}

export function flattenWatchlist(data: WatchlistData): WatchlistItem[] {
  return [...data.indices, ...data.stocks, ...data.crypto, ...data.custom];
}
