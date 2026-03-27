"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { StrategyModeSelector } from "@/components/strategy/StrategyModeSelector";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { AiStrategyBuilder } from "@/components/strategy/AiStrategyBuilder";
import { backtestApi, strategyApi } from "@/lib/api";
import { getQueryClient } from "@/lib/queryClient";
import type {
  StrategyMode,
  BacktestSummary,
  ChartData,
  BacktestTrade,
  VariantBacktestResult,
} from "@/types";
import type { TabMode } from "@/components/strategy/StrategyModeSelector";

interface RunResult {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
  artifactId?: number;
  investmentAmount?: number;
}

export default function StrategiesPage() {
  const [results, setResults] = useState<Partial<Record<StrategyMode, RunResult>>>({});

  const { mutate: runStrategy, isPending: isRunning } = useMutation({
    mutationFn: async (params: {
      mode: StrategyMode;
      request: Parameters<typeof backtestApi.run>[0];
      investmentAmount?: number;
    }) => {
      const { mode, request, investmentAmount } = params;

      // API returns flat BacktestOut { id, user_id, mode_name, ... }
      let raw: any;
      if (mode === "ai-pick") {
        raw = await strategyApi.runAiPick(request);
      } else if (mode === "buy-low-sell-high") {
        raw = await strategyApi.runBuyLowSellHigh(request);
      } else {
        raw = await backtestApi.run(request);
      }

      // The response is flat — extract runId directly
      const runId: number = raw.id ?? raw.run?.id;

      // Fetch supplementary data in parallel
      const [chartData, trades, variants] = await Promise.all([
        backtestApi.chartData(runId).catch(() => undefined),
        backtestApi.trades(runId).catch(() => [] as BacktestTrade[]),
        (mode === "ai-pick" || mode === "buy-low-sell-high")
          ? backtestApi.leaderboard(runId).catch(() => [])
          : Promise.resolve([]),
      ]);

      // Build BacktestSummary shape that ResultsPanel expects
      const totalReturnPct = trades.reduce((s, t) => s + (t.leveraged_return_pct ?? t.return_pct), 0);
      const maxDrawdownPct = trades.length > 0
        ? Math.min(...trades.map((t) => t.leveraged_return_pct ?? t.return_pct))
        : 0;
      const wins = trades.filter((t) => t.return_pct >= 0).length;
      const avgRet = trades.length > 0 ? totalReturnPct / trades.length : 0;
      const stdDev = trades.length > 1
        ? Math.sqrt(trades.reduce((s, t) => s + Math.pow((t.leveraged_return_pct ?? t.return_pct) - avgRet, 2), 0) / (trades.length - 1))
        : 1;

      const summary: BacktestSummary = {
        run: {
          id: runId,
          user_id: raw.user_id,
          created_at: raw.created_at,
          run_type: raw.run_type ?? "backtest",
          mode_name: raw.mode_name,
          strategy_family: raw.strategy_family ?? null,
          symbol: raw.symbol,
          timeframe: raw.timeframe,
          leverage: raw.leverage,
          min_confirmations: raw.min_confirmations ?? null,
          trailing_stop_pct: raw.trailing_stop_pct ?? null,
          current_regime: raw.current_regime ?? null,
          current_signal: raw.current_signal ?? null,
          confirmation_count: raw.confirmation_count ?? null,
          selected_variant_name: raw.selected_variant_name ?? null,
          selected_variant_score: raw.selected_variant_score ?? null,
          notes: raw.notes ?? null,
          error_message: raw.error_message ?? null,
        },
        total_return_pct: totalReturnPct,
        max_drawdown_pct: maxDrawdownPct,
        sharpe_like: stdDev > 0 ? avgRet / stdDev : 0,
        trade_count: trades.length,
        win_rate: trades.length > 0 ? wins / trades.length : 0,
      };

      return { mode, summary, chartData, trades, variants, investmentAmount };
    },
    onSuccess: ({ mode, summary, chartData, trades, variants, investmentAmount }) => {
      setResults((prev) => ({
        ...prev,
        [mode]: { summary, chartData, trades, variants, investmentAmount },
      }));
      getQueryClient().invalidateQueries({ queryKey: ["strategies", "runs"] });
      getQueryClient().invalidateQueries({ queryKey: ["backtests"] });
      toast.success("Strategy run complete");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Strategy run failed");
    },
  });

  return (
    <AppShell title="Strategies">
      {/* Page header */}
      <header className="mb-4 sm:mb-6 px-2 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Strategy Simulator
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Backtest sophisticated algorithmic parameters with zero risk capital.
        </p>
      </header>

      {/*
        StrategyModeSelector renders a two-column grid:
          Left  (~380px): strategy list + leftSlot (form + run button)
          Right (flex-1): children render-prop (results panel)
      */}
      <StrategyModeSelector
        aiBuilderContent={<AiStrategyBuilder />}
        leftSlot={(mode: TabMode) => {
          if (mode === "ai-builder") return null;
          const stratMode = mode as StrategyMode;
          return (
            <StrategyForm
              mode={stratMode}
              onSubmit={(values) =>
                runStrategy({
                  mode: stratMode,
                  request: values,
                  investmentAmount: values.investment_amount,
                })
              }
              isLoading={isRunning}
            />
          );
        }}
      >
        {(mode) => {
          const result = results[mode];
          if (!result) {
            return (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-2xl">▶</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  No simulation run yet
                </p>
                <p className="text-2xs text-muted-foreground mt-1 max-w-xs">
                  Configure your parameters on the left and press{" "}
                  <span className="text-primary font-bold">Run Simulation</span> to
                  see results here.
                </p>
              </div>
            );
          }
          return (
            <ResultsPanel
              summary={result.summary}
              chartData={result.chartData}
              trades={result.trades}
              variants={result.variants}
              artifactId={result.artifactId}
              investmentAmount={result.investmentAmount}
            />
          );
        }}
      </StrategyModeSelector>
    </AppShell>
  );
}
