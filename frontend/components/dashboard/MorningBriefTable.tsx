"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { MorningBriefRow } from "@/types";

// ── Bias badge ────────────────────────────────────────────────────────────────
function BiasBadge({ bias }: { bias: string }) {
  const cls =
    bias === "Bullish"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : bias === "Bearish"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-gray-500/20 text-gray-400 border-gray-500/30";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {bias}
    </span>
  );
}

// ── Price vs EMA 200 ──────────────────────────────────────────────────────────
function PveCell({ row }: { row: MorningBriefRow }) {
  const colour =
    row.price_vs_ema200 === "Above"
      ? "text-emerald-400"
      : row.price_vs_ema200 === "Below"
      ? "text-red-400"
      : "text-yellow-400";
  const pct =
    row.price !== null && row.ema200 !== null && row.ema200 !== 0
      ? (((row.price - row.ema200) / row.ema200) * 100).toFixed(1) + "%"
      : null;
  return (
    <div>
      <span className={`font-medium ${colour}`}>{row.price_vs_ema200}</span>
      {pct && <div className="text-xs text-muted-foreground mt-0.5">{pct}</div>}
    </div>
  );
}

// ── RSI ───────────────────────────────────────────────────────────────────────
function RsiCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">N/A</span>;
  const colour = value >= 70 ? "text-red-400" : value <= 30 ? "text-emerald-400" : "";
  return <span className={colour}>{value.toFixed(1)}</span>;
}

// ── MACD ──────────────────────────────────────────────────────────────────────
function MacdCell({ bias }: { bias: string }) {
  const colour =
    bias === "Bullish" ? "text-emerald-400" : bias === "Bearish" ? "text-red-400" : "text-muted-foreground";
  return <span className={colour}>{bias}</span>;
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface MorningBriefTableProps {
  rows: MorningBriefRow[] | undefined;
  isLoading: boolean;
}

export function MorningBriefTable({ rows, isLoading }: MorningBriefTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Bias</TableHead>
          <TableHead>Price vs EMA 200</TableHead>
          <TableHead>RSI</TableHead>
          <TableHead>MACD</TableHead>
          <TableHead>Signal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          rows?.map((row) => (
            <TableRow key={row.symbol}>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">{row.symbol}</div>
              </TableCell>
              <TableCell><BiasBadge bias={row.bias} /></TableCell>
              <TableCell><PveCell row={row} /></TableCell>
              <TableCell><RsiCell value={row.rsi} /></TableCell>
              <TableCell><MacdCell bias={row.macd_bias} /></TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                {row.signal}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
