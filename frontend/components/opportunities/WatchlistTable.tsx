"use client";

/**
 * WatchlistTable — V3 watchlist table for the Opportunities page.
 *
 * Columns (per PRD3.md Section 4.3):
 *   Ticker | Current Price | Buy Zone | Ideal Entry | Distance to Zone |
 *   Confidence | 90d Win Rate | Signal Status (BuyNowBadge) | Alert toggle | Last Updated
 *
 * Features:
 *   - Ticker add input at the top (POST /api/watchlist)
 *   - Inline trash-icon Remove button per row (DELETE /api/watchlist/{ticker})
 *   - Alert toggle per row (PATCH /api/watchlist/{ticker}/alert)
 *   - Expandable rows reveal EstimatedEntryPanel
 *   - "Ready only" filter + theme chip filters
 *   - Default sort: STRONG_BUY first, then confidence desc
 */

import { useState, useRef, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Trash2,
  Bell,
  BellOff,
  ChevronDown,
  ChevronRight,
  Plus,
  Loader2,
  Radar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BuyNowBadge } from "./BuyNowBadge";
import { EstimatedEntryPanel } from "./EstimatedEntryPanel";
import { watchlistApi, scannerApi } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";
import type { OpportunityRow } from "@/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface WatchlistTableProps {
  rows: OpportunityRow[];
  isLoading: boolean;
  onRefetch: () => void;
}

export function WatchlistTable({ rows, isLoading, onRefetch }: WatchlistTableProps) {
  const queryClient = useQueryClient();
  const [tickerInput, setTickerInput] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);
    const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Add ticker mutation
  const { mutate: addTicker, isPending: adding } = useMutation({
    mutationFn: (ticker: string) => watchlistApi.add(ticker),
    onSuccess: () => {
      setTickerInput("");
      setAddError(null);
      toast.success("Ticker added. Buy zone calculation started.");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) {
        setAddError("Ticker is already in your watchlist.");
      } else if (err.status === 422) {
        setAddError("Invalid ticker format. Use 1–10 uppercase letters.");
      } else {
        setAddError(getErrorMessage(err, "Failed to add ticker."));
      }
    },
  });

  // Remove ticker mutation
  const { mutate: removeTicker } = useMutation({
    mutationFn: (ticker: string) => watchlistApi.remove(ticker),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to remove ticker."));
    },
  });

  // Alert toggle mutation
  const { mutate: toggleAlert } = useMutation({
    mutationFn: ({ ticker, enabled }: { ticker: string; enabled: boolean }) =>
      watchlistApi.toggleAlert(ticker, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to update alert setting."));
    },
  });

  function handleAddTicker() {
    const ticker = tickerInput.trim().toUpperCase();
    if (!ticker) return;
    setAddError(null);
    addTicker(ticker);
  }

  async function handleRunNow() {
    setScanning(true);
    try {
      const result = await scannerApi.runNow();
      if (result.strong_buy_signals > 0) {
        toast.success(
          `Scan complete — ${result.strong_buy_signals} STRONG BUY signal${result.strong_buy_signals !== 1 ? "s" : ""} found.`,
          { duration: 8000 }
        );
      } else {
        toast.info(`Scan complete — no STRONG BUY signals right now. ${result.tickers_scanned} tickers checked.`);
      }
      onRefetch();
    } catch (err) {
      toast.error(getErrorMessage(err as Error, "Scan failed."));
    } finally {
      setScanning(false);
    }
  }

  // Sort + filter
  const displayed = useMemo(() => {
    let list = [...rows];

    // Ready-only filter
    if (readyOnly) {
      list = list.filter((r) => r.signal_strength === "STRONG_BUY");
    }

    // Sort: STRONG_BUY first, then by backtest_confidence desc
    list.sort((a, b) => {
      const aStrong = a.signal_strength === "STRONG_BUY" ? 1 : 0;
      const bStrong = b.signal_strength === "STRONG_BUY" ? 1 : 0;
      if (aStrong !== bStrong) return bStrong - aStrong;
      return (b.backtest_confidence ?? 0) - (a.backtest_confidence ?? 0);
    });

    return list;
  }, [rows, readyOnly]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Add ticker input */}
      <div className="flex gap-2 items-start">
        <div className="flex-1 max-w-xs">
          <div className="flex gap-1.5">
            <Input
              ref={inputRef}
              value={tickerInput}
              onChange={(e) => {
                setTickerInput(e.target.value.toUpperCase());
                setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTicker();
              }}
              placeholder="Add ticker (e.g. AAPL)"
              className="h-8 text-xs font-mono"
              maxLength={10}
              aria-label="Add ticker to watchlist"
              aria-invalid={!!addError}
              aria-describedby={addError ? "add-ticker-error" : undefined}
            />
            <Button
              size="sm"
              className="h-8 text-xs gap-1 shrink-0"
              disabled={adding || !tickerInput.trim()}
              onClick={handleAddTicker}
            >
              {adding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Add
            </Button>
          </div>
          {addError && (
            <p id="add-ticker-error" className="text-[10px] text-red-400 mt-1">
              {addError}
            </p>
          )}
        </div>

        {/* Scan Now */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 ml-auto"
          disabled={scanning || rows.length === 0}
          onClick={handleRunNow}
        >
          {scanning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radar className="h-3.5 w-3.5" />
          )}
          {scanning ? "Scanning…" : "Scan Now"}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            checked={readyOnly}
            onChange={(e) => setReadyOnly(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-primary"
          />
          <span className="text-muted-foreground">Ready only</span>
        </label>

        <span className="text-[10px] text-muted-foreground ml-auto">
          {displayed.length} ticker{displayed.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <p className="text-sm text-muted-foreground">
            {rows.length === 0
              ? "No tickers in watchlist. Type a ticker above and press Add to get started."
              : "No tickers match the current filters."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className="text-xs">Ticker</TableHead>
                <TableHead className="text-right text-xs">Price</TableHead>
                <TableHead className="text-xs">Buy Zone</TableHead>
                <TableHead className="text-right text-xs">Ideal Entry</TableHead>
                <TableHead className="text-right text-xs">Distance</TableHead>
                <TableHead className="text-xs">Confidence</TableHead>
                <TableHead className="text-xs">90d Win Rate</TableHead>
                <TableHead className="text-xs">Signal</TableHead>
                <TableHead className="text-xs">Alert</TableHead>
                <TableHead className="text-xs">Updated</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((row) => (
                <WatchlistRow
                  key={row.ticker}
                  row={row}
                  isExpanded={expandedTicker === row.ticker}
                  onToggleExpand={() =>
                    setExpandedTicker((prev) =>
                      prev === row.ticker ? null : row.ticker
                    )
                  }
                  onRemove={() => removeTicker(row.ticker)}
                  onToggleAlert={(enabled) =>
                    toggleAlert({ ticker: row.ticker, enabled })
                  }
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Build condition_details array from the flat boolean flags on the row. */
function buildConditionDetails(row: OpportunityRow) {
  if (row.price_in_zone == null) return null;
  return [
    { key: "price_in_zone", pass_: !!row.price_in_zone },
    { key: "above_50d_ma", pass_: !!row.above_50d_ma },
    { key: "above_200d_ma", pass_: !!row.above_200d_ma },
    { key: "rsi_confirms", pass_: !!row.rsi_confirms },
    { key: "volume_confirms", pass_: !!row.volume_confirms },
    { key: "near_support", pass_: !!row.near_support },
    { key: "trend_regime_bullish", pass_: !!row.trend_regime_bullish },
    { key: "not_near_earnings", pass_: !!row.not_near_earnings },
    { key: "no_duplicate_in_cooldown", pass_: !!row.no_duplicate_in_cooldown },
    { key: "backtest_confidence", pass_: (row.backtest_confidence ?? 0) >= 0.65 },
  ];
}

/** Map backend signal_strength to the SignalStatus union the badge expects. */
function toSignalStatus(strength: string | null): import("@/types").SignalStatus | null {
  if (!strength) return null;
  if (strength === "STRONG_BUY") return "STRONG_BUY";
  if (strength === "SUPPRESSED") return "NOT_READY";
  return "WATCHING";
}

// ─── Individual table row ─────────────────────────────────────────────────────

function WatchlistRow({
  row,
  isExpanded,
  onToggleExpand,
  onRemove,
  onToggleAlert,
}: {
  row: OpportunityRow;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onToggleAlert: (enabled: boolean) => void;
}) {
  const isPending = row.signal_strength == null;

  // Distance to zone: positive = price is above zone (red), negative = below (green opportunity)
  const distancePct = row.distance_to_zone_pct ?? 0;
  const distanceColor =
    distancePct <= 0
      ? "text-green-400" // below zone — in or approaching entry area
      : distancePct <= 5
      ? "text-amber-400"
      : "text-muted-foreground";

  const updatedDate = row.last_signal_at
    ? new Date(row.last_signal_at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-secondary/50"
        onClick={onToggleExpand}
      >
        {/* Expand chevron */}
        <TableCell className="w-8 pr-0">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </TableCell>

        {/* Ticker */}
        <TableCell className="font-mono text-xs font-semibold">
          {row.ticker}
          {isPending && (
            <span className="ml-1.5 text-[9px] text-amber-400/70 italic">calculating…</span>
          )}
        </TableCell>

        {/* Current price */}
        <TableCell className="text-right text-xs font-mono">
          {row.current_price != null ? usd.format(row.current_price) : "—"}
        </TableCell>

        {/* Buy zone */}
        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {row.buy_zone_low != null && row.buy_zone_high != null ? (
            <>
              {usd.format(row.buy_zone_low)} – {usd.format(row.buy_zone_high)}
            </>
          ) : (
            <span className="text-muted-foreground/50 italic">—</span>
          )}
        </TableCell>

        {/* Ideal entry */}
        <TableCell className="text-right text-xs font-mono">
          {row.ideal_entry_price != null ? (
            <span className="text-primary font-semibold">
              {usd.format(row.ideal_entry_price)}
            </span>
          ) : (
            <span className="text-muted-foreground/50 italic text-[10px]">—</span>
          )}
        </TableCell>

        {/* Distance */}
        <TableCell className="text-right">
          <span className={cn("text-xs font-mono", distanceColor)}>
            {distancePct >= 0 ? "+" : ""}
            {distancePct.toFixed(1)}%
          </span>
        </TableCell>

        {/* Confidence */}
        <TableCell>
          {row.backtest_confidence != null ? (
            <ConfidenceBadge score={row.backtest_confidence} />
          ) : (
            <span className="text-muted-foreground/50 text-[10px]">—</span>
          )}
        </TableCell>

        {/* 90d win rate */}
        <TableCell className="text-xs font-mono">
          {row.backtest_win_rate_90d != null ? (
            <span
              className={cn(
                row.backtest_win_rate_90d >= 0.65
                  ? "text-green-400"
                  : row.backtest_win_rate_90d >= 0.50
                  ? "text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {(row.backtest_win_rate_90d * 100).toFixed(0)}%
            </span>
          ) : (
            <span className="text-muted-foreground/50">—</span>
          )}
        </TableCell>

        {/* Signal status */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <BuyNowBadge
            signal_status={toSignalStatus(row.signal_strength)}
            condition_details={buildConditionDetails(row)}
          />
        </TableCell>

        {/* Alert toggle */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={`${row.alert_enabled ? "Disable" : "Enable"} alert for ${row.ticker}`}
            onClick={() => onToggleAlert(!row.alert_enabled)}
            className={cn(
              "transition-colors",
              row.alert_enabled
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground/40 hover:text-primary/60"
            )}
          >
            {row.alert_enabled ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
          </button>
        </TableCell>

        {/* Last updated */}
        <TableCell className="text-[10px] text-muted-foreground whitespace-nowrap">
          {updatedDate}
        </TableCell>

        {/* Remove */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label={`Remove ${row.ticker} from watchlist`}
            onClick={onRemove}
            className="text-muted-foreground/40 hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </TableCell>
      </TableRow>

      {/* Expansion row */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={12} className="p-0">
            <div className="px-4 py-3">
              <EstimatedEntryPanel row={row} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (score >= 0.70)
    return (
      <Badge className="text-[10px] py-0 bg-green-500/15 text-green-400 border-green-500/30">
        {pct}%
      </Badge>
    );
  if (score >= 0.55)
    return (
      <Badge variant="secondary" className="text-[10px] py-0">
        {pct}%
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
      {pct}%
    </Badge>
  );
}
