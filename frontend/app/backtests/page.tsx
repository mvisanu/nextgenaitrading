"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { backtestApi } from "@/lib/api";
import { getQueryClient } from "@/lib/queryClient";
import {
  formatDateTime,
  getModeLabel,
  getSignalVariant,
  formatPct,
} from "@/lib/utils";
import type {
  StrategyRun,
  BacktestSummary,
  ChartData,
  BacktestTrade,
  VariantBacktestResult,
} from "@/types";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";

interface RunDetail {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
}

export default function BacktestsPage() {
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<keyof StrategyRun>("created_at");
  const [sortAsc, setSortAsc] = useState(false);

  const {
    data: runs = [],
    isLoading,
  } = useQuery({
    queryKey: ["backtests"],
    queryFn: () => backtestApi.list(50),
  });

  const { mutate: runBacktest, isPending: isRunning } = useMutation({
    mutationFn: backtestApi.run,
    onSuccess: () => {
      getQueryClient().invalidateQueries({ queryKey: ["backtests"] });
      setDialogOpen(false);
      toast.success("Backtest complete");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Backtest failed");
    },
  });

  async function handleRowClick(runId: number) {
    if (selectedRunId === runId) {
      setSelectedRunId(null);
      setRunDetail(null);
      return;
    }
    setSelectedRunId(runId);
    setIsDetailLoading(true);
    try {
      const [raw, trades, chartData, variants] = await Promise.all([
        backtestApi.get(runId),
        backtestApi.trades(runId),
        backtestApi.chartData(runId).catch(() => undefined),
        backtestApi.leaderboard(runId).catch(() => []),
      ]);
      // API returns flat StrategyRunOut; wrap it into BacktestSummary shape
      const flatRun = (raw as any).run ?? raw;
      const totalReturnPct = trades.reduce((s, t) => s + (t.leveraged_return_pct ?? t.return_pct), 0);
      const wins = trades.filter((t) => t.return_pct >= 0).length;
      const avgRet = trades.length > 0 ? totalReturnPct / trades.length : 0;
      const stdDev = trades.length > 1
        ? Math.sqrt(trades.reduce((s, t) => s + Math.pow((t.leveraged_return_pct ?? t.return_pct) - avgRet, 2), 0) / (trades.length - 1))
        : 1;
      const summary: BacktestSummary = {
        run: flatRun,
        total_return_pct: totalReturnPct,
        max_drawdown_pct: trades.length > 0 ? Math.min(...trades.map((t) => t.leveraged_return_pct ?? t.return_pct)) : 0,
        sharpe_like: stdDev > 0 ? avgRet / stdDev : 0,
        trade_count: trades.length,
        win_rate: trades.length > 0 ? wins / trades.length : 0,
      };
      setRunDetail({ summary, chartData, trades, variants });
    } catch (err) {
      toast.error("Failed to load run details");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function toggleSort(field: keyof StrategyRun) {
    if (sortField === field) {
      setSortAsc((v) => !v);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const sortedRuns = [...runs].sort((a, b) => {
    const va = a[sortField];
    const vb = b[sortField];
    if (va === null || vb === null) return 0;
    const cmp = String(va).localeCompare(String(vb), undefined, {
      numeric: true,
    });
    return sortAsc ? cmp : -cmp;
  });

  function SortIcon({ field }: { field: keyof StrategyRun }) {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    );
  }

  const signalClass = (signal: string) => {
    const v = getSignalVariant(signal);
    if (v === "default") return "bg-primary/15 text-primary";
    if (v === "destructive") return "bg-destructive/15 text-destructive";
    return "bg-muted/40 text-muted-foreground";
  };

  return (
    <AppShell
      title="Backtests"
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs gap-1.5 h-8 px-3">
              <Plus className="h-3.5 w-3.5" />
              New Backtest
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Run New Backtest</DialogTitle>
            </DialogHeader>
            <StrategyForm
              mode="conservative"
              onSubmit={(values) => runBacktest(values)}
              isLoading={isRunning}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-surface-low border border-border/10 rounded-sm">
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
            Backtest Runs
          </span>
          <span className="text-[11px] font-bold text-muted-foreground/50 tabular-nums">({runs.length})</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No backtests yet. Run your first backtest above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                  <TableHead
                    className="text-3xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer py-2 px-4"
                    onClick={() => toggleSort("symbol")}
                  >
                    Symbol <SortIcon field="symbol" />
                  </TableHead>
                  <TableHead
                    className="text-3xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer py-2 px-4"
                    onClick={() => toggleSort("mode_name")}
                  >
                    Mode <SortIcon field="mode_name" />
                  </TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">TF</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Signal</TableHead>
                  <TableHead
                    className="text-3xs font-bold uppercase tracking-widest text-muted-foreground cursor-pointer py-2 px-4"
                    onClick={() => toggleSort("created_at")}
                  >
                    Created <SortIcon field="created_at" />
                  </TableHead>
                  <TableHead className="py-2 px-2 w-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRuns.map((run) => (
                  <React.Fragment key={run.id}>
                    <TableRow
                      className="cursor-pointer border-border/10 hover:bg-surface-high/30 transition-colors"
                      onClick={() => handleRowClick(run.id)}
                    >
                      <TableCell className="font-mono text-xs tabular-nums text-foreground py-2.5 px-4">
                        {run.symbol}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-2.5 px-4">
                        {getModeLabel(run.mode_name)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground py-2.5 px-4">{run.timeframe}</TableCell>
                      <TableCell className="py-2.5 px-4">
                        {run.current_signal ? (
                          <span className={`text-3xs font-bold px-2 py-0.5 rounded-sm ${signalClass(run.current_signal)}`}>
                            {run.current_signal.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground py-2.5 px-4">
                        {formatDateTime(run.created_at)}
                      </TableCell>
                      <TableCell className="py-2.5 px-2">
                        {selectedRunId === run.id ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {selectedRunId === run.id && (
                      <TableRow className="border-border/10">
                        <TableCell colSpan={6} className="bg-surface-lowest p-4">
                          {isDetailLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-8 w-full" />
                              ))}
                            </div>
                          ) : runDetail ? (
                            <ResultsPanel
                              summary={runDetail.summary}
                              chartData={runDetail.chartData}
                              trades={runDetail.trades}
                              variants={runDetail.variants}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
