"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { CandleBar, SignalMarker, BollingerOverlayBar } from "@/types";
import type { MAPoint } from "@/lib/indicators";
import {
  TrendLinePrimitive,
  FVGBoxPrimitive,
  type DrawingData,
  type TrendLineData,
  type FVGData,
} from "./DrawingPrimitives";

export type DrawingMode = "none" | "trendline" | "fvg";

export interface ChartClickPoint {
  time: string;
  price: number;
}

export interface MAOverlay {
  label: string;
  data: MAPoint[];
  color: string;
}

interface PriceChartProps {
  data: CandleBar[];
  signals?: SignalMarker[];
  symbol?: string;
  height?: number;
  /** "dark" | "light" — controls grid and crosshair colors */
  theme?: "dark" | "light";
  /** Active drawing tool */
  drawingMode?: DrawingMode;
  /** All drawings to render on the chart */
  drawings?: DrawingData[];
  /** Called when user clicks the chart while in a drawing mode */
  onChartClick?: (point: ChartClickPoint) => void;
  /** Bollinger Band overlay data */
  bollingerData?: BollingerOverlayBar[];
  /** Moving average overlays */
  maOverlays?: MAOverlay[];
  /** Price scale mode: "linear" (default) or "log" */
  scale?: "linear" | "log";
}

// Theme-dependent chart colours — refined for readability
const CHART_THEMES = {
  dark: {
    gridColor: "#1a1e2e",
    textColor: "#6b7280",
    crosshairColor: "#4b5563",
    crosshairLabelBg: "#1f2937",
    scaleColor: "#2a2f3e",
    upColor: "#22c55e",
    downColor: "#ef4444",
    upWick: "#22c55e",
    downWick: "#ef4444",
    volUp: "rgba(34,197,94,0.15)",
    volDown: "rgba(239,68,68,0.15)",
  },
  light: {
    gridColor: "#f1f5f9",
    textColor: "#94a3b8",
    crosshairColor: "#94a3b8",
    crosshairLabelBg: "#f8fafc",
    scaleColor: "#e2e8f0",
    upColor: "#16a34a",
    downColor: "#dc2626",
    upWick: "#16a34a",
    downWick: "#dc2626",
    volUp: "rgba(22,163,74,0.12)",
    volDown: "rgba(220,38,38,0.12)",
  },
} as const;

// BB series slot indices (fixed positions in bbSeriesRef array)
const BB_UPPER = 0;
const BB_LOWER = 1;
const BB_MIDDLE = 2;
const BB_SQUEEZE_UPPER = 3;
const BB_SQUEEZE_LOWER = 4;

export function PriceChart({
  data,
  signals = [],
  symbol,
  height = 400,
  theme = "dark",
  drawingMode = "none",
  drawings = [],
  onChartClick,
  bollingerData,
  maOverlays,
  scale = "linear",
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const drawingModeRef = useRef(drawingMode);
  const onChartClickRef = useRef(onChartClick);

  // Series refs — kept stable so data-only updates can call setData() without chart teardown
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // BB: [upper, lower, middle, squeezeUpper, squeezeLower]
  const bbSeriesRef = useRef<(ISeriesApi<"Line"> | null)[]>([null, null, null, null, null]);
  // MA overlays — recreated when overlay count/config changes
  const maSeriesRef = useRef<ISeriesApi<"Line">[]>([]);

  // Keep refs in sync without triggering chart re-creation
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);
  useEffect(() => {
    onChartClickRef.current = onChartClick;
  }, [onChartClick]);

  // Update cursor style when drawing mode changes
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.style.cursor =
      drawingMode !== "none" ? "crosshair" : "";
  }, [drawingMode]);

  // ── Effect 1: Chart structure ────────────────────────────────────────────
  // Recreates the chart instance only when theme, height, or drawings change.
  // Adds all series shells (empty data); Effect 2 populates them.
  useEffect(() => {
    if (!containerRef.current) return;

    const colors = CHART_THEMES[theme];

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: colors.textColor,
        fontSize: 11,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: colors.crosshairColor,
          labelBackgroundColor: colors.crosshairLabelBg,
        },
        horzLine: {
          color: colors.crosshairColor,
          labelBackgroundColor: colors.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: colors.scaleColor,
      },
      timeScale: {
        borderColor: colors.scaleColor,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor: colors.upWick,
      wickDownColor: colors.downWick,
    });
    candleSeriesRef.current = candleSeries;

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.volUp,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Bollinger Band series (always created so refs are stable)
    const bbUpper = chart.addSeries(LineSeries, {
      color: "rgba(33, 150, 243, 0.6)",
      lineWidth: 2,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const bbLower = chart.addSeries(LineSeries, {
      color: "rgba(33, 150, 243, 0.6)",
      lineWidth: 2,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const bbMiddle = chart.addSeries(LineSeries, {
      color: "rgba(33, 150, 243, 0.3)",
      lineWidth: 1,
      lineStyle: 2,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const bbSqUpper = chart.addSeries(LineSeries, {
      color: "rgba(255, 152, 0, 0.9)",
      lineWidth: 3,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const bbSqLower = chart.addSeries(LineSeries, {
      color: "rgba(255, 152, 0, 0.9)",
      lineWidth: 3,
      lineType: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    bbSeriesRef.current = [bbUpper, bbLower, bbMiddle, bbSqUpper, bbSqLower];

    // MA overlay series — created with placeholder count based on MA_CONFIG length
    const MA_CONFIG: { color: string }[] = [
      { color: "#00BCD4" },
      { color: "#FFEB3B" },
      { color: "#E040FB" },
      { color: "#66BB6A" },
      { color: "#42A5F5" },
    ];
    const newMaSeries = MA_CONFIG.map((m) =>
      chart.addSeries(LineSeries, {
        color: m.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
    );
    maSeriesRef.current = newMaSeries;

    // Click handler for drawing mode
    chart.subscribeClick((param: MouseEventParams<Time>) => {
      if (drawingModeRef.current === "none") return;
      if (!param.time || !param.point) return;
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price === null) return;
      const timeStr = String(param.time);
      onChartClickRef.current?.({ time: timeStr, price });
    });

    // Attach drawing primitives
    for (const d of drawings) {
      if (d.type === "trendline") {
        const p = new TrendLinePrimitive(d as TrendLineData);
        candleSeries.attachPrimitive(p as any);
      } else if (d.type === "fvg") {
        const p = new FVGBoxPrimitive(d as FVGData);
        candleSeries.attachPrimitive(p as any);
      }
    }

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      chart.remove();
      ro.disconnect();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      bbSeriesRef.current = [null, null, null, null, null];
      maSeriesRef.current = [];
    };
  }, [theme, height, drawings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect: Price scale mode (linear / log) ──────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    // PriceScaleMode: 0 = Normal, 1 = Logarithmic
    chartRef.current.priceScale("right").applyOptions({ mode: scale === "log" ? 1 : 0 });
  }, [scale]);

  // ── Effect 2: Data update ────────────────────────────────────────────────
  // Runs whenever chart data changes (polling refetch every 30s).
  // Only calls setData() — never destroys the chart instance.
  useEffect(() => {
    const candle = candleSeriesRef.current;
    const volume = volumeSeriesRef.current;
    if (!candle || !volume || data.length === 0) return;

    const colors = CHART_THEMES[theme];

    // Sort and deduplicate
    const sorted = [...data]
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

    candle.setData(
      sorted.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Signal markers
    if (signals.length > 0) {
      const sortedSignals = [...signals].sort((a, b) =>
        a.time < b.time ? -1 : a.time > b.time ? 1 : 0
      );
      createSeriesMarkers(
        candle,
        sortedSignals.map((s) => ({
          time: s.time as Time,
          position: s.position,
          color: s.color,
          shape: s.shape,
          text: s.text,
        }))
      );
    } else {
      // Clear any previous markers
      createSeriesMarkers(candle, []);
    }

    volume.setData(
      sorted
        .filter((d) => d.volume !== undefined)
        .map((d) => ({
          time: d.time as Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? colors.volUp : colors.volDown,
        }))
    );

    // Bollinger Band data
    const [bbUp, bbLo, bbMid, bbSqUp, bbSqLo] = bbSeriesRef.current;
    if (bollingerData && bollingerData.length > 0 && bbUp && bbLo && bbMid && bbSqUp && bbSqLo) {
      const bbSorted = [...bollingerData]
        .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
        .filter((b, i, arr) => i === 0 || b.time !== arr[i - 1].time);

      bbUp.setData(bbSorted.map((b) => ({ time: b.time as Time, value: b.upper })));
      bbLo.setData(bbSorted.map((b) => ({ time: b.time as Time, value: b.lower })));
      bbMid.setData(bbSorted.map((b) => ({ time: b.time as Time, value: b.middle })));

      const squeezeOnly = bbSorted.filter((b) => b.is_squeeze);
      bbSqUp.setData(squeezeOnly.map((b) => ({ time: b.time as Time, value: b.upper })));
      bbSqLo.setData(squeezeOnly.map((b) => ({ time: b.time as Time, value: b.lower })));
    } else if (bbUp && bbLo && bbMid && bbSqUp && bbSqLo) {
      // Clear BB series when overlay is disabled
      bbUp.setData([]);
      bbLo.setData([]);
      bbMid.setData([]);
      bbSqUp.setData([]);
      bbSqLo.setData([]);
    }

    // MA overlay data — map by index (MA_CONFIG order is stable)
    const maSeries = maSeriesRef.current;
    if (maOverlays && maOverlays.length > 0) {
      maOverlays.forEach((ma, idx) => {
        const s = maSeries[idx];
        if (!s || ma.data.length === 0) return;
        const maSorted = [...ma.data]
          .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
          .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);
        s.setData(maSorted.map((d) => ({ time: d.time as Time, value: d.value })));
      });
      // Clear any MA series beyond what's currently active
      for (let i = maOverlays.length; i < maSeries.length; i++) {
        maSeries[i]?.setData([]);
      }
    } else {
      // Clear all MA series when overlay is disabled
      maSeries.forEach((s) => s?.setData([]));
    }

    chartRef.current?.timeScale().fitContent();
  }, [data, signals, bollingerData, maOverlays, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center border border-border bg-card text-muted-foreground text-xs"
        style={{ height }}
      >
        No chart data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {symbol && (
        <div className="mb-1 text-xs font-mono text-muted-foreground">
          {symbol}
        </div>
      )}
      <div ref={containerRef} className="w-full overflow-hidden" />
    </div>
  );
}
