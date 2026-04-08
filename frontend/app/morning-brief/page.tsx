"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MorningBriefTable } from "@/components/dashboard/MorningBriefTable";
import { morningBriefApi } from "@/lib/api";

export default function MorningBriefPage() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["morning-brief"],
    queryFn: morningBriefApi.fetch,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const analyzedAt = data?.analyzed_at
    ? new Date(data.analyzed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <AppShell title="Morning Brief">
      <div className="flex flex-col gap-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Morning Brief</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Daily crypto watchlist — EMA 200 · RSI · MACD · Signal
            </p>
          </div>
          <div className="flex items-center gap-3">
            {analyzedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Analyzed {analyzedAt}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Meta */}
        {data && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Timeframe: <strong className="text-foreground">{data.timeframe} primary</strong></span>
            <span>Exchange: <strong className="text-foreground">BINANCE (yfinance)</strong></span>
            <span>Watchlist: <strong className="text-foreground">BTC · ETH · SOL · XRP · LINK · PEPE</strong></span>
          </div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          <MorningBriefTable rows={data?.rows} isLoading={isLoading} />
        </Card>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">Bias Rules</div>
            <p>Bullish = above EMA 200 + RSI &gt;50 + MACD bullish. Bearish = opposite. Neutral = mixed.</p>
          </div>
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">RSI</div>
            <p><span className="text-emerald-400">Green &le;30</span> oversold · <span className="text-red-400">Red &ge;70</span> overbought</p>
          </div>
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">Cache</div>
            <p>Results cached 1 hour server-side. Use Refresh to force a new pull.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
