"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { MACDPoint } from "@/lib/indicators";

interface MACDChartProps {
  data: MACDPoint[];
  height?: number;
  theme?: "dark" | "light";
}

const THEMES = {
  dark: {
    gridColor: "#1a1e2e",
    textColor: "#6b7280",
    crosshairColor: "#4b5563",
    crosshairLabelBg: "#1f2937",
    scaleColor: "#2a2f3e",
  },
  light: {
    gridColor: "#f1f5f9",
    textColor: "#94a3b8",
    crosshairColor: "#94a3b8",
    crosshairLabelBg: "#f8fafc",
    scaleColor: "#e2e8f0",
  },
} as const;

export function MACDChart({ data, height = 100, theme = "dark" }: MACDChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    const colors = THEMES[theme];

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: colors.textColor,
        fontSize: 10,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: colors.crosshairColor, labelBackgroundColor: colors.crosshairLabelBg },
        horzLine: { color: colors.crosshairColor, labelBackgroundColor: colors.crosshairLabelBg },
      },
      rightPriceScale: { borderColor: colors.scaleColor },
      timeScale: { borderColor: colors.scaleColor, timeVisible: true, secondsVisible: false, visible: false },
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Deduplicate and sort ascending by time
    const sorted = [...data]
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

    // Histogram
    const histSeries = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    histSeries.setData(
      sorted.map((d) => ({
        time: d.time as Time,
        value: d.histogram,
        color: d.histogram >= 0 ? "rgba(38,166,154,0.6)" : "rgba(239,83,80,0.6)",
      }))
    );

    // MACD line
    const macdSeries = chart.addSeries(LineSeries, {
      color: "#2962FF",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    macdSeries.setData(
      sorted.map((d) => ({ time: d.time as Time, value: d.macd }))
    );

    // Signal line
    const signalSeries = chart.addSeries(LineSeries, {
      color: "#FF6D00",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    signalSeries.setData(
      sorted.map((d) => ({ time: d.time as Time, value: d.signal }))
    );

    chart.timeScale().fitContent();

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
    };
  }, [data, height, theme]);

  if (data.length === 0) return null;

  const last = data[data.length - 1];

  return (
    <div className="w-full border-t border-border">
      <div className="flex items-center gap-3 px-3 h-5 text-[10px] font-mono bg-card/50">
        <span className="text-muted-foreground">MACD(12,26,9)</span>
        <span style={{ color: "#2962FF" }}>MACD:{last.macd.toFixed(2)}</span>
        <span style={{ color: "#FF6D00" }}>Signal:{last.signal.toFixed(2)}</span>
        <span className="text-muted-foreground">Histogram:{last.histogram.toFixed(2)}</span>
      </div>
      <div ref={containerRef} className="w-full overflow-hidden" />
    </div>
  );
}
