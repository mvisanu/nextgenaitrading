"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calculator,
  Target,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface RiskCalculatorProps {
  /** Pre-fill from last trade's entry price */
  defaultEntry?: number;
  /** Pre-fill stop loss from strategy trailing stop */
  defaultStopLoss?: number;
  /** Pre-fill from investment amount */
  defaultRisk?: number;
  /** Backtest trades for expectancy calculation */
  trades?: {
    return_pct: number;
    leveraged_return_pct?: number;
    entry_price: number;
    exit_price: number;
  }[];
}

export function RiskCalculator({
  defaultEntry,
  defaultStopLoss,
  defaultRisk,
  trades = [],
}: RiskCalculatorProps) {
  const [entryPrice, setEntryPrice] = useState(defaultEntry?.toString() ?? "");
  const [stopLoss, setStopLoss] = useState(defaultStopLoss?.toString() ?? "");
  const [riskAmount, setRiskAmount] = useState(defaultRisk?.toString() ?? "");
  const [targetPrice, setTargetPrice] = useState("");

  const entry = parseFloat(entryPrice) || 0;
  const stop = parseFloat(stopLoss) || 0;
  const risk = parseFloat(riskAmount) || 0;
  const target = parseFloat(targetPrice) || 0;

  // Position sizing: shares = $risk / (entry - stopLoss)
  const rPerShare = entry > 0 && stop > 0 ? Math.abs(entry - stop) : 0;
  const shares = rPerShare > 0 ? risk / rPerShare : 0;
  const positionValue = shares * entry;
  const isLong = entry > stop;

  // Risk-reward ratio
  const rewardPerShare =
    target > 0 && entry > 0
      ? isLong
        ? target - entry
        : entry - target
      : 0;
  const riskRewardRatio = rPerShare > 0 && rewardPerShare > 0 ? rewardPerShare / rPerShare : 0;
  const potentialProfit = shares * rewardPerShare;

  // Expectancy from backtest trades
  const expectancy = useMemo(() => {
    if (trades.length === 0) return null;

    const wins = trades.filter((t) => t.return_pct >= 0);
    const losses = trades.filter((t) => t.return_pct < 0);
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = winCount / trades.length;
    const lossRate = lossCount / trades.length;

    // Use dollar P&L per share (exit - entry)
    const winAmounts = wins.map((t) => Math.abs(t.exit_price - t.entry_price));
    const lossAmounts = losses.map((t) => Math.abs(t.exit_price - t.entry_price));

    const avgWin = winAmounts.length > 0 ? winAmounts.reduce((s, v) => s + v, 0) / winAmounts.length : 0;
    const avgLoss = lossAmounts.length > 0 ? lossAmounts.reduce((s, v) => s + v, 0) / lossAmounts.length : 0;
    const sumWin = winAmounts.reduce((s, v) => s + v, 0);
    const sumLoss = lossAmounts.reduce((s, v) => s + v, 0);

    // Expectancy per trade = (winRate * avgWin) - (lossRate * avgLoss)
    const expectancyPerTrade = winRate * avgWin - lossRate * avgLoss;

    // Average R (in terms of risk units) if we know R
    const avgWinR = rPerShare > 0 ? avgWin / rPerShare : 0;
    const avgLossR = rPerShare > 0 ? avgLoss / rPerShare : 0;
    const expectancyR = rPerShare > 0 ? winRate * avgWinR - lossRate * avgLossR : 0;

    return {
      winCount,
      lossCount,
      winRate,
      lossRate,
      avgWin,
      avgLoss,
      sumWin,
      sumLoss,
      expectancyPerTrade,
      expectancyR,
    };
  }, [trades, rPerShare]);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3 px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Calculator className="h-5 w-5 text-amber-400" />
          Position Sizer & Risk Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Calculate how many shares to buy based on your risk tolerance
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 space-y-5">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <Target className="inline h-3 w-3 mr-1" />
              Entry Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="153.52"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="pl-7 h-11 text-base font-mono bg-background"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <ShieldAlert className="inline h-3 w-3 mr-1 text-red-400" />
              Stop Loss
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="150.52"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="pl-7 h-11 text-base font-mono bg-background border-red-500/30"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              $ Risk Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="1"
                placeholder="100"
                value={riskAmount}
                onChange={(e) => setRiskAmount(e.target.value)}
                className="pl-7 h-11 text-base font-mono bg-background border-amber-500/30"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              <TrendingUp className="inline h-3 w-3 mr-1 text-green-400" />
              Target Price
              <span className="text-muted-foreground/50 ml-1">(optional)</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input
                type="number"
                step="0.01"
                placeholder="160.00"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="pl-7 h-11 text-base font-mono bg-background border-green-500/30"
              />
            </div>
          </div>
        </div>

        {/* Formula visual */}
        {rPerShare > 0 && risk > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-card p-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-center">
              <div>
                <p className="text-xs text-muted-foreground">$ Risk</p>
                <p className="text-xl font-bold text-amber-400 font-mono">{formatCurrency(risk)}</p>
              </div>
              <span className="text-2xl text-muted-foreground font-light hidden sm:block">/</span>
              <span className="text-lg text-muted-foreground font-light block sm:hidden">÷</span>
              <div>
                <p className="text-xs text-muted-foreground">
                  R per share ({isLong ? "Entry − Stop" : "Stop − Entry"})
                </p>
                <p className="text-xl font-bold text-red-400 font-mono">{formatCurrency(rPerShare)}</p>
              </div>
              <span className="text-2xl text-muted-foreground font-light">=</span>
              <div>
                <p className="text-xs text-muted-foreground">Entry Quantity</p>
                <p className="text-2xl font-bold text-primary font-mono">{Math.floor(shares)} shares</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Position: {formatCurrency(Math.floor(shares) * entry)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results grid */}
        {rPerShare > 0 && risk > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-border p-3 bg-card">
              <p className="text-xs text-muted-foreground">Shares to Buy</p>
              <p className="text-lg sm:text-xl font-bold text-primary font-mono">
                {Math.floor(shares)}
              </p>
              <p className="text-xs text-muted-foreground">
                ({shares.toFixed(2)} exact)
              </p>
            </div>
            <div className="rounded-md border border-border p-3 bg-card">
              <p className="text-xs text-muted-foreground">Position Value</p>
              <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
                {formatCurrency(Math.floor(shares) * entry)}
              </p>
            </div>
            <div className="rounded-md border border-red-500/20 p-3 bg-card">
              <p className="text-xs text-muted-foreground">Max Loss (1R)</p>
              <p className="text-lg sm:text-xl font-bold text-red-400 font-mono">
                -{formatCurrency(risk)}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry > 0 ? ((risk / (Math.floor(shares) * entry)) * 100).toFixed(2) : 0}% of position
              </p>
            </div>
            {target > 0 && riskRewardRatio > 0 ? (
              <div className="rounded-md border border-green-500/20 p-3 bg-card">
                <p className="text-xs text-muted-foreground">Potential Profit</p>
                <p className="text-lg sm:text-xl font-bold text-green-400 font-mono">
                  +{formatCurrency(Math.floor(shares) * rewardPerShare)}
                </p>
                <p className="text-xs text-green-400/70">
                  {riskRewardRatio.toFixed(1)}R reward ({riskRewardRatio.toFixed(1)}:1)
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border p-3 bg-card">
                <p className="text-xs text-muted-foreground">Risk:Reward</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter target price to calculate
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {(rPerShare === 0 || risk === 0) && (
          <div className="flex items-center gap-2 p-4 rounded-lg border border-dashed border-border text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" />
            <p className="text-sm">
              Enter entry price, stop loss, and $ risk amount to calculate your position size.
              <br />
              <span className="text-xs">Formula: $ risk ÷ (entry − stop loss) = shares to buy</span>
            </p>
          </div>
        )}

        {/* Expectancy Stats from backtest */}
        {expectancy && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Expectancy & Stats
              <span className="text-xs text-muted-foreground font-normal">
                (from {trades.length} backtest trades)
              </span>
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-2">
              {/* Losses column */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-red-400">Losses</h5>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Count</span>
                    <span className="font-mono">{expectancy.lossCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg loss</span>
                    <span className="font-mono text-red-400">
                      -{formatCurrency(expectancy.avgLoss)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sum</span>
                    <span className="font-mono text-red-400">
                      -{formatCurrency(expectancy.sumLoss)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Loss %</span>
                    <span className="font-mono text-red-400">
                      {(expectancy.lossRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
              {/* Wins column */}
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-green-400">Wins</h5>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Count</span>
                    <span className="font-mono">{expectancy.winCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg win</span>
                    <span className="font-mono text-green-400">
                      +{formatCurrency(expectancy.avgWin)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sum</span>
                    <span className="font-mono text-green-400">
                      +{formatCurrency(expectancy.sumWin)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Win %</span>
                    <span className="font-mono text-green-400">
                      {(expectancy.winRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Expectancy summary */}
            <div className="pt-3 border-t border-border">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Expectancy per Trade</p>
                  <p
                    className={`text-lg font-bold font-mono ${
                      expectancy.expectancyPerTrade >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {expectancy.expectancyPerTrade >= 0 ? "+" : ""}
                    {formatCurrency(expectancy.expectancyPerTrade)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    = ({(expectancy.winRate * 100).toFixed(0)}% × {formatCurrency(expectancy.avgWin)}) −
                    ({(expectancy.lossRate * 100).toFixed(0)}% × {formatCurrency(expectancy.avgLoss)})
                  </p>
                </div>
                {rPerShare > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expectancy in R</p>
                    <p
                      className={`text-lg font-bold font-mono ${
                        expectancy.expectancyR >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {expectancy.expectancyR >= 0 ? "+" : ""}
                      {expectancy.expectancyR.toFixed(2)}R
                    </p>
                    <p className="text-xs text-muted-foreground">
                      per trade (1R = {formatCurrency(rPerShare)})
                    </p>
                  </div>
                )}
                {rPerShare > 0 && risk > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expected $ per Trade</p>
                    <p
                      className={`text-lg font-bold font-mono ${
                        expectancy.expectancyR >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {expectancy.expectancyR * risk >= 0 ? "+" : ""}
                      {formatCurrency(expectancy.expectancyR * risk)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      at {formatCurrency(risk)} risk per trade
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
