"use client";

import { useState, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { ScreenerControls } from "@/components/screener/ScreenerControls";
import { ScreenerResults } from "@/components/screener/ScreenerResults";
import { TechnicalAnalysis } from "@/components/screener/TechnicalAnalysis";
import { AnalystSummary } from "@/components/screener/AnalystSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { screenerTvApi, taApi } from "@/lib/api";
import { RefreshCcw, Clock } from "lucide-react";
import type { AssetUniverse, ScreenerRow, ScreenerRequest, TATimeframe } from "@/types";

function ScreenerContent() {
  const [universe, setUniverse] = useState<AssetUniverse>("stocks");
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
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Clock className="h-3 w-3" />
              {lastUpdated}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-7 text-xs">
            <RefreshCcw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col lg:flex-row gap-4 h-full">
        {/* Left column: controls + results */}
        <div className="lg:w-[55%] xl:w-[60%] space-y-4 min-w-0">
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
        <div className="lg:w-[45%] xl:w-[40%] space-y-4 min-w-0">
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
