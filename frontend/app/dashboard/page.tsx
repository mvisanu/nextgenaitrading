"use client";

import { useQuery } from "@tanstack/react-query";
import { Check,Pencil,Search } from "lucide-react";
import React,{ Suspense,useCallback,useEffect,useMemo,useRef,useState } from "react";

import { detectFVGs,type DrawingPoint,type FVGData,type TrendLineData } from "@/components/charts/DrawingPrimitives";
import { MACDChart } from "@/components/charts/MACDChart";
import { type ChartClickPoint,type DrawingMode,type MAOverlay } from "@/components/charts/PriceChart";
import { RSIChart } from "@/components/charts/RSIChart";
import { NewsPanel } from "@/components/dashboard/NewsPanel";
import { AppShell,useAuth } from "@/components/layout/AppShell";
import { Sheet,SheetContent,SheetDescription,SheetTitle } from "@/components/ui/sheet";
import { useAccountStorage } from "@/lib/account-storage";
import { liveApi } from "@/lib/api";
import { drawingSchema,emptyDrawings } from "@/lib/drawing-storage";
import { computeMACD,computeRSI,computeSMA } from "@/lib/indicators";
import { useTheme } from "@/lib/theme";

import { cn } from "@/lib/utils";
import { flattenWatchlist,useWatchlist } from "@/lib/watchlist";

import { getSpread,useMarketStream } from "@/lib/market-stream";

import { TERMINAL_ANIM_STYLES } from "@/components/dashboard/chart-animation";
import { ALL_INTERVALS,DEFAULT_INTERVAL,PERIOD_RANGES,type IntervalOption,type PeriodRange } from "@/components/dashboard/chart-config";
import { ChartToolbar } from "@/components/dashboard/ChartToolbar";
import { PriceChartFill } from "@/components/dashboard/ChartViewport";
import { DashboardUserStatus,KpiCardsPanel } from "@/components/dashboard/OverviewActivity";
import { formatPrice } from "@/components/dashboard/quote-format";
import { QuotePanel,WatchlistSection } from "@/components/dashboard/WatchlistPanel";
import { useChartPreferences } from "@/lib/chart-preferences";
import { type TradingSelection } from "@/lib/trading-selection";
import { useTradingSelection } from "@/lib/use-trading-selection";

function DashboardContent() {
  const { theme, toggle } = useTheme();

  const { user } = useAuth();
  const [selection, updateSelection] = useTradingSelection();
  const symbol = selection.symbol;
  const interval = ALL_INTERVALS.find(item => item.value === selection.timeframe) ?? DEFAULT_INTERVAL;
  const setInterval = useCallback((opt: IntervalOption) => updateSelection({ timeframe: opt.value as TradingSelection["timeframe"] }), [updateSelection]);
  const [preferences, setPreferences] = useChartPreferences();


  const { watchlist, allItems: _allWatchlistItems, addToWatchlist, removeFromWatchlist, error: watchlistError, isLoading: watchlistLoading, refetch: refetchWatchlist } = useWatchlist();
  const [isEditingWatchlist, setIsEditingWatchlist] = useState(false);

  // ── Panel & drawing tools state ─────────────────────────────────────────
  const showWatchlist = preferences.showWatchlist;
  const setShowWatchlist = (value: React.SetStateAction<typeof showWatchlist>) => setPreferences(previous => ({ ...previous, showWatchlist: typeof value === "function" ? value(previous.showWatchlist) : value }));
  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("none");
  const [drawings, saveDrawings] = useAccountStorage(user?.id, "drawings", drawingSchema, emptyDrawings);
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);
  const showFVG = preferences.showFVG;
  const setShowFVG = (value: React.SetStateAction<typeof showFVG>) => setPreferences(previous => ({ ...previous, showFVG: typeof value === "function" ? value(previous.showFVG) : value }));
  const showBollinger = preferences.showBollinger;
  const setShowBollinger = (value: React.SetStateAction<typeof showBollinger>) => setPreferences(previous => ({ ...previous, showBollinger: typeof value === "function" ? value(previous.showBollinger) : value }));
  const showMA = preferences.showMA;
  const setShowMA = (value: React.SetStateAction<typeof showMA>) => setPreferences(previous => ({ ...previous, showMA: typeof value === "function" ? value(previous.showMA) : value }));
  const showMACD = preferences.showMACD;
  const setShowMACD = (value: React.SetStateAction<typeof showMACD>) => setPreferences(previous => ({ ...previous, showMACD: typeof value === "function" ? value(previous.showMACD) : value }));
  const showRSI = preferences.showRSI;
  const setShowRSI = (value: React.SetStateAction<typeof showRSI>) => setPreferences(previous => ({ ...previous, showRSI: typeof value === "function" ? value(previous.showRSI) : value }));
  const showDrawings = preferences.showDrawings;
  const setShowDrawings = (value: React.SetStateAction<typeof showDrawings>) => setPreferences(previous => ({ ...previous, showDrawings: typeof value === "function" ? value(previous.showDrawings) : value }));
  const showNews = preferences.showNews;
  const setShowNews = (value: React.SetStateAction<typeof showNews>) => setPreferences(previous => ({ ...previous, showNews: typeof value === "function" ? value(previous.showNews) : value }));
  const [newsMaximized, setNewsMaximized] = useState(false);
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const chartScale = preferences.chartScale;
  const setChartScale = (value: React.SetStateAction<typeof chartScale>) => setPreferences(previous => ({ ...previous, chartScale: typeof value === "function" ? value(previous.chartScale) : value }));


  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && drawingMode !== "none") {
        setDrawingMode("none");
        setPendingPoint(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingMode]);

  const handleChartClick = useCallback((point: ChartClickPoint) => {
    if (drawingMode === "trendline") {
      if (!pendingPoint) {
        setPendingPoint({ time: point.time, price: point.price });
      } else {
        const newLine: TrendLineData = {
          id: crypto.randomUUID(),
          type: "trendline",
          p1: pendingPoint,
          p2: { time: point.time, price: point.price },
          color: "#2962ff",
          lineWidth: 2,
        };
        const next = [...drawings, newLine];
        saveDrawings(next);
        setPendingPoint(null);
        setDrawingMode("none");
      }
    } else if (drawingMode === "fvg") {
      if (!pendingPoint) {
        setPendingPoint({ time: point.time, price: point.price });
      } else {
        const newFVG: FVGData = {
          id: crypto.randomUUID(),
          type: "fvg",
          startTime: pendingPoint.time,
          endTime: point.time,
          highPrice: Math.max(pendingPoint.price, point.price),
          lowPrice: Math.min(pendingPoint.price, point.price),
          direction: point.price > pendingPoint.price ? "bullish" : "bearish",
        };
        const next = [...drawings, newFVG];
        saveDrawings(next);
        setPendingPoint(null);
        setDrawingMode("none");
      }
    }
  }, [drawingMode, pendingPoint, drawings, saveDrawings]);

  const clearAllDrawings = useCallback(() => {
    saveDrawings([]);
    setPendingPoint(null);
    setDrawingMode("none");
  }, [saveDrawings]);

  const toggleDrawingMode = useCallback((mode: DrawingMode) => {
    setDrawingMode((prev) => {
      setPendingPoint(null);
      return prev === mode ? "none" : mode;
    });
  }, []);

  const handlePeriodSelect = useCallback((period: PeriodRange) => {
    setActivePeriod(period.label);
    const opt = ALL_INTERVALS.find((i) => i.value === period.interval);
    if (opt) setInterval(opt);
  }, [setInterval]);

  const chartSymbol = symbol;

  const { data: chartPayload } = useQuery({
    queryKey: ["live", "chart-data", chartSymbol, interval.value, showBollinger],
    queryFn: () => liveApi.chartData(chartSymbol, interval.value, showBollinger),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: !!user,
  });

  const candles = useMemo(() => chartPayload?.candles ?? [], [chartPayload]);
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const priceChange =
    lastCandle && prevCandle ? lastCandle.close - prevCandle.close : null;
  const pricePct =
    priceChange !== null && prevCandle
      ? (priceChange / prevCandle.close) * 100
      : null;
  const isPositive = priceChange !== null && priceChange >= 0;

  const autoFVGs = useMemo(() => {
    if (!showFVG || candles.length < 3) return [];
    return detectFVGs(candles);
  }, [showFVG, candles]);

  const allDrawings = useMemo(() => {
    if (!showDrawings) return autoFVGs;
    return [...drawings, ...autoFVGs];
  }, [drawings, autoFVGs, showDrawings]);

  const closesForIndicators = useMemo(
    () => candles.map((c) => ({ time: c.time, close: c.close })),
    [candles]
  );

  const maOverlays = useMemo((): MAOverlay[] => {
    if (!showMA || candles.length < 5) return [];
    const MA_CONFIG: { period: number; color: string }[] = [
      { period: 5, color: "#00BCD4" },
      { period: 10, color: "#FFEB3B" },
      { period: 20, color: "#E040FB" },
      { period: 50, color: "#66BB6A" },
      { period: 200, color: "#42A5F5" },
    ];
    return MA_CONFIG
      .filter((m) => candles.length >= m.period)
      .map((m) => ({
        label: `MA${m.period}`,
        data: computeSMA(closesForIndicators, m.period),
        color: m.color,
      }));
  }, [showMA, candles, closesForIndicators]);

  const macdData = useMemo(() => {
    if (!showMACD || candles.length < 35) return [];
    return computeMACD(closesForIndicators);
  }, [showMACD, candles, closesForIndicators]);

  const rsiData = useMemo(() => {
    if (!showRSI || candles.length < 20) return [];
    return computeRSI(closesForIndicators);
  }, [showRSI, candles, closesForIndicators]);

  // ── Live watchlist price polling (30s interval, same cycle as chart) ────
  const watchlistSymbols = useMemo(
    () => flattenWatchlist(watchlist).map((i) => i.symbol),
    [watchlist]
  );

  const { data: liveWatchlistPrices } = useQuery({
    queryKey: ["watchlist-live-prices", watchlistSymbols],
    queryFn: async () => {
      // Single batch call instead of N concurrent chart-data fetches.
      const raw = await liveApi.watchlistPrices(watchlistSymbols);
      const prices: Record<string, { close: number; change: number; changePct: number }> = {};
      for (const [sym, data] of Object.entries(raw)) {
        prices[sym] = {
          close: data.price,
          change: data.change,
          changePct: data.changePercent,
        };
      }
      return prices;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: watchlistSymbols.length > 0 && !!user,
  });

  // ── Real-time quote streaming (Alpaca WebSocket → SSE) ──────────────────
  // Only subscribes to plain US equity/ETF symbols (Alpaca-supported).
  // Falls back silently to the 30s polling data when stream is unavailable.
  const streamSymbols = useMemo(
    () => watchlistSymbols.filter((s) => /^[A-Z]{1,5}$/.test(s)).slice(0, 10),
    [watchlistSymbols]
  );
  const { quotes: streamQuotes, status: streamStatus } = useMarketStream(
    user ? streamSymbols : []
  );

  // Merge live prices into watchlist items for display (does not touch localStorage)
  // Stream data (bid/ask/last) takes priority over REST polling close price.
  const allItems = useMemo(() => {
    const base = flattenWatchlist(watchlist).map((item) => ({ ...item, price: 0, change: 0, changePct: 0 }));
    if (!liveWatchlistPrices && !Object.keys(streamQuotes).length) return base;
    return base.map((item) => {
      const stream = streamQuotes[item.symbol];
      const poll = liveWatchlistPrices?.[item.symbol];
      // Prefer streaming last price, fall back to polling close
      const price = stream?.last ?? poll?.close ?? item.price;
      const change = poll?.change ?? item.change;
      const changePct = poll?.changePct ?? item.changePct;
      if (!stream && !poll) return item;
      return {
        ...item,
        price,
        change,
        changePct,
        color: (change ?? 0) >= 0 ? "#26a69a" : "#ef5350",
      };
    });
  }, [watchlist, liveWatchlistPrices, streamQuotes]);

  const selectedItem = allItems.find((i) => i.symbol === symbol) ?? { symbol, name: symbol, price: 0, change: 0, changePct: 0, color: "" };

  const handleSelectSymbol = useCallback((s: string) => {
    updateSelection({ symbol: s });
  }, [updateSelection]);

  // ── Price flash ─────────────────────────────────────────────────────────
  const prevPriceRef = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"green" | "red" | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  // Key to force CSS animation restart on each data refresh
  const [priceTickKey, setPriceTickKey] = useState(0);

  useEffect(() => {
    if (!lastCandle) return;
    const current = lastCandle.close;
    const prev = prevPriceRef.current;
    if (prev !== null && prev !== current) {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      setPriceFlash(current > prev ? "green" : "red");
      setPriceTickKey((k) => k + 1);
      flashTimerRef.current = window.setTimeout(() => setPriceFlash(null), 1400);
    }
    prevPriceRef.current = current;
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, [lastCandle]);

  // ── Countdown to next chart refresh ─────────────────────────────────────
  const [countdown, setCountdown] = useState(30);
  const countdownStartRef = useRef<number>(Date.now());

  useEffect(() => {
    // Reset countdown each time chart data arrives
    countdownStartRef.current = Date.now();
    setCountdown(30);
  }, [chartPayload]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - countdownStartRef.current) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setCountdown(remaining);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Overview">
    <div className="flex h-[calc(100dvh-11rem)] min-h-[480px] overflow-hidden bg-surface-lowest lg:h-[calc(100dvh-5rem)]">
      {/* Terminal animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: TERMINAL_ANIM_STYLES }} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* ── Top toolbar (40px) — Sovereign Terminal header ────────────── */}
        <ChartToolbar selection={selection} onSelection={patch => { setActivePeriod(null); updateSelection(patch); }} items={allItems}
          preferences={preferences} onPreferences={setPreferences} drawingMode={drawingMode}
          onDrawingMode={toggleDrawingMode} onClearDrawings={clearAllDrawings} hasDrawings={drawings.length > 0}
          onWatchlist={() => setMobileWatchlistOpen(true)} />
        {(watchlistLoading || watchlistError) && <div className="px-3 py-2 text-sm" role={watchlistError ? "alert" : "status"}>
          {watchlistError ? <>Watchlist could not be loaded. <button className="underline" onClick={() => void refetchWatchlist()}>Retry</button></> : "Loading shared watchlist..."}
        </div>}

        {/* ── KPI cards + recent runs ───────────────────────────────────── */}
        <KpiCardsPanel />

        {/* ── Main content (chart + watchlist) ─────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Chart panel ───────────────────────────────────────────── */}
          <div className="relative flex flex-col flex-1 min-w-0 border-r border-border/10">

            {/* Price ticker + OHLCV header bar */}
            <div
              className={cn(
                "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 h-8 shrink-0 border-b border-border/10 bg-surface-low text-[11px] font-mono overflow-x-auto",
                priceFlash === "green" && "price-flash-green",
                priceFlash === "red"   && "price-flash-red"
              )}
            >
              {/* Blinking LIVE indicator */}
              <span className="flex items-center gap-1 shrink-0">
                <span className="text-primary animate-pulse text-[10px] leading-none">●</span>
                <span className="text-3xs text-primary/70 font-bold uppercase tracking-widest">Chart</span>
              </span>

              <span className="text-primary font-bold text-sm sm:text-[13px] shrink-0 tracking-tight">
                {chartSymbol}
              </span>
              {lastCandle && (
                <span
                  key={priceTickKey}
                  className={cn(
                    "font-bold text-base sm:text-[13px] tabular-nums shrink-0",
                    priceFlash === "green" ? "price-tick-up" : priceFlash === "red" ? "price-tick-down" : ""
                  )}
                  style={{ color: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                >
                  {formatPrice(lastCandle.close, chartSymbol)}
                </span>
              )}
              {priceChange !== null && pricePct !== null && (
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                >
                  {isPositive ? "+" : ""}{pricePct.toFixed(2)}%
                </span>
              )}
              {/* OHLC values — hidden on mobile */}
              {lastCandle && (
                <span className="hidden sm:contents text-3xs">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    O&nbsp;<span className="text-foreground tabular-nums">{lastCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    H&nbsp;<span className="text-foreground tabular-nums">{lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    L&nbsp;<span className="text-foreground tabular-nums">{lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    C&nbsp;<span className="text-foreground tabular-nums">{lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                </span>
              )}
              {/* Bid / Ask from stream (Alpaca supported symbols only) */}
              {streamStatus === "live" && streamQuotes[chartSymbol] && (
                <span className="hidden sm:contents text-3xs">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    B&nbsp;<span className="text-[#26a69a] tabular-nums">
                      {streamQuotes[chartSymbol]?.bid?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    A&nbsp;<span className="text-[#ef5350] tabular-nums">
                      {streamQuotes[chartSymbol]?.ask?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                  {(() => {
                    const spread = getSpread(streamQuotes[chartSymbol]);
                    return spread != null ? (
                      <span className="text-muted-foreground uppercase tracking-widest">
                        Spd&nbsp;<span className="text-foreground/70 tabular-nums">{spread.toFixed(2)}</span>
                      </span>
                    ) : null;
                  })()}
                </span>
              )}
              {candles.length === 0 && (
                <span className="text-3xs text-muted-foreground uppercase tracking-widest">Loading...</span>
              )}
            </div>

            {/* MA overlay labels */}
            {showMA && maOverlays.length > 0 && (
              <div className="flex items-center gap-3 px-3 h-5 shrink-0 bg-surface-lowest/80 text-3xs font-mono overflow-x-auto">
                {maOverlays.map((ma) => {
                  const lastVal = ma.data[ma.data.length - 1];
                  return lastVal ? (
                    <span key={ma.label} style={{ color: ma.color }}>
                      {ma.label}:{lastVal.value.toFixed(2)}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Chart fills remaining height */}
            <div className="flex-1 min-h-0 bg-surface-lowest" style={{ minHeight: 200 }}>
              {candles.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <span className="text-3xs text-muted-foreground uppercase tracking-widest animate-pulse">Loading chart data...</span>
                </div>
              ) : (
                <PriceChartFill
                  data={candles}
                  theme={theme}
                  drawingMode={drawingMode}
                  drawings={allDrawings}
                  onChartClick={handleChartClick}
                  bollingerData={showBollinger ? (chartPayload?.bollinger ?? undefined) : undefined}
                  maOverlays={showMA ? maOverlays : undefined}
                  scale={chartScale}
                />
              )}
            </div>

            {/* ── Bottom timeline bar (period range + chart options) ─── */}
            <div className="flex items-center h-8 shrink-0 border-t border-border/10 bg-surface-low px-1.5 sm:px-3 gap-0 sm:gap-1">
              {/* Period range buttons */}
              <div className="flex items-center gap-0">
                {PERIOD_RANGES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePeriodSelect(p)}
                    className={cn(
                      "px-1.5 sm:px-2 py-0.5 text-[11px] font-medium transition-colors",
                      activePeriod === p.label
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Right chart options */}
              <div className="hidden sm:flex items-center gap-0 text-[11px]">
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Adj</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Night</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Ext</span>
                <button
                  onClick={() => setChartScale((s) => s === "linear" ? "log" : "linear")}
                  className="px-1.5 py-0.5 text-3xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  {chartScale === "linear" ? "Linear" : "Log"} ▾
                </button>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Auto</span>
              </div>
            </div>

            {/* ── Terminal refresh status bar ────────────────────────── */}
            <div className="shrink-0 bg-surface-lowest border-t border-border/5">
              {/* Label row */}
              <div className="flex items-center justify-between px-3 pt-1 pb-0.5">
                <span className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">
                  NEXT REFRESH
                </span>
                <span
                  className={cn(
                    "text-sm font-black font-mono tabular-nums leading-none",
                    countdown <= 3 ? "text-amber-400 refresh-pulse" : "text-primary"
                  )}
                >
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </div>
              {/* Animated progress bar */}
              <div className="h-[3px] w-full bg-surface-mid relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: "100%",
                    transformOrigin: "left",
                    transform: `scaleX(${countdown / 30})`,
                    backgroundColor: countdown <= 3 ? "#f59e0b" : "#44DFA3",
                    boxShadow: countdown <= 3
                      ? "0 0 8px #f59e0baa"
                      : "0 0 8px #44DFA3aa",
                    transition: "transform 1s linear, background-color 0.3s ease, box-shadow 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* MACD sub-chart */}
            {showMACD && macdData.length > 0 && candles.length > 0 && (
              <MACDChart data={macdData} height={100} theme={theme} />
            )}

            {/* RSI sub-chart */}
            {showRSI && rsiData.length > 0 && candles.length > 0 && (
              <RSIChart data={rsiData} height={80} theme={theme} />
            )}

            {/* News panel */}
            {showNews && (
              <NewsPanel
                ticker={chartSymbol}
                isMaximized={newsMaximized}
                onToggleMaximize={() => setNewsMaximized((v) => !v)}
              />
            )}
          </div>

          {/* ── Watchlist panel (320px desktop) ──────────────────────── */}
          {showWatchlist && (
            <div
              className="hidden md:flex flex-col shrink-0 bg-surface-low overflow-hidden border-l border-border/10"
              style={{ width: 320 }}
            >
              {/* Quote panel — selected symbol large price */}
              {selectedItem && <QuotePanel item={selectedItem} lastCandle={lastCandle} />}

              {/* Watchlist header */}
              <div className="flex items-center px-3 h-8 shrink-0 border-b border-border/10 bg-surface-lowest/60">
                <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex-1">Watchlist</span>
                {/* Stream connection status badge */}
                <span
                  title={`Stream: ${streamStatus}`}
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest mr-2 px-1.5 py-0.5 rounded-sm",
                    streamStatus === "live"
                      ? "text-[#44DFA3] bg-[#44DFA3]/10"
                      : streamStatus === "yfinance_fallback"
                      ? "text-orange-400 bg-orange-400/10"
                      : streamStatus === "connecting" || streamStatus === "reconnecting"
                      ? "text-yellow-400 bg-yellow-400/10 animate-pulse"
                      : streamStatus === "unconfigured"
                      ? "hidden"
                      : "text-muted-foreground bg-surface-mid"
                  )}
                >
                  {streamStatus === "live"
                    ? "● LIVE"
                    : streamStatus === "yfinance_fallback"
                    ? "◐ yfinance"
                    : streamStatus === "connecting"
                    ? "○ connecting"
                    : streamStatus === "reconnecting"
                    ? "○ reconnecting"
                    : streamStatus === "error"
                    ? "○ error"
                    : null}
                </span>
                <button
                  onClick={() => setIsEditingWatchlist((v) => !v)}
                  className={cn(
                    "transition-colors px-2 py-0.5 rounded-sm text-3xs uppercase tracking-widest font-bold",
                    isEditingWatchlist
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                  )}
                  title={isEditingWatchlist ? "Done editing" : "Edit watchlist"}
                >
                  {isEditingWatchlist ? "Done" : "Edit"}
                </button>
              </div>

              {/* Scrollable watchlist — rendered as a table for alignment */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-lowest/40">
                      <th className="px-2 py-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground">Symbol</th>
                      <th className="px-2 py-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground text-right">Price / Chg%</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    <WatchlistSection
                      title="Indices"
                      items={watchlist.indices.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)}
                      selectedSymbol={symbol}
                      isEditing={isEditingWatchlist}
                      onSelect={handleSelectSymbol}
                      onRemove={removeFromWatchlist}
                      onAdd={(sym) => addToWatchlist("indices", sym)}
                    />
                    <WatchlistSection
                      title="Stocks"
                      items={watchlist.stocks.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)}
                      selectedSymbol={symbol}
                      isEditing={isEditingWatchlist}
                      onSelect={handleSelectSymbol}
                      onRemove={removeFromWatchlist}
                      onAdd={(sym) => addToWatchlist("stocks", sym)}
                    />
                    <WatchlistSection
                      title="Crypto"
                      items={watchlist.crypto.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)}
                      selectedSymbol={symbol}
                      isEditing={isEditingWatchlist}
                      onSelect={handleSelectSymbol}
                      onRemove={removeFromWatchlist}
                      onAdd={(sym) => addToWatchlist("crypto", sym)}
                    />
                    {(watchlist.custom.length > 0 || isEditingWatchlist) && (
                      <WatchlistSection
                        title="Custom"
                        items={watchlist.custom.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)}
                        selectedSymbol={symbol}
                        isEditing={isEditingWatchlist}
                        onSelect={handleSelectSymbol}
                        onRemove={removeFromWatchlist}
                        onAdd={(sym) => addToWatchlist("custom", sym)}
                      />
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Symbol shortcut */}
              <div className="shrink-0 border-t border-border/10 p-2 bg-surface-lowest/60">
                <button
                  onClick={() => setIsEditingWatchlist(true)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-foreground hover:bg-surface-mid transition-colors"
                >
                  <Search className="h-3 w-3" />
                  Add Symbol
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom status bar — Sovereign Terminal footer ─────────────── */}
        <div className="hidden lg:flex shrink-0 items-center h-6 px-3 border-t border-border/10 bg-surface-lowest text-3xs text-muted-foreground uppercase tracking-widest gap-3 z-10">
          <span>Chart workspace</span>
          <div className="flex-1" />
          <DashboardUserStatus />
        </div>
      </div>

      {/* ── Mobile watchlist sheet ──────────────────────────────────────── */}
      <Sheet open={mobileWatchlistOpen} onOpenChange={setMobileWatchlistOpen}>
        <SheetContent side="right" className="w-[300px] p-0 md:hidden">
          <SheetTitle className="sr-only">Watchlist</SheetTitle><SheetDescription className="sr-only">Choose a symbol to view its chart</SheetDescription>
          <div className="flex flex-col h-full bg-surface-low">
            <div className="flex items-center px-3 h-8 shrink-0 border-b border-border/10 bg-surface-lowest/60">
              <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex-1">Watchlist</span>
              <button
                onClick={() => setIsEditingWatchlist((v) => !v)}
                className={cn(
                  "mr-2 transition-colors",
                  isEditingWatchlist ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isEditingWatchlist ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <table className="w-full text-left border-collapse tabular-nums">
                <tbody>
                  <WatchlistSection
                    title="Indices" items={watchlist.indices.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)} selectedSymbol={symbol}
                    isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                    onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("indices", sym)}
                  />
                  <WatchlistSection
                    title="Stocks" items={watchlist.stocks.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)} selectedSymbol={symbol}
                    isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                    onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("stocks", sym)}
                  />
                  <WatchlistSection
                    title="Crypto" items={watchlist.crypto.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)} selectedSymbol={symbol}
                    isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                    onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("crypto", sym)}
                  />
                  {(watchlist.custom.length > 0 || isEditingWatchlist) && (
                    <WatchlistSection
                      title="Custom" items={watchlist.custom.map((item) => allItems.find((live) => live.symbol === item.symbol) ?? item)} selectedSymbol={symbol}
                      isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                      onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("custom", sym)}
                    />
                  )}
                </tbody>
              </table>
            </div>
            {selectedItem && <QuotePanel item={selectedItem} lastCandle={lastCandle} />}
          </div>
        </SheetContent>
      </Sheet>

    </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return <Suspense fallback={<p role="status">Loading chart...</p>}><DashboardContent /></Suspense>;
}
