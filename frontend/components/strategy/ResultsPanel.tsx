"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PriceChart } from "@/components/charts/PriceChart";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { OptimizationScatter } from "@/components/charts/OptimizationScatter";
import type {
  BacktestSummary,
  ChartData,
  BacktestTrade,
  VariantBacktestResult,
} from "@/types";
import {
  formatPct,
  formatCurrency,
  formatDateTime,
  getRegimeVariant,
  getSignalVariant,
} from "@/lib/utils";
import { ExternalLink, Trophy } from "lucide-react";

interface ResultsPanelProps {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades?: BacktestTrade[];
  variants?: VariantBacktestResult[];
  artifactId?: number;
}

export function ResultsPanel({
  summary,
  chartData,
  trades = [],
  variants = [],
  artifactId,
}: ResultsPanelProps) {
  const { run } = summary;
  const isOptimizer =
    run.mode_name === "ai-pick" || run.mode_name === "buy-low-sell-high";

  return (
    <div className="space-y-6 mt-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Total Return"
          value={formatPct(summary.total_return_pct)}
          positive={summary.total_return_pct >= 0}
        />
        <KpiCard
          label="Max Drawdown"
          value={formatPct(summary.max_drawdown_pct)}
          positive={false}
        />
        <KpiCard
          label="Sharpe-Like"
          value={summary.sharpe_like.toFixed(2)}
          positive={summary.sharpe_like >= 1}
        />
        <KpiCard
          label="Win Rate"
          value={`${(summary.win_rate * 100).toFixed(1)}%`}
          positive={summary.win_rate >= 0.5}
        />
      </div>

      {/* Signal badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {run.current_regime && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Regime:</span>
            <Badge variant={getRegimeVariant(run.current_regime)}>
              {run.current_regime}
            </Badge>
          </div>
        )}
        {run.current_signal && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Signal:</span>
            <Badge variant={getSignalVariant(run.current_signal)}>
              {run.current_signal.toUpperCase()}
            </Badge>
          </div>
        )}
        {run.confirmation_count !== null && (
          <span className="text-sm text-muted-foreground">
            {run.confirmation_count} confirmations
          </span>
        )}
      </div>

      {/* Price Chart */}
      {chartData && chartData.candles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Price Chart — {run.symbol}</CardTitle>
          </CardHeader>
          <CardContent>
            <PriceChart
              data={chartData.candles}
              signals={chartData.signals}
              symbol={run.symbol}
            />
          </CardContent>
        </Card>
      )}

      {/* Equity Curve */}
      {(trades.length > 0 || (chartData?.equity?.length ?? 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            <EquityCurve
              trades={trades}
              equityPoints={chartData?.equity}
              showPnlBars
            />
          </CardContent>
        </Card>
      )}

      {/* Variant Leaderboard (AI Pick / BLSH) */}
      {isOptimizer && variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Variant Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Val. Return</TableHead>
                    <TableHead className="text-right">Drawdown</TableHead>
                    <TableHead className="text-right">Sharpe</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variants
                    .sort((a, b) => b.validation_score - a.validation_score)
                    .map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {v.selected_winner && (
                              <Trophy className="h-3 w-3 text-yellow-400" />
                            )}
                            <span className="font-mono text-xs">
                              {v.variant_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <span
                            className={
                              v.validation_return >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }
                          >
                            {formatPct(v.validation_return)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-red-400">
                          {formatPct(v.max_drawdown)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {v.sharpe_like.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {v.trade_count}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <OptimizationScatter variants={variants} />
          </CardContent>
        </Card>
      )}

      {/* Trade Table */}
      {trades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Trades ({trades.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead className="text-right">Entry $</TableHead>
                    <TableHead className="text-right">Exit $</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                    <TableHead>Exit Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trades.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        {formatDateTime(t.entry_time)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(t.exit_time)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(t.entry_price)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(t.exit_price)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span
                          className={
                            t.return_pct >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {formatPct(t.return_pct)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        <span
                          className={
                            t.pnl >= 0 ? "text-green-400" : "text-red-400"
                          }
                        >
                          {formatCurrency(t.pnl)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.exit_reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Artifact link */}
      {artifactId && (
        <div className="flex items-center gap-2 text-sm">
          <ExternalLink className="h-4 w-4 text-primary" />
          <Link
            href={`/artifacts?highlight=${artifactId}`}
            className="text-primary hover:underline"
          >
            View generated Pine Script artifact
          </Link>
        </div>
      )}
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  positive: boolean;
}

function KpiCard({ label, value, positive }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-lg font-semibold ${
            positive ? "text-green-400" : "text-red-400"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
