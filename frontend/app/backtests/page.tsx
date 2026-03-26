"use client";

import React, { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  return (
    <AppShell
      title="Backtests"
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" />
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Backtest Runs ({runs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No backtests yet. Run your first backtest above.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("symbol")}
                  >
                    Symbol <SortIcon field="symbol" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("mode_name")}
                  >
                    Mode <SortIcon field="mode_name" />
                  </TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => toggleSort("created_at")}
                  >
                    Created <SortIcon field="created_at" />
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRuns.map((run) => (
                  <React.Fragment key={run.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleRowClick(run.id)}
                    >
                      <TableCell className="font-mono text-xs">
                        {run.symbol}
                      </TableCell>
                      <TableCell className="text-xs">
                        {getModeLabel(run.mode_name)}
                      </TableCell>
                      <TableCell className="text-xs">{run.timeframe}</TableCell>
                      <TableCell>
                        {run.current_signal ? (
                          <Badge
                            variant={getSignalVariant(run.current_signal)}
                            className="text-xs"
                          >
                            {run.current_signal.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(run.created_at)}
                      </TableCell>
                      <TableCell>
                        {selectedRunId === run.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded detail row */}
                    {selectedRunId === run.id && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-card/50 p-4">
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
        </CardContent>
      </Card>
    </AppShell>
  );
}
