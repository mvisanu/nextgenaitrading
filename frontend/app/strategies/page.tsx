"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { StrategyModeSelector } from "@/components/strategy/StrategyModeSelector";
import { StrategyForm } from "@/components/strategy/StrategyForm";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { backtestApi, strategyApi } from "@/lib/api";
import { getQueryClient } from "@/lib/queryClient";
import type {
  StrategyMode,
  BacktestSummary,
  ChartData,
  BacktestTrade,
  VariantBacktestResult,
} from "@/types";

interface RunResult {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
  artifactId?: number;
}

export default function StrategiesPage() {
  const [results, setResults] = useState<Partial<Record<StrategyMode, RunResult>>>({});

  const { mutate: runStrategy, isPending: isRunning } = useMutation({
    mutationFn: async (params: {
      mode: StrategyMode;
      request: Parameters<typeof backtestApi.run>[0];
    }) => {
      const { mode, request } = params;
      let summary: BacktestSummary;

      if (mode === "ai-pick") {
        summary = await strategyApi.runAiPick(request);
      } else if (mode === "buy-low-sell-high") {
        summary = await strategyApi.runBuyLowSellHigh(request);
      } else {
        summary = await backtestApi.run(request);
      }

      const runId = summary.run.id;

      // Fetch supplementary data in parallel
      const [chartData, trades, variants] = await Promise.all([
        backtestApi.chartData(runId).catch(() => undefined),
        backtestApi.trades(runId).catch(() => []),
        (mode === "ai-pick" || mode === "buy-low-sell-high")
          ? backtestApi.leaderboard(runId).catch(() => [])
          : Promise.resolve([]),
      ]);

      return { mode, summary, chartData, trades, variants };
    },
    onSuccess: ({ mode, summary, chartData, trades, variants }) => {
      setResults((prev) => ({
        ...prev,
        [mode]: { summary, chartData, trades, variants },
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
      <StrategyModeSelector>
        {(mode) => {
          const result = results[mode];
          return (
            <div>
              <StrategyForm
                mode={mode}
                onSubmit={(values) =>
                  runStrategy({ mode, request: values })
                }
                isLoading={isRunning}
              />

              {result && (
                <ResultsPanel
                  summary={result.summary}
                  chartData={result.chartData}
                  trades={result.trades}
                  variants={result.variants}
                  artifactId={result.artifactId}
                />
              )}
            </div>
          );
        }}
      </StrategyModeSelector>
    </AppShell>
  );
}
