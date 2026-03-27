"use client";

import { useState, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenerControls } from "@/components/screener/ScreenerControls";
import { ScreenerResults } from "@/components/screener/ScreenerResults";
import { TechnicalAnalysis } from "@/components/screener/TechnicalAnalysis";
import { AnalystSummary } from "@/components/screener/AnalystSummary";
import { screenerTvApi, taApi } from "@/lib/api";
import { RefreshCcw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetUniverse, ScreenerRow, ScreenerRequest, TATimeframe } from "@/types";

type ScanTab = "hot" | "trending";

function ScreenerContent() {
  const [universe, setUniverse] = useState<AssetUniverse>("stocks");
  const [scanTab, setScanTab] = useState<ScanTab>("hot");
  const [searchParams, setSearchParams] = useState<ScreenerRequest>({
    universe: "stocks",
    sort_by: "change_pct",
    sort_order: "desc",
    limit: 20,
  });
  const [selectedAsset, setSelectedAsset] = useState<ScreenerRow | null>(null);
  const [taTimeframe, setTaTimeframe] = useState<TATimeframe>("1D");

  // Screener query
  const screenerQuery = useQuery({
    queryKey: ["tv-screener", searchParams],
    queryFn: () => screenerTvApi.screen(searchParams),
    staleTime: 60_000,
  });

  // Presets query
  const presetsQuery = useQuery({
    queryKey: ["tv-presets"],
    queryFn: () => screenerTvApi.presets(),
    staleTime: 300_000,
  });

  // TA query
  const taQuery = useQuery({
    queryKey: ["tv-ta", selectedAsset?.symbol, selectedAsset?.exchange, taTimeframe],
    queryFn: () =>
      taApi.analyze({
        symbol: selectedAsset!.symbol,
        exchange: selectedAsset?.exchange,
        timeframe: taTimeframe,
      }),
    enabled: !!selectedAsset,
    staleTime: 30_000,
  });

  const handleUniverseChange = useCallback((u: AssetUniverse) => {
    setUniverse(u);
    setSelectedAsset(null);
    setSearchParams((prev) => ({ ...prev, universe: u }));
  }, []);

  const handleSearch = useCallback(
    (params: {
      minPrice?: number;
      maxPrice?: number;
      minVolume?: number;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      limit?: number;
      preset?: string;
    }) => {
      const filters = [];
      if (params.minPrice) filters.push({ field: "close", operator: "greater", value: params.minPrice });
      if (params.maxPrice) filters.push({ field: "close", operator: "less", value: params.maxPrice });
      if (params.minVolume) filters.push({ field: "volume", operator: "greater", value: params.minVolume });

      setSearchParams({
        universe,
        filters: filters.length > 0 ? filters : undefined,
        sort_by: params.sortBy,
        sort_order: params.sortOrder,
        limit: params.limit,
        preset: params.preset,
      });
      setSelectedAsset(null);
      toast.success("Scanning market...");
    },
    [universe]
  );

  const handlePresetSelect = useCallback(
    (preset: string) => {
      setSearchParams({
        universe,
        preset,
        sort_by: "change_pct",
        sort_order: "desc",
        limit: 20,
      });
      setSelectedAsset(null);
      toast.success(`Applied preset: ${preset.replace(/_/g, " ")}`);
    },
    [universe]
  );

  const handleSelect = useCallback((row: ScreenerRow) => {
    setSelectedAsset(row);
    setTaTimeframe("1D");
  }, []);

  const handleTimeframeChange = useCallback((tf: TATimeframe) => {
    setTaTimeframe(tf);
  }, []);

  const handleRefresh = useCallback(() => {
    screenerQuery.refetch();
    if (selectedAsset) taQuery.refetch();
    toast.success("Refreshing data...");
  }, [screenerQuery, taQuery, selectedAsset]);

  const lastUpdated = screenerQuery.data?.timestamp
    ? new Date(screenerQuery.data.timestamp).toLocaleTimeString()
    : null;

  return (
    <AppShell
      title="Screener & TA"
      actions={
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-high rounded text-3xs text-muted-foreground font-bold uppercase tracking-widest">
              <Clock className="h-3 w-3" />
              {lastUpdated}
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-high border border-white/5 hover:bg-surface-highest text-2xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground rounded transition-all"
          >
            <RefreshCcw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      }
    >
      {/* Page title + tab bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Market Scanner
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time volatility tracking and technical signal strength analysis.
          </p>
        </div>

        {/* Hot Stocks / Trending tabs */}
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-mid p-1 rounded-lg gap-1">
            <button
              onClick={() => setScanTab("hot")}
              className={cn(
                "px-4 py-1.5 text-2xs font-bold uppercase tracking-wider rounded transition-all",
                scanTab === "hot"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-high text-muted-foreground hover:text-foreground"
              )}
            >
              Hot Stocks
            </button>
            <button
              onClick={() => setScanTab("trending")}
              className={cn(
                "px-4 py-1.5 text-2xs font-bold uppercase tracking-wider rounded transition-all",
                scanTab === "trending"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-high text-muted-foreground hover:text-foreground"
              )}
            >
              Trending
            </button>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left column: controls + results */}
        <div className="lg:w-[58%] xl:w-[62%] space-y-4 min-w-0">
          <ScreenerControls
            universe={universe}
            onUniverseChange={handleUniverseChange}
            onSearch={handleSearch}
            onPresetSelect={handlePresetSelect}
            presets={presetsQuery.data ?? []}
            isLoading={screenerQuery.isFetching}
          />
          <ScreenerResults
            rows={screenerQuery.data?.rows ?? []}
            selectedSymbol={selectedAsset?.symbol ?? null}
            onSelect={handleSelect}
            universe={universe}
            isLoading={screenerQuery.isLoading}
            total={screenerQuery.data?.total}
          />
        </div>

        {/* Right column: TA + summary */}
        <div className="lg:w-[42%] xl:w-[38%] space-y-4 min-w-0">
          <TechnicalAnalysis
            result={taQuery.data ?? null}
            onTimeframeChange={handleTimeframeChange}
            currentTimeframe={taTimeframe}
            isLoading={taQuery.isFetching}
          />
          <AnalystSummary
            selectedAsset={selectedAsset}
            taResult={taQuery.data ?? null}
          />
        </div>
      </div>
    </AppShell>
  );
}

export default function ScreenerPage() {
  return (
    <Suspense fallback={null}>
      <ScreenerContent />
    </Suspense>
  );
}
