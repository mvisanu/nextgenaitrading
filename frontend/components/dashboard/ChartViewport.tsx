"use client";

import { useEffect,useRef,useState } from "react";

import { type DrawingData } from "@/components/charts/DrawingPrimitives";
import { PriceChart,type ChartClickPoint,type DrawingMode,type MAOverlay } from "@/components/charts/PriceChart";


import type { CandleBar } from "@/types";


export function PriceChartFill({
  data,
  theme,
  drawingMode,
  drawings,
  onChartClick,
  bollingerData,
  maOverlays,
  scale,
}: {
  data: CandleBar[];
  theme: "dark" | "light";
  drawingMode?: DrawingMode;
  drawings?: DrawingData[];
  onChartClick?: (point: ChartClickPoint) => void;
  bollingerData?: import("@/types").BollingerOverlayBar[];
  maOverlays?: MAOverlay[];
  scale?: "linear" | "log";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    ro.observe(wrapRef.current);
    setHeight(wrapRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <PriceChart
        data={data}
        height={height}
        theme={theme}
        drawingMode={drawingMode}
        drawings={drawings}
        onChartClick={onChartClick}
        bollingerData={bollingerData}
        maOverlays={maOverlays}
        scale={scale}
      />
    </div>
  );
}

// ─── Sovereign Terminal Watchlist Row ────────────────────────────────────────
// Two-column layout: symbol + price on left, change % on right.
// Active row gets green left-border accent per Sovereign Terminal spec.
