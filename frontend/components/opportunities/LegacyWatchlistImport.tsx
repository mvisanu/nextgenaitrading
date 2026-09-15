"use client";

import { Button } from "@/components/ui/button";
import { watchlistApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { flattenWatchlist,useLegacyWatchlist,useWatchlist,watchlistKeys } from "@/lib/watchlist";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function LegacyWatchlistImport() {
  const [legacy] = useLegacyWatchlist();
  const { allItems, isLoading, error } = useWatchlist();
  const { user } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const missing = [...new Set(flattenWatchlist(legacy).map(item => item.symbol.trim().toUpperCase()))]
    .filter(symbol => !allItems.some(item => item.symbol === symbol));
  if (isLoading || error || (!missing.length && !message)) return null;
  async function importList() {
    setBusy(true);
    const failed: string[] = [];
    for (const symbol of missing) {
      try { await watchlistApi.add(symbol); }
      catch (error) { if ((error as { status?: number }).status !== 409) failed.push(symbol); }
    }
    await Promise.all([
      client.invalidateQueries({ queryKey: watchlistKeys.list(user?.id) }),
      client.invalidateQueries({ queryKey: watchlistKeys.signals(user?.id) }),
    ]);
    setMessage(failed.length ? `Could not import ${failed.join(", ")}. Retry to add the remaining symbols.` : "Your browser symbols are now in the shared watchlist.");
    setBusy(false);
  }
  return <div className="space-y-2 rounded-md border border-border p-4 text-sm">
    {missing.length > 0 && <>
      <p>{missing.length} symbols from this browser are missing from your shared watchlist: {missing.join(", ")}.</p>
      <p className="text-muted-foreground">Importing adds them to the scanner with alerts enabled. Your original browser list is preserved.</p>
      <Button variant="outline" disabled={busy} onClick={() => void importList()}>{busy ? "Importing…" : "Import browser watchlist"}</Button>
    </>}
    {message && <p role="status">{message}</p>}
  </div>;
}
