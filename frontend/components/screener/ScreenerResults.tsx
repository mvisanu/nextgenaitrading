"use client";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (opts?.compact && Math.abs(v) >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (opts?.compact && Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (opts?.style === "percent")
    return `${v >= 0 ? "+" : ""}${v.toFixed(opts?.decimals ?? 2)}%`;
  return v.toLocaleString(undefined, {
    minimumFractionDigits: opts?.decimals ?? 2,
    maximumFractionDigits: opts?.decimals ?? 2,
  });
}

function RecBadge({ rec }: { rec?: string }) {
  if (!rec) return null;
  const variant = rec.includes("BUY")
    ? "bull"
    : rec.includes("SELL")
    ? "bear"
    : "secondary";
  return (
    <Badge
      variant={variant as "bull" | "bear" | "secondary"}
      className="text-[10px] px-1.5"
    >
      {rec.replace("_", " ")}
    </Badge>
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
  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Scanning...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No results. Adjust filters and scan again.
          </p>
        </CardContent>
      </Card>
    );
  }

  const showMktCap = universe === "stocks" || universe === "etf";
  const showSector = universe === "stocks";

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Results{total ? ` (${total})` : ""}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {universe.toUpperCase()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="text-xs w-[120px]">Symbol</TableHead>
                <TableHead className="text-xs text-right">Price</TableHead>
                <TableHead className="text-xs text-right">Change %</TableHead>
                <TableHead className="text-xs text-right">Volume</TableHead>
                {showMktCap && (
                  <TableHead className="text-xs text-right">Mkt Cap</TableHead>
                )}
                <TableHead className="text-xs text-right">RSI</TableHead>
                {showSector && (
                  <TableHead className="text-xs">Sector</TableHead>
                )}
                <TableHead className="text-xs text-center">Signal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isSelected = selectedSymbol === row.symbol;
                const isUp = (row.change_pct ?? 0) >= 0;
                return (
                  <TableRow
                    key={row.symbol}
                    onClick={() => onSelect(row)}
                    className={cn(
                      "cursor-pointer transition-colors border-border",
                      isSelected
                        ? "bg-primary/10 border-l-2 border-l-primary"
                        : "hover:bg-secondary/50"
                    )}
                  >
                    <TableCell className="py-2">
                      <div className="flex items-center gap-2">
                        {isUp ? (
                          <TrendingUp className="h-3.5 w-3.5 text-bull shrink-0" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-bear shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-sm">{row.symbol}</div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {row.name}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-mono">
                      {formatNum(row.close)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right text-sm font-mono",
                        isUp ? "text-bull" : "text-bear"
                      )}
                    >
                      {formatNum(row.change_pct, { style: "percent" })}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-mono">
                      {row.volume
                        ? row.volume >= 1e6
                          ? `${(row.volume / 1e6).toFixed(1)}M`
                          : row.volume.toLocaleString()
                        : "\u2014"}
                    </TableCell>
                    {showMktCap && (
                      <TableCell className="text-right text-xs text-muted-foreground font-mono">
                        {formatNum(row.market_cap, { compact: true })}
                      </TableCell>
                    )}
                    <TableCell
                      className={cn(
                        "text-right text-sm font-mono",
                        row.rsi && row.rsi < 30
                          ? "text-bull"
                          : row.rsi && row.rsi > 70
                          ? "text-bear"
                          : ""
                      )}
                    >
                      {formatNum(row.rsi, { decimals: 1 })}
                    </TableCell>
                    {showSector && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.sector ?? "\u2014"}
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <RecBadge rec={row.recommendation} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
