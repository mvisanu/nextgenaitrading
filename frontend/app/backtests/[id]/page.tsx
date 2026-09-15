"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import { Button } from "@/components/ui/button";
import { backtestApi } from "@/lib/api";
import { summarizeBacktest } from "@/lib/backtest-summary";

export default function BacktestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const runId = Number(id);
  const valid = Number.isSafeInteger(runId) && runId > 0;
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["backtests", runId, "detail"], enabled: valid,
    queryFn: async () => {
      const [run, trades, chartData, variants] = await Promise.all([
        backtestApi.get(runId), backtestApi.trades(runId),
        backtestApi.chartData(runId).catch(() => undefined), backtestApi.leaderboard(runId).catch(() => []),
      ]);
      return { summary: summarizeBacktest(run, trades), trades, chartData, variants };
    },
  });
  return <AppShell title="Backtest results">
    <Link href="/strategies?view=history" className="mb-6 inline-flex min-h-11 items-center text-sm text-primary underline">Back to backtest history</Link>
    {!valid ? <p role="alert">Invalid backtest ID.</p> : isPending ? <p role="status">Loading results?</p> : error ? <div role="alert"><p>Results could not be loaded.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></div> : data ? <>
      <p className="mb-4 text-sm text-muted-foreground">Historical simulation. Returns compound closed trades; drawdown measures the decline from the equity peak. These results do not guarantee future returns.</p>
      <ResultsPanel {...data} />
    </> : null}
  </AppShell>;
}
