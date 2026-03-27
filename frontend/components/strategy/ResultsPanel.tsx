"use client";

import React from "react";
import Link from "next/link";
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
    <div className="space-y-4 mt-4">
      {/* Investment Summary */}
      <div className="bg-surface-low border border-primary/20 rounded-sm">
        <div className="px-4 sm:px-5 py-3 border-b border-border/10 flex items-center gap-2">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Investment Summary</span>
        </div>
        <div className="px-4 sm:px-5 py-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Starting Capital</p>
              <p className="text-base sm:text-xl font-bold tabular-nums text-foreground mt-0.5">
                {formatCurrency(inv)}
              </p>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Final Balance</p>
              <p
                className={`text-base sm:text-xl font-bold tabular-nums mt-0.5 ${
                  finalBalance >= inv ? "text-primary" : "text-destructive"
                }`}
              >
                {formatCurrency(finalBalance)}
              </p>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
                {totalProfit >= 0 ? "Potential Profit" : "Potential Loss"}
              </p>
              <p
                className={`text-base sm:text-xl font-bold tabular-nums flex items-center gap-1 mt-0.5 ${
                  totalProfit >= 0 ? "text-primary" : "text-destructive"
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
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Return</p>
              <p
                className={`text-base sm:text-xl font-bold tabular-nums mt-0.5 ${
                  totalReturnPct >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {formatPct(totalReturnPct)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 mt-4 pt-4 border-t border-border/10">
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Max Drawdown</p>
              <p className="text-sm sm:text-base font-bold tabular-nums text-destructive mt-0.5">
                -{formatCurrency(maxDrawdownDollars)}
              </p>
              <p className="text-2xs text-destructive/70 tabular-nums">{formatPct(summary.max_drawdown_pct)}</p>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Sharpe-Like</p>
              <p className={`text-sm sm:text-base font-bold tabular-nums mt-0.5 ${summary.sharpe_like >= 1 ? "text-primary" : "text-foreground"}`}>
                {summary.sharpe_like.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Win Rate</p>
              <p className={`text-sm sm:text-base font-bold tabular-nums mt-0.5 ${summary.win_rate >= 0.5 ? "text-primary" : "text-destructive"}`}>
                {(summary.win_rate * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Total Trades</p>
              <p className="text-sm sm:text-base font-bold tabular-nums text-foreground mt-0.5 flex items-center gap-1">
                <BarChart3 className="h-3.5 w-3.5" />
                {summary.trade_count}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Unit of Risk — Probability & Expectancy */}
      {tradeActionsWithR.length > 0 && (
        <div className="bg-surface-low border border-border/10 rounded-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-border/10 flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Unit of Risk Analysis</span>
          </div>
          <div className="px-4 sm:px-6 py-4">
            <p className="text-2xs text-muted-foreground mb-4 tabular-nums">
              1R = {formatCurrency(avgLossMove)} per share (avg losing trade move)
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {/* Win/Loss visual */}
              <div className="col-span-2 sm:col-span-1">
                <div className="flex gap-2 h-full">
                  <div className="flex-1 space-y-1">
                    {/* Reward zone */}
                    <div
                      className="rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-2xs font-mono text-primary p-2"
                      style={{ minHeight: `${Math.min(Math.max(avgWinR, 0.5), 5) * 24}px` }}
                    >
                      {avgWinR.toFixed(1)}R avg win
                    </div>
                    {/* Risk zone */}
                    <div className="rounded-sm bg-destructive/10 border border-destructive/20 flex items-center justify-center text-2xs font-mono text-destructive p-2 h-[24px]">
                      1R risk
                    </div>
                  </div>
                </div>
              </div>

              {/* Winning % */}
              <div className="space-y-2">
                <h5 className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Winning %</h5>
                <p className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums ${winRate >= 0.5 ? "text-primary" : "text-destructive"}`}>
                  {(winRate * 100).toFixed(0)}%
                </p>
                <p className="text-2xs text-muted-foreground tabular-nums">
                  {winningTrades.length}W / {losingTrades.length}L
                </p>
                <div className="flex h-1.5 rounded-full overflow-hidden bg-destructive/20">
                  <div
                    className="bg-primary transition-all"
                    style={{ width: `${winRate * 100}%` }}
                  />
                </div>
              </div>

              {/* Average Win/Loss */}
              <div className="space-y-2">
                <h5 className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Avg Win / Loss</h5>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-primary">Avg Win</span>
                    <span className="text-xs font-bold font-mono tabular-nums text-primary">
                      +{formatCurrency(avgWinDollar)} ({avgWinR.toFixed(1)}R)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-destructive">Avg Loss</span>
                    <span className="text-xs font-bold font-mono tabular-nums text-destructive">
                      -{formatCurrency(avgLossDollar)} ({avgLossR.toFixed(1)}R)
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/10">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-muted-foreground">Expectancy</span>
                    <span className={`text-xs font-bold font-mono tabular-nums ${expectancyR >= 0 ? "text-primary" : "text-destructive"}`}>
                      {expectancyR >= 0 ? "+" : ""}{expectancyR.toFixed(2)}R per trade
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal badges */}
      <div className="flex items-center gap-3 flex-wrap">
        {run.current_regime && (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground uppercase tracking-widest">Regime:</span>
            <span className={`text-3xs font-bold px-2 py-0.5 rounded-sm ${
              getRegimeVariant(run.current_regime) === "default"
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}>
              {run.current_regime}
            </span>
          </div>
        )}
        {run.current_signal && (
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-muted-foreground uppercase tracking-widest">Signal:</span>
            <span className={`text-3xs font-bold px-2 py-0.5 rounded-sm ${
              getSignalVariant(run.current_signal) === "default"
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
            }`}>
              {run.current_signal.toUpperCase()}
            </span>
          </div>
        )}
        {run.confirmation_count !== null && (
          <span className="text-2xs text-muted-foreground tabular-nums">
            {run.confirmation_count} confirmations
          </span>
        )}
      </div>

      {/* Price Chart */}
      {chartData && chartData.candles.length > 0 && (
        <div className="bg-surface-low border border-border/10 rounded-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-border/10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Price Chart — {run.symbol}
            </span>
          </div>
          <div className="px-2 sm:px-6 py-4">
            <PriceChart
              data={chartData.candles}
              signals={chartData.signals}
              symbol={run.symbol}
            />
          </div>
        </div>
      )}

      {/* Equity Curve */}
      {(trades.length > 0 || (chartData?.equity?.length ?? 0) > 0) && (
        <div className="bg-surface-low border border-border/10 rounded-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-border/10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Equity Curve</span>
          </div>
          <div className="px-2 sm:px-6 py-4">
            <EquityCurve
              trades={trades}
              equityPoints={chartData?.equity}
              showPnlBars
            />
          </div>
        </div>
      )}

      {/* Variant Leaderboard (AI Pick / BLSH) */}
      {isOptimizer && variants.length > 0 && (
        <div className="bg-surface-low border border-border/10 rounded-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-border/10">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Variant Leaderboard</span>
          </div>
          <div className="space-y-4 px-2 sm:px-6 py-4">
            <ScrollArea className="max-h-72">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                      <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Variant</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Val. Return</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4 hidden sm:table-cell">Drawdown</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4 hidden sm:table-cell">Sharpe</TableHead>
                      <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Trades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants
                      .sort((a, b) => b.validation_score - a.validation_score)
                      .map((v) => (
                        <TableRow key={v.id} className="border-border/10 hover:bg-surface-high/30">
                          <TableCell className="py-2 px-4">
                            <div className="flex items-center gap-2">
                              {v.selected_winner && (
                                <Trophy className="h-3.5 w-3.5 text-yellow-400" />
                              )}
                              <span className="font-mono text-xs tabular-nums">
                                {v.variant_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs py-2 px-4">
                            <span className={`tabular-nums font-mono ${v.validation_return >= 0 ? "text-primary" : "text-destructive"}`}>
                              {formatPct(v.validation_return)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs py-2 px-4 text-destructive tabular-nums font-mono hidden sm:table-cell">
                            {formatPct(v.max_drawdown)}
                          </TableCell>
                          <TableCell className="text-right text-xs py-2 px-4 tabular-nums font-mono hidden sm:table-cell">
                            {v.sharpe_like.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-xs py-2 px-4 tabular-nums">
                            {v.trade_count}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>

            <OptimizationScatter variants={variants} />
          </div>
        </div>
      )}

      {/* Buy / Sell Trade Actions */}
      {tradeActionsWithR.length > 0 && (
        <div className="bg-surface-low border border-border/10 rounded-sm">
          <div className="px-4 sm:px-6 py-3 border-b border-border/10 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Trade Actions ({tradeActionsWithR.length}) — When to Buy &amp; Sell
            </span>
          </div>
          <div className="px-2 sm:px-6 py-4">
            {/* Mobile: card layout */}
            <div className="block sm:hidden space-y-3">
              {tradeActionsWithR.map((t) => (
                <div key={t.id} className="rounded-sm border border-border/10 overflow-hidden">
                  {/* BUY */}
                  <div className="bg-primary/[0.03] p-3 border-b border-border/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-4 w-4 text-primary" />
                        <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm">BUY</span>
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums">{formatCurrency(t.entry_price)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Date</span>
                        <p className="font-mono text-2xs tabular-nums">{formatDateTime(t.entry_time)}</p>
                      </div>
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Shares</span>
                        <p className="font-mono text-2xs tabular-nums">{t.shares.toFixed(4)}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Amount</span>
                        <p className="font-mono text-xs font-semibold tabular-nums">{formatCurrency(t.balanceBefore)}</p>
                      </div>
                    </div>
                  </div>
                  {/* SELL */}
                  <div className="bg-destructive/[0.03] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-4 w-4 text-destructive" />
                        <span className="bg-destructive/15 text-destructive text-3xs font-bold px-2 py-0.5 rounded-sm">SELL</span>
                      </div>
                      <span className="text-xs font-mono font-bold tabular-nums">{formatCurrency(t.exit_price)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Date</span>
                        <p className="font-mono text-2xs tabular-nums">{formatDateTime(t.exit_time)}</p>
                      </div>
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Reason</span>
                        <p className="font-mono text-2xs">{t.exit_reason}</p>
                      </div>
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Risk (R)</span>
                        <p className={`font-mono text-xs font-bold tabular-nums ${t.rUnits >= 0 ? "text-primary" : "text-destructive"}`}>
                          {t.rUnits >= 0 ? "+" : ""}{t.rUnits.toFixed(1)}R
                        </p>
                      </div>
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">P&amp;L</span>
                        <p className={`font-mono text-xs font-bold tabular-nums ${t.dollarPnl >= 0 ? "text-primary" : "text-destructive"}`}>
                          {t.dollarPnl >= 0 ? "+" : ""}{formatCurrency(t.dollarPnl)}
                        </p>
                      </div>
                      <div>
                        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Balance</span>
                        <p className={`font-mono text-xs font-bold tabular-nums ${t.balanceAfter >= inv ? "text-primary" : "text-destructive"}`}>
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
                      <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                        <TableHead className="w-[28px]"></TableHead>
                        <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Date</TableHead>
                        <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Action</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Price</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Shares</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Invested</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">P&amp;L</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">R Units</TableHead>
                        <TableHead className="text-right text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Balance</TableHead>
                        <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-3">Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradeActionsWithR.map((t) => (
                        <React.Fragment key={`trade-${t.id}`}>
                          {/* BUY row */}
                          <TableRow className="bg-primary/[0.03] hover:bg-primary/[0.06] border-b-0 border-border/10">
                            <TableCell className="py-2 px-3">
                              <ArrowUpCircle className="h-3.5 w-3.5 text-primary" />
                            </TableCell>
                            <TableCell className="text-xs font-mono tabular-nums py-2 px-3">
                              {formatDateTime(t.entry_time)}
                            </TableCell>
                            <TableCell className="py-2 px-3">
                              <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm">BUY</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {formatCurrency(t.entry_price)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {t.shares.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {formatCurrency(t.balanceBefore)}
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground py-2 px-3">—</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground py-2 px-3">—</TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums text-muted-foreground py-2 px-3">
                              {formatCurrency(t.balanceBefore)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2 px-3">Entry</TableCell>
                          </TableRow>
                          {/* SELL row */}
                          <TableRow className="bg-destructive/[0.03] hover:bg-destructive/[0.06] border-border/10">
                            <TableCell className="py-2 px-3">
                              <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" />
                            </TableCell>
                            <TableCell className="text-xs font-mono tabular-nums py-2 px-3">
                              {formatDateTime(t.exit_time)}
                            </TableCell>
                            <TableCell className="py-2 px-3">
                              <span className="bg-destructive/15 text-destructive text-3xs font-bold px-2 py-0.5 rounded-sm">SELL</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {formatCurrency(t.exit_price)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {t.shares.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              {formatCurrency(t.shares * t.exit_price)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              <span className={t.dollarPnl >= 0 ? "text-primary" : "text-destructive"}>
                                {t.dollarPnl >= 0 ? "+" : ""}{formatCurrency(t.dollarPnl)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              <span className={`font-bold ${t.rUnits >= 0 ? "text-primary" : "text-destructive"}`}>
                                {t.rUnits >= 0 ? "+" : ""}{t.rUnits.toFixed(1)}R
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-mono tabular-nums py-2 px-3">
                              <span className={t.balanceAfter >= inv ? "text-primary" : "text-destructive"}>
                                {formatCurrency(t.balanceAfter)}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2 px-3">
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-4 pt-4 border-t border-border/10 gap-2">
              <span className="text-2xs text-muted-foreground">
                {investmentAmount
                  ? `Based on ${formatCurrency(inv)} investment`
                  : `Simulated with $10,000 (enter amount above for custom)`}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
                <span className={`text-xs font-semibold font-mono tabular-nums ${expectancyR >= 0 ? "text-primary" : "text-destructive"}`}>
                  Expectancy: {expectancyR >= 0 ? "+" : ""}{expectancyR.toFixed(2)}R/trade
                </span>
                <span className={`text-sm font-bold tabular-nums ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                  Net: {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)} ({formatPct(totalReturnPct)})
                </span>
              </div>
            </div>
          </div>
        </div>
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
