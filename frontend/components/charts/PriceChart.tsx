"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
  type MouseEventParams,
} from "lightweight-charts";
import type { CandleBar, SignalMarker } from "@/types";
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
}

// Theme-dependent chart colours
const CHART_THEMES = {
  dark: {
    gridColor: "#1e222d",
    textColor: "#787b86",
    crosshairColor: "#555962",
    crosshairLabelBg: "#2a2e39",
    scaleColor: "#363a45",
  },
  light: {
    gridColor: "#e0e3eb",
    textColor: "#787b86",
    crosshairColor: "#9598a1",
    crosshairLabelBg: "#f0f3fa",
    scaleColor: "#d0d3dc",
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

    // Candlestick series — TradingView teal/red palette
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
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

    // Volume histogram — semi-transparent TV teal/red
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a33",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      sorted
        .filter((d) => d.volume !== undefined)
        .map((d) => ({
          time: d.time as Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? "#26a69a33" : "#ef535033",
        }))
    );

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
  }, [data, signals, height, theme, drawings]);

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
