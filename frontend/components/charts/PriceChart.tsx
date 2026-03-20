"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
} from "lightweight-charts";
import type { CandleBar, SignalMarker } from "@/types";

interface PriceChartProps {
  data: CandleBar[];
  signals?: SignalMarker[];
  symbol?: string;
  height?: number;
}

export function PriceChart({
  data,
  signals = [],
  symbol,
  height = 400,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#888888",
      },
      grid: {
        vertLines: { color: "#1f1f1f" },
        horzLines: { color: "#1f1f1f" },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: "#1f1f1f",
      },
      timeScale: {
        borderColor: "#1f1f1f",
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    candleSeries.setData(
      data.map((d) => ({
        time: d.time as import("lightweight-charts").Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    // Signal markers
    if (signals.length > 0) {
      candleSeries.setMarkers(
        signals.map((s) => ({
          time: s.time as import("lightweight-charts").Time,
          position: s.position,
          color: s.color,
          shape: s.shape,
          text: s.text,
        }))
      );
    }

    // Volume histogram series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#378ADD",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    volumeSeries.setData(
      data
        .filter((d) => d.volume !== undefined)
        .map((d) => ({
          time: d.time as import("lightweight-charts").Time,
          value: d.volume ?? 0,
          color: d.close >= d.open ? "#22c55e44" : "#ef444444",
        }))
    );

    chart.timeScale().fitContent();

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
    };
  }, [data, signals, height]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
        style={{ height }}
      >
        No chart data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {symbol && (
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          {symbol}
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
    </div>
  );
}
