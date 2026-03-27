"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { backtestApi } from "@/lib/api";
import { formatDateTime, getModeLabel, formatPct } from "@/lib/utils";
import { ArrowLeft, Trophy } from "lucide-react";
import type { StrategyRun } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function BacktestDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const runId = Number(id);

  const { data: run, isLoading: runLoading } = useQuery({
    queryKey: ["backtests", runId],
    queryFn: () => backtestApi.get(runId) as unknown as Promise<StrategyRun>,
    enabled: !isNaN(runId),
  });

  const { data: chartData } = useQuery({
    queryKey: ["backtests", runId, "chart-data"],
    queryFn: () => backtestApi.chartData(runId),
    enabled: !isNaN(runId),
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["backtests", runId, "trades"],
    queryFn: () => backtestApi.trades(runId),
    enabled: !isNaN(runId),
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["backtests", runId, "leaderboard"],
    queryFn: () => backtestApi.leaderboard(runId),
    enabled: !isNaN(runId),
  });

  const isOptimizer =
    run?.mode_name === "ai-pick" || run?.mode_name === "buy-low-sell-high";

  return (
    <AppShell title="Backtest Detail">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="hover:bg-surface-high/50">
          <Link href="/backtests">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Backtests
          </Link>
        </Button>
      </div>

      {runLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : run ? (
        <div className="space-y-4">
          {/* Run summary */}
          <div className="bg-surface-low border border-border/10 rounded-sm">
            <div className="px-4 py-3 border-b border-border/10">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {getModeLabel(run.mode_name)} — {run.symbol}
              </span>
            </div>
            <div className="px-4 py-3 flex gap-4 flex-wrap text-2xs text-muted-foreground">
              <span>Timeframe: <span className="text-foreground font-mono tabular-nums">{run.timeframe}</span></span>
              <span>Leverage: <span className="text-foreground tabular-nums">{run.leverage}x</span></span>
              {run.current_signal && (
                <span>Signal: <span className="text-foreground">{run.current_signal}</span></span>
              )}
              {run.selected_variant_name && (
                <span>Winner: <span className="text-foreground font-mono">{run.selected_variant_name}</span></span>
              )}
              <span>Created: {formatDateTime(run.created_at)}</span>
            </div>
          </div>

          {/* Equity curve */}
          {chartData && chartData.equity.length > 0 && (
            <div className="bg-surface-low border border-border/10 rounded-sm">
              <div className="px-4 py-3 border-b border-border/10">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Equity Curve</span>
              </div>
              <div className="px-4 py-4" data-testid="equity-curve">
                <EquityCurve equityPoints={chartData.equity} />
              </div>
            </div>
          )}

          {/* Trade list */}
          {trades.length > 0 && (
            <div className="bg-surface-low border border-border/10 rounded-sm">
              <div className="px-4 py-3 border-b border-border/10">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Trades ({trades.length})
                </span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Entry</TableHead>
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Exit</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Entry Price</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Exit Price</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Return</TableHead>
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Exit Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((t) => (
                      <TableRow key={t.id} className="border-border/10 hover:bg-surface-high/30">
                        <TableCell className="text-xs tabular-nums py-2 px-4">{t.entry_time ? formatDateTime(t.entry_time) : "—"}</TableCell>
                        <TableCell className="text-xs tabular-nums py-2 px-4">{t.exit_time ? formatDateTime(t.exit_time) : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-4">{t.entry_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-4">{t.exit_price.toFixed(2)}</TableCell>
                        <TableCell className={`text-right text-xs font-semibold tabular-nums py-2 px-4 ${t.return_pct >= 0 ? "text-primary" : "text-destructive"}`}>
                          {formatPct(t.return_pct)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-2 px-4">{t.exit_reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Leaderboard (optimizer modes only) */}
          {isOptimizer && variants.length > 0 && (
            <div className="bg-surface-low border border-border/10 rounded-sm" data-testid="leaderboard">
              <div className="px-4 py-3 border-b border-border/10">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Variant Leaderboard</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Variant</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Val Score</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Train %</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Val %</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Test %</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Max DD</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Trades</TableHead>
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => (
                      <TableRow key={v.id} className="border-border/10 hover:bg-surface-high/30">
                        <TableCell className="text-xs font-mono tabular-nums py-2 px-4">{v.variant_name}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums py-2 px-4">{v.validation_score.toFixed(3)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums py-2 px-4">{formatPct(v.train_return)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums py-2 px-4">{formatPct(v.validation_return)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums py-2 px-4">{formatPct(v.test_return)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-destructive py-2 px-4">{formatPct(v.max_drawdown)}</TableCell>
                        <TableCell className="text-right text-xs tabular-nums py-2 px-4">{v.trade_count}</TableCell>
                        <TableCell className="py-2 px-4">
                          {v.selected_winner && (
                            <Trophy className="h-3 w-3 text-yellow-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Backtest not found.</p>
      )}
    </AppShell>
  );
}
