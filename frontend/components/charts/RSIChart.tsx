"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";
import type { RSIPoint } from "@/lib/indicators";

interface RSIChartProps {
  data: RSIPoint[];
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

export function RSIChart({ data, height = 80, theme = "dark" }: RSIChartProps) {
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
      rightPriceScale: {
        borderColor: colors.scaleColor,
        autoScale: false,
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: { borderColor: colors.scaleColor, timeVisible: true, secondsVisible: false },
      width: containerRef.current.clientWidth,
      height,
    });
    chartRef.current = chart;

    // Deduplicate and sort ascending by time
    const sorted = [...data]
      .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
      .filter((d, i, arr) => i === 0 || d.time !== arr[i - 1].time);

    // Overbought line (70)
    const obSeries = chart.addSeries(LineSeries, {
      color: "rgba(239,83,80,0.4)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    obSeries.setData(
      sorted.map((d) => ({ time: d.time as Time, value: 70 }))
    );

    // Oversold line (30)
    const osSeries = chart.addSeries(LineSeries, {
      color: "rgba(38,166,154,0.4)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    osSeries.setData(
      sorted.map((d) => ({ time: d.time as Time, value: 30 }))
    );

    // RSI line
    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#AB47BC",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    rsiSeries.setData(
      sorted.map((d) => ({ time: d.time as Time, value: d.value }))
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
        <span className="text-muted-foreground">RSI(14)</span>
        <span style={{ color: "#AB47BC" }}>RSI:{last.value.toFixed(2)}</span>
        <span className="text-muted-foreground/60">70.00</span>
        <span className="text-muted-foreground/60">30.00</span>
      </div>
      <div ref={containerRef} className="w-full overflow-hidden" />
    </div>
  );
}
