"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenerRow, AssetUniverse } from "@/types";

interface ScreenerResultsProps {
  rows: ScreenerRow[];
  selectedSymbol: string | null;
  onSelect: (row: ScreenerRow) => void;
  universe: AssetUniverse;
  isLoading?: boolean;
  total?: number;
}

function formatNum(
  v: number | undefined | null,
  opts?: { style?: string; decimals?: number; compact?: boolean }
) {
  if (v === undefined || v === null) return "\u2014";
  if (opts?.compact && Math.abs(v) >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (opts?.compact && Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (opts?.compact && Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (opts?.style === "percent")
    return `${v >= 0 ? "+" : ""}${v.toFixed(opts?.decimals ?? 2)}%`;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  });
}

function formatVolume(v?: number | null): string {
  if (!v) return "\u2014";
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

/** Sovereign Terminal rating badge */
function RatingBadge({ rec }: { rec?: string }) {
  if (!rec) return null;
  const label = rec.replace("_", " ");
  const isStrongBuy = rec === "STRONG_BUY";
  const isBuy = rec === "BUY";
  const isSell = rec === "SELL" || rec === "STRONG_SELL";

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-3xs font-black uppercase tracking-widest",
        isStrongBuy || isBuy
          ? "bg-primary/20 text-primary border border-primary/20"
          : isSell
          ? "bg-destructive/20 text-destructive border border-destructive/20"
          : "bg-surface-high text-muted-foreground border border-white/5"
      )}
    >
      {label}
    </span>
  );
}

/** Mini SVG sparkline — generates a simple path from change_pct sign */
function Sparkline({ isUp }: { isUp: boolean }) {
  const color = isUp ? "#44dfa3" : "#ff716a";
  const path = isUp
    ? "M0,28 L20,25 L40,22 L60,14 L80,8 L100,2"
    : "M0,2 L20,8 L40,14 L60,20 L80,25 L100,28";
  return (
    <svg
      className="inline-block w-16 h-7"
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ScreenerResults({
  rows,
  selectedSymbol,
  onSelect,
  universe,
  isLoading,
  total,
}: ScreenerResultsProps) {
  const showMktCap = universe === "stocks" || universe === "etf";
  const showSector = universe === "stocks";

  if (isLoading) {
    return (
      <div
        data-testid="screener-results"
        className="bg-surface-low border border-white/5 rounded-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-lowest/60">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
            Scanning market...
          </span>
        </div>
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-surface-high/50" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        data-testid="screener-results"
        className="bg-surface-low border border-white/5 rounded-lg"
      >
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No results. Adjust filters and scan again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="screener-results"
      className="bg-surface-lowest border border-white/5 rounded-lg overflow-hidden"
    >
      {/* Table header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-low/80">
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          Results{total ? ` — ${total.toLocaleString()} symbols` : ""}
        </span>
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          {universe.toUpperCase()}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-low border-b border-white/5">
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest w-36">
                Symbol
              </th>
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-right">
                Price
              </th>
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-right">
                Change %
              </th>
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-center hidden sm:table-cell">
                Trend
              </th>
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-right hidden md:table-cell">
                Volume
              </th>
              {showMktCap && (
                <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-right hidden lg:table-cell">
                  Mkt Cap
                </th>
              )}
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest text-right hidden md:table-cell">
                RSI
              </th>
              {showSector && (
                <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest hidden xl:table-cell">
                  Sector
                </th>
              )}
              <th className="px-4 py-3 text-3xs font-bold text-muted-foreground uppercase tracking-widest">
                Rating
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => {
              const isSelected = selectedSymbol === row.symbol;
              const isUp = (row.change_pct ?? 0) >= 0;

              return (
                <tr
                  key={row.symbol}
                  onClick={() => onSelect(row)}
                  className={cn(
                    "cursor-pointer transition-colors group",
                    isSelected
                      ? "bg-primary/10 border-l-2 border-l-primary"
                      : "hover:bg-surface-high/40"
                  )}
                >
                  {/* Symbol + Name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isUp ? (
                        <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5 text-destructive shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-foreground tracking-tight">
                          {row.symbol}
                        </div>
                        <div className="text-3xs text-muted-foreground truncate max-w-[100px]">
                          {row.name}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-right font-bold text-sm tabular-nums">
                    {formatNum(row.close)}
                  </td>

                  {/* Change % */}
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-bold text-sm tabular-nums",
                      isUp ? "text-primary" : "text-destructive"
                    )}
                  >
                    {formatNum(row.change_pct, { style: "percent" })}
                  </td>

                  {/* Sparkline trend */}
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    <Sparkline isUp={isUp} />
                  </td>

                  {/* Volume */}
                  <td className="px-4 py-3 text-right text-2xs text-muted-foreground tabular-nums hidden md:table-cell">
                    {formatVolume(row.volume)}
                  </td>

                  {/* Market Cap */}
                  {showMktCap && (
                    <td className="px-4 py-3 text-right text-2xs text-muted-foreground tabular-nums hidden lg:table-cell">
                      {formatNum(row.market_cap, { compact: true })}
                    </td>
                  )}

                  {/* RSI */}
                  <td
                    className={cn(
                      "px-4 py-3 text-right text-sm tabular-nums hidden md:table-cell",
                      row.rsi && row.rsi < 30
                        ? "text-primary"
                        : row.rsi && row.rsi > 70
                        ? "text-destructive"
                        : "text-muted-foreground"
                    )}
                  >
                    {formatNum(row.rsi, { decimals: 1 })}
                  </td>

                  {/* Sector */}
                  {showSector && (
                    <td className="px-4 py-3 text-2xs text-muted-foreground hidden xl:table-cell">
                      {row.sector ?? "\u2014"}
                    </td>
                  )}

                  {/* Rating badge */}
                  <td className="px-4 py-3">
                    <RatingBadge rec={row.recommendation} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer status */}
      {total && (
        <div className="px-4 py-2.5 border-t border-white/5 bg-surface-low/60 flex items-center justify-between">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
            Showing {rows.length} of {total.toLocaleString()} symbols
          </span>
        </div>
      )}
    </div>
  );
}
