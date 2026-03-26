"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        <Button variant="ghost" size="sm" asChild>
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
        <div className="space-y-6">
          {/* Run summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {getModeLabel(run.mode_name)} — {run.symbol}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1 text-muted-foreground">
              <div className="flex gap-4 flex-wrap">
                <span>Timeframe: <span className="text-foreground font-mono">{run.timeframe}</span></span>
                <span>Leverage: <span className="text-foreground">{run.leverage}x</span></span>
                {run.current_signal && (
                  <span>Signal: <span className="text-foreground">{run.current_signal}</span></span>
                )}
                {run.selected_variant_name && (
                  <span>Winner: <span className="text-foreground font-mono">{run.selected_variant_name}</span></span>
                )}
                <span>Created: {formatDateTime(run.created_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Equity curve */}
          {chartData && chartData.equity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent data-testid="equity-curve">
                <EquityCurve equityPoints={chartData.equity} />
              </CardContent>
            </Card>
          )}

          {/* Trade list */}
          {trades.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Trades ({trades.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry</TableHead>
                      <TableHead>Exit</TableHead>
                      <TableHead className="text-right">Entry Price</TableHead>
                      <TableHead className="text-right">Exit Price</TableHead>
                      <TableHead className="text-right">Return</TableHead>
                      <TableHead>Exit Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{t.entry_time ? formatDateTime(t.entry_time) : "—"}</TableCell>
                        <TableCell className="text-xs">{t.exit_time ? formatDateTime(t.exit_time) : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{t.entry_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs font-mono">{t.exit_price.toFixed(2)}</TableCell>
                        <TableCell className={`text-right text-xs font-semibold ${t.return_pct >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatPct(t.return_pct)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{t.exit_reason ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard (optimizer modes only) */}
          {isOptimizer && variants.length > 0 && (
            <Card data-testid="leaderboard">
              <CardHeader>
                <CardTitle className="text-sm">Variant Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variant</TableHead>
                      <TableHead className="text-right">Val Score</TableHead>
                      <TableHead className="text-right">Train %</TableHead>
                      <TableHead className="text-right">Val %</TableHead>
                      <TableHead className="text-right">Test %</TableHead>
                      <TableHead className="text-right">Max DD</TableHead>
                      <TableHead className="text-right">Trades</TableHead>
                      <TableHead>Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs font-mono">{v.variant_name}</TableCell>
                        <TableCell className="text-right text-xs">{v.validation_score.toFixed(3)}</TableCell>
                        <TableCell className="text-right text-xs">{formatPct(v.train_return)}</TableCell>
                        <TableCell className="text-right text-xs">{formatPct(v.validation_return)}</TableCell>
                        <TableCell className="text-right text-xs">{formatPct(v.test_return)}</TableCell>
                        <TableCell className="text-right text-xs text-red-400">{formatPct(v.max_drawdown)}</TableCell>
                        <TableCell className="text-right text-xs">{v.trade_count}</TableCell>
                        <TableCell>
                          {v.selected_winner && (
                            <Trophy className="h-3 w-3 text-yellow-400" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Backtest not found.</p>
      )}
    </AppShell>
  );
}
