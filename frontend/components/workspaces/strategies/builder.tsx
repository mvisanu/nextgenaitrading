"use client";

import { WorkspaceSection as AppShell } from "@/components/layout/WorkspaceSection";
import { AiStrategyBuilder } from "@/components/strategy/AiStrategyBuilder";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import type { TabMode } from "@/components/strategy/StrategyModeSelector";
import { StrategyModeSelector } from "@/components/strategy/StrategyModeSelector";
import { backtestApi,strategyApi } from "@/lib/api";
import { summarizeBacktest } from "@/lib/backtest-summary";
import { getQueryClient } from "@/lib/queryClient";
import { useTradingSelection } from "@/lib/use-trading-selection";
import type {
BacktestSummary,
BacktestTrade,
ChartData,
StrategyMode,
VariantBacktestResult,
} from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

interface RunResult {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
  artifactId?: number;
  investmentAmount?: number;
}

export default function StrategiesPage() {
  const [selection, updateSelection] = useTradingSelection();
  const [results, setResults] = useState<Partial<Record<StrategyMode, RunResult>>>({});

  const { mutate: runStrategy, isPending: isRunning } = useMutation({
    mutationFn: async (params: {
      mode: StrategyMode;
      request: Parameters<typeof backtestApi.run>[0];
      investmentAmount?: number;
    }) => {
      const { mode, request, investmentAmount } = params;

      // API returns flat BacktestOut { id, user_id, mode_name, ... }
      let raw: import("@/types").StrategyRun;
      if (mode === "ai-pick") {
        raw = await strategyApi.runAiPick(request);
      } else if (mode === "buy-low-sell-high") {
        raw = await strategyApi.runBuyLowSellHigh(request);
      } else {
        raw = await backtestApi.run(request);
      }

      // The response is flat — extract runId directly
      const runId: number = raw.id;
      if (raw.error_message) throw new Error(raw.error_message);

      // Fetch supplementary data in parallel
      const [chartData, trades, variants] = await Promise.all([
        backtestApi.chartData(runId).catch(() => undefined),
        backtestApi.trades(runId),
        (mode === "ai-pick" || mode === "buy-low-sell-high")
          ? backtestApi.leaderboard(runId).catch(() => [])
          : Promise.resolve([]),
      ]);

      const summary = summarizeBacktest(raw, trades);

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
      {/*
        StrategyModeSelector renders a two-column grid:
          Left  (~380px): strategy list + leftSlot (form + run button)
          Right (flex-1): children render-prop (results panel)
      */}
      <StrategyModeSelector
        defaultMode={selection.strategy}
        onModeChange={mode => { if (mode !== "ai-builder") updateSelection({ strategy: mode }); }}
        aiBuilderContent={<AiStrategyBuilder />}
        leftSlot={(mode: TabMode) => {
          if (mode === "ai-builder") return null;
          const stratMode = mode as StrategyMode;
          return (
            <StrategyForm
              key={stratMode}
              mode={stratMode}
              defaultSymbol={selection.symbol}
              defaultTimeframe={selection.timeframe}
              onContextChange={updateSelection}
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
