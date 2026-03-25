"use client";

import React from "react";
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
import {
  ExternalLink,
  Trophy,
  TrendingUp,
  TrendingDown,
  ArrowUpCircle,
  ArrowDownCircle,
  DollarSign,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { RiskCalculator } from "./RiskCalculator";

interface ResultsPanelProps {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades?: BacktestTrade[];
  variants?: VariantBacktestResult[];
  artifactId?: number;
  investmentAmount?: number;
}

export function ResultsPanel({
  summary,
  chartData,
  trades = [],
  variants = [],
  artifactId,
  investmentAmount,
}: ResultsPanelProps) {
  // summary.run may be undefined when the API returns a flat StrategyRunOut
  // (e.g. from GET /backtests/:id). In that case, treat summary itself as the run.
  const run = summary.run ?? (summary as unknown as BacktestSummary["run"]);
  if (!run?.mode_name) return null;

  const isOptimizer =
    run.mode_name === "ai-pick" || run.mode_name === "buy-low-sell-high";

  // Compute dollar-based results from trades
  const inv = investmentAmount ?? 10000;
  let balance = inv;
  const tradeActions = trades.map((t) => {
    const returnPct = t.leveraged_return_pct ?? t.return_pct;
    const dollarPnl = balance * (returnPct / 100);
    const balanceBefore = balance;
    balance += dollarPnl;
    // R-unit: price move relative to 1 unit of risk (entry - stop approximation)
    const priceMove = t.exit_price - t.entry_price;
    // Approximate 1R as the avg losing trade move, or 2% of entry as fallback
    return {
      ...t,
      balanceBefore,
      balanceAfter: balance,
      dollarPnl,
      shares: balanceBefore / t.entry_price,
      priceMove,
    };
  });

  // Compute R-unit baseline: average absolute loss per share (defines 1R)
  const losingTrades = tradeActions.filter((t) => t.dollarPnl < 0);
  const winningTrades = tradeActions.filter((t) => t.dollarPnl >= 0);
  const avgLossMove =
    losingTrades.length > 0
      ? losingTrades.reduce((s, t) => s + Math.abs(t.priceMove), 0) / losingTrades.length
      : tradeActions.length > 0
        ? tradeActions[0].entry_price * 0.02
        : 1;
  // Add R-units to each trade
  const tradeActionsWithR = tradeActions.map((t) => ({
    ...t,
    rUnits: avgLossMove > 0 ? t.priceMove / avgLossMove : 0,
  }));

  // Risk stats
  const winRate = tradeActions.length > 0 ? winningTrades.length / tradeActions.length : 0;
  const avgWinDollar =
    winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + t.dollarPnl, 0) / winningTrades.length
      : 0;
  const avgLossDollar =
    losingTrades.length > 0
      ? losingTrades.reduce((s, t) => s + Math.abs(t.dollarPnl), 0) / losingTrades.length
      : 0;
  const avgWinR =
    winningTrades.length > 0
      ? winningTrades.reduce((s, t) => s + Math.abs(t.priceMove), 0) / winningTrades.length / avgLossMove
      : 0;
  const avgLossR = 1; // by definition
  const expectancyR = winRate * avgWinR - (1 - winRate) * avgLossR;

  const finalBalance = balance;
  const totalProfit = finalBalance - inv;
  const totalReturnPct = inv > 0 ? ((finalBalance - inv) / inv) * 100 : 0;
  const maxDrawdownDollars = inv * (Math.abs(summary.max_drawdown_pct) / 100);

  return (
    <div className="space-y-6 mt-6">
      {/* Investment Summary */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Investment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Starting Capital</p>
              <p className="text-base sm:text-xl font-bold text-foreground">
                {formatCurrency(inv)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Final Balance</p>
              <p
                className={`text-base sm:text-xl font-bold ${
                  finalBalance >= inv ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatCurrency(finalBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {totalProfit >= 0 ? "Potential Profit" : "Potential Loss"}
              </p>
              <p
                className={`text-base sm:text-xl font-bold flex items-center gap-1 ${
                  totalProfit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {totalProfit >= 0 ? (
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
                {totalProfit >= 0 ? "+" : ""}
                {formatCurrency(totalProfit)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Return</p>
              <p
                className={`text-base sm:text-xl font-bold ${
                  totalReturnPct >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatPct(totalReturnPct)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Max Drawdown</p>
              <p className="text-sm sm:text-base font-semibold text-red-400">
                -{formatCurrency(maxDrawdownDollars)}
              </p>
              <p className="text-xs text-red-400/70">{formatPct(summary.max_drawdown_pct)}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Sharpe-Like</p>
              <p className={`text-sm sm:text-base font-semibold ${summary.sharpe_like >= 1 ? "text-green-400" : "text-foreground"}`}>
                {summary.sharpe_like.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Win Rate</p>
              <p className={`text-sm sm:text-base font-semibold ${summary.win_rate >= 0.5 ? "text-green-400" : "text-red-400"}`}>
                {(summary.win_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Trades</p>
              <p className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                {summary.trade_count}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unit of Risk — Probability & Expectancy */}
      {tradeActionsWithR.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              Unit of Risk Analysis
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              1R = {formatCurrency(avgLossMove)} per share (avg losing trade move)
            </p>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {/* Win/Loss visual */}
              <div className="col-span-2 sm:col-span-1">
                <div className="flex gap-2 h-full">
                  {/* Risk visual — stacked R blocks like the image */}
                  <div className="flex-1 space-y-1">
                    {/* Green reward zone */}
                    <div
                      className="rounded-sm bg-green-500/20 border border-green-500/30 flex items-center justify-center text-xs font-mono text-green-400 p-2"
                      style={{ minHeight: `${Math.min(Math.max(avgWinR, 0.5), 5) * 24}px` }}
                    >
                      {avgWinR.toFixed(1)}R avg win
                    </div>
                    {/* Red risk zone */}
                    <div className="rounded-sm bg-red-500/20 border border-red-500/30 flex items-center justify-center text-xs font-mono text-red-400 p-2 h-[24px]">
                      1R risk
                    </div>
                  </div>
                </div>
              </div>

              {/* Winning % */}
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-foreground">Winning %</h5>
                <p className={`text-2xl sm:text-3xl font-bold font-mono ${winRate >= 0.5 ? "text-green-400" : "text-red-400"}`}>
                  {(winRate * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {winningTrades.length}W / {losingTrades.length}L
                </p>
                {/* Win/loss bar */}
                <div className="flex h-2 rounded-full overflow-hidden bg-red-500/30">
                  <div
                    className="bg-green-500 transition-all"
                    style={{ width: `${winRate * 100}%` }}
                  />
                </div>
              </div>

              {/* Average Win/Loss */}
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-foreground">Average Win / Loss</h5>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-400">Avg Win</span>
                    <span className="text-sm font-bold font-mono text-green-400">
                      +{formatCurrency(avgWinDollar)} ({avgWinR.toFixed(1)}R)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-red-400">Avg Loss</span>
                    <span className="text-sm font-bold font-mono text-red-400">
                      -{formatCurrency(avgLossDollar)} ({avgLossR.toFixed(1)}R)
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expectancy</span>
                    <span className={`text-sm font-bold font-mono ${expectancyR >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {expectancyR >= 0 ? "+" : ""}{expectancyR.toFixed(2)}R per trade
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {run.current_regime && (
          <div className="flex items-center gap-1.5 text-sm sm:text-base">
            <span className="text-muted-foreground">Regime:</span>
            <Badge variant={getRegimeVariant(run.current_regime)} className="text-xs sm:text-sm">
              {run.current_regime}
            </Badge>
          </div>
        )}
        {run.current_signal && (
          <div className="flex items-center gap-1.5 text-sm sm:text-base">
            <span className="text-muted-foreground">Signal:</span>
            <Badge variant={getSignalVariant(run.current_signal)} className="text-xs sm:text-sm">
              {run.current_signal.toUpperCase()}
            </Badge>
          </div>
        )}
        {run.confirmation_count !== null && (
          <span className="text-sm sm:text-base text-muted-foreground">
            {run.confirmation_count} confirmations
          </span>
        )}
      </div>

      {/* Price Chart */}
      {chartData && chartData.candles.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Price Chart — {run.symbol}</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
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
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Equity Curve</CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
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
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base">Variant Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-2 sm:px-6">
            <ScrollArea className="max-h-72">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Variant</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Val. Return</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">Drawdown</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm hidden sm:table-cell">Sharpe</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Trades</TableHead>
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
                                <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                              )}
                              <span className="font-mono text-xs sm:text-sm">
                                {v.variant_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">
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
                          <TableCell className="text-right text-xs sm:text-sm text-red-400 hidden sm:table-cell">
                            {formatPct(v.max_drawdown)}
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm hidden sm:table-cell">
                            {v.sharpe_like.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">
                            {v.trade_count}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            <OptimizationScatter variants={variants} />
          </CardContent>
        </Card>
      )}

      {/* Buy / Sell Trade Actions */}
      {tradeActionsWithR.length > 0 && (
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Trade Actions ({tradeActionsWithR.length}) — When to Buy & Sell
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            {/* Mobile: card layout */}
            <div className="block sm:hidden space-y-3">
              {tradeActionsWithR.map((t) => (
                <div key={t.id} className="rounded-lg border border-border overflow-hidden">
                  {/* BUY */}
                  <div className="bg-green-500/5 p-3 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-5 w-5 text-green-400" />
                        <Badge variant="default" className="bg-green-600 text-white text-xs">
                          BUY
                        </Badge>
                      </div>
                      <span className="text-sm font-mono font-bold">{formatCurrency(t.entry_price)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Date</span>
                        <p className="font-mono text-xs">{formatDateTime(t.entry_time)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Shares</span>
                        <p className="font-mono text-xs">{t.shares.toFixed(4)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground text-xs">Amount</span>
                        <p className="font-mono text-sm font-semibold">{formatCurrency(t.balanceBefore)}</p>
                      </div>
                    </div>
                  </div>
                  {/* SELL */}
                  <div className="bg-red-500/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-5 w-5 text-red-400" />
                        <Badge variant="destructive" className="text-xs">
                          SELL
                        </Badge>
                      </div>
                      <span className="text-sm font-mono font-bold">{formatCurrency(t.exit_price)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Date</span>
                        <p className="font-mono text-xs">{formatDateTime(t.exit_time)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Reason</span>
                        <p className="font-mono text-xs">{t.exit_reason}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Risk (R)</span>
                        <p className={`font-mono text-sm font-bold ${t.rUnits >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {t.rUnits >= 0 ? "+" : ""}{t.rUnits.toFixed(1)}R
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">P&L</span>
                        <p className={`font-mono text-sm font-bold ${t.dollarPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {t.dollarPnl >= 0 ? "+" : ""}{formatCurrency(t.dollarPnl)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Balance</span>
                        <p className={`font-mono text-sm font-bold ${t.balanceAfter >= inv ? "text-green-400" : "text-red-400"}`}>
                          {formatCurrency(t.balanceAfter)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block">
              <ScrollArea className="max-h-[400px]">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[28px]"></TableHead>
                        <TableHead className="text-sm">Date</TableHead>
                        <TableHead className="text-sm">Action</TableHead>
                        <TableHead className="text-right text-sm">Price</TableHead>
                        <TableHead className="text-right text-sm">Shares</TableHead>
                        <TableHead className="text-right text-sm">Invested</TableHead>
                        <TableHead className="text-right text-sm">P&L</TableHead>
                        <TableHead className="text-right text-sm">R Units</TableHead>
                        <TableHead className="text-right text-sm">Balance</TableHead>
                        <TableHead className="text-sm">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradeActionsWithR.map((t) => (
                        <React.Fragment key={`trade-${t.id}`}>
                          {/* BUY row */}
                          <TableRow className="bg-green-500/5 border-b-0">
                            <TableCell>
                              <ArrowUpCircle className="h-4 w-4 text-green-400" />
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {formatDateTime(t.entry_time)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="default" className="bg-green-600 text-white text-xs px-2">
                                BUY
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatCurrency(t.entry_price)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {t.shares.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatCurrency(t.balanceBefore)}
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
                            <TableCell className="text-right text-sm font-mono text-muted-foreground">
                              {formatCurrency(t.balanceBefore)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">Entry</TableCell>
                          </TableRow>
                          {/* SELL row */}
                          <TableRow className="bg-red-500/5">
                            <TableCell>
                              <ArrowDownCircle className="h-4 w-4 text-red-400" />
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {formatDateTime(t.exit_time)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="text-xs px-2">
                                SELL
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatCurrency(t.exit_price)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {t.shares.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {formatCurrency(t.shares * t.exit_price)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              <span className={t.dollarPnl >= 0 ? "text-green-400" : "text-red-400"}>
                                {t.dollarPnl >= 0 ? "+" : ""}{formatCurrency(t.dollarPnl)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              <span className={`font-bold ${t.rUnits >= 0 ? "text-green-400" : "text-red-400"}`}>
                                {t.rUnits >= 0 ? "+" : ""}{t.rUnits.toFixed(1)}R
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              <span className={t.balanceAfter >= inv ? "text-green-400" : "text-red-400"}>
                                {formatCurrency(t.balanceAfter)}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {t.exit_reason}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </div>

            {/* Bottom line summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 pt-4 border-t border-border gap-2">
              <span className="text-sm sm:text-base text-muted-foreground">
                {investmentAmount
                  ? `Based on ${formatCurrency(inv)} investment`
                  : `Simulated with $10,000 (enter amount above for custom)`}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                <span className={`text-sm font-semibold font-mono ${expectancyR >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Expectancy: {expectancyR >= 0 ? "+" : ""}{expectancyR.toFixed(2)}R/trade
                </span>
                <span className={`text-base sm:text-lg font-bold ${totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  Net: {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)} ({formatPct(totalReturnPct)})
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk Calculator & Position Sizer */}
      {tradeActionsWithR.length > 0 && (
        <RiskCalculator
          defaultEntry={tradeActionsWithR[tradeActionsWithR.length - 1]?.entry_price}
          defaultStopLoss={
            tradeActionsWithR[tradeActionsWithR.length - 1]
              ? tradeActionsWithR[tradeActionsWithR.length - 1].entry_price *
                (1 - Math.abs(tradeActionsWithR[tradeActionsWithR.length - 1].return_pct) / 100)
              : undefined
          }
          defaultRisk={inv > 0 ? Math.round(inv * 0.02) : undefined}
          trades={trades}
        />
      )}

      {/* Artifact link */}
      {artifactId && (
        <div className="flex items-center gap-2 text-sm sm:text-base">
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
