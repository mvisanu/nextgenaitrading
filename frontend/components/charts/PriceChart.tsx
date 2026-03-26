"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { CandleBar, SignalMarker, BollingerOverlayBar } from "@/types";
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
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const drawingModeRef = useRef(drawingMode);
  const onChartClickRef = useRef(onChartClick);

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

  // Re-create the chart when data, signals, height, or theme changes
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

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

    // Candlestick series — green/red with theme awareness
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderUpColor: colors.upColor,
      borderDownColor: colors.downColor,
      wickUpColor: colors.upWick,
      wickDownColor: colors.downWick,
    });

    // Sort by time ascending and deduplicate (Lightweight Charts requires unique asc times)
    const sorted = [...data]
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

    candleSeries.setData(
      sorted.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Signal markers (lightweight-charts v5 API) — must also be sorted asc
    if (signals.length > 0) {
      const sortedSignals = [...signals]
        .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      createSeriesMarkers(
        candleSeries,
        sortedSignals.map((s) => ({
          time: s.time as Time,
          position: s.position,
          color: s.color,
          shape: s.shape,
          text: s.text,
        }))
      );
    }

    // Volume histogram — soft semi-transparent bars
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: colors.volUp,
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    volumeSeries.setData(
      sorted
        .filter((d) => d.volume !== undefined)
        .map((d) => ({
          time: d.time as Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? colors.volUp : colors.volDown,
        }))
    );

    // ── Bollinger Band overlay ──────────────────────────────────────────
    if (bollingerData && bollingerData.length > 0) {
      const bbSorted = [...bollingerData].sort((a, b) =>
        a.time < b.time ? -1 : a.time > b.time ? 1 : 0
      );

      // Upper band — semi-transparent line
      const upperSeries = chart.addSeries(LineSeries, {
        color: "rgba(33, 150, 243, 0.6)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      upperSeries.setData(
        bbSorted.map((b) => ({ time: b.time as Time, value: b.upper }))
      );

      // Lower band
      const lowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(33, 150, 243, 0.6)",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      lowerSeries.setData(
        bbSorted.map((b) => ({ time: b.time as Time, value: b.lower }))
      );

      // Middle band — dashed style via lighter color
      const middleSeries = chart.addSeries(LineSeries, {
        color: "rgba(33, 150, 243, 0.3)",
        lineWidth: 1,
        lineStyle: 2, // dashed
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      middleSeries.setData(
        bbSorted.map((b) => ({ time: b.time as Time, value: b.middle }))
      );

      // Squeeze highlight — color the upper/lower bands orange where squeeze is active
      const squeezeUpper = chart.addSeries(LineSeries, {
        color: "rgba(255, 152, 0, 0.9)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const squeezeLower = chart.addSeries(LineSeries, {
        color: "rgba(255, 152, 0, 0.9)",
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      // Only set data for squeeze bars (gaps will break the line = desired effect)
      const squeezeOnly = bbSorted.filter((b) => b.is_squeeze);
      if (squeezeOnly.length > 0) {
        squeezeUpper.setData(
          squeezeOnly.map((b) => ({ time: b.time as Time, value: b.upper }))
        );
        squeezeLower.setData(
          squeezeOnly.map((b) => ({ time: b.time as Time, value: b.lower }))
        );
      }
    }

    chart.timeScale().fitContent();

    // ── Click handler for drawing mode ──────────────────────────────────
    chart.subscribeClick((param: MouseEventParams<Time>) => {
      if (drawingModeRef.current === "none") return;
      if (!param.time || !param.point) return;

      // Get the price at the click y-coordinate
      const price = candleSeries.coordinateToPrice(param.point.y);
      if (price === null) return;

      const timeStr =
        typeof param.time === "number"
          ? String(param.time)
          : String(param.time);

      onChartClickRef.current?.({ time: timeStr, price });
    });

    // ── Attach drawing primitives ────────────────────────────────────────
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
      // chart.remove() detaches all primitives automatically
      chart.remove();
      ro.disconnect();
      chartRef.current = null;
    };
  }, [data, signals, height, theme, drawings, bollingerData]);

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
