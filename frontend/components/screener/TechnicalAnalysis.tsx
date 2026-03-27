"use client";

import { Activity, BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TAResult, TATimeframe, TAIndicator } from "@/types";

interface TechnicalAnalysisProps {
  result: TAResult | null;
  onTimeframeChange: (tf: TATimeframe) => void;
  currentTimeframe: TATimeframe;
  isLoading?: boolean;
}

const TIMEFRAMES: { value: TATimeframe; label: string }[] = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
];

function recColor(rec: string) {
  if (rec.includes("BUY")) return "text-primary";
  if (rec.includes("SELL")) return "text-destructive";
  return "text-muted-foreground";
}

function recPanelClasses(rec: string) {
  if (rec.includes("BUY")) return "bg-primary/10 border border-primary/20";
  if (rec.includes("SELL")) return "bg-destructive/10 border border-destructive/20";
  return "bg-surface-high border border-white/5";
}

function SignalIcon({ signal }: { signal?: string }) {
  if (signal === "BUY") return <TrendingUp className="h-3 w-3 text-primary" />;
  if (signal === "SELL") return <TrendingDown className="h-3 w-3 text-destructive" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function GaugeBar({
  buys,
  sells,
  neutrals,
}: {
  buys: number;
  sells: number;
  neutrals: number;
}) {
  const total = buys + sells + neutrals;
  if (total === 0) return null;
  const buyPct = (buys / total) * 100;
  const neutralPct = (neutrals / total) * 100;
  const sellPct = (sells / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-high">
        <div
          className="bg-primary transition-all"
          style={{ width: `${buyPct}%` }}
        />
        <div
          className="bg-muted-foreground/30 transition-all"
          style={{ width: `${neutralPct}%` }}
        />
        <div
          className="bg-destructive transition-all"
          style={{ width: `${sellPct}%` }}
        />
      </div>
      <div className="flex justify-between text-3xs font-bold uppercase tracking-wider">
        <span className="text-primary">{buys} Buy</span>
        <span className="text-muted-foreground">{neutrals} Neutral</span>
        <span className="text-destructive">{sells} Sell</span>
      </div>
    </div>
  );
}

function IndicatorRow({ ind }: { ind: TAIndicator }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-high/60 transition-colors">
      <div className="flex items-center gap-2">
        <SignalIcon signal={ind.signal} />
        <span className="text-2xs">{ind.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-3xs font-mono text-muted-foreground">
          {typeof ind.value === "number" ? ind.value.toFixed(2) : (ind.value ?? "\u2014")}
        </span>
        <span
          className={cn(
            "text-3xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
            ind.signal === "BUY"
              ? "bg-primary/20 text-primary"
              : ind.signal === "SELL"
              ? "bg-destructive/20 text-destructive"
              : "bg-surface-high text-muted-foreground"
          )}
        >
          {ind.signal ?? "\u2014"}
        </span>
      </div>
    </div>
  );
}

function IndicatorSection({ indicators, title }: { indicators: TAIndicator[]; title: string }) {
  return (
    <div>
      <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-2">
        {title}
      </p>
      <div className="space-y-0.5">
        {indicators.map((ind) => (
          <IndicatorRow key={ind.name} ind={ind} />
        ))}
      </div>
    </div>
  );
}

export function TechnicalAnalysis({
  result,
  onTimeframeChange,
  currentTimeframe,
  isLoading,
}: TechnicalAnalysisProps) {
  if (!result && !isLoading) {
    return (
      <div className="bg-surface-low border border-white/5 rounded-lg py-16 text-center">
        <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Select an asset to view technical analysis
        </p>
        <p className="text-3xs text-muted-foreground/60 mt-1 uppercase tracking-widest">
          Click any row in the screener results
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-surface-low border border-white/5 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 bg-surface-lowest/60">
          <Skeleton className="h-4 w-32 bg-surface-high/50" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-16 w-full bg-surface-high/50" />
          <Skeleton className="h-4 w-full bg-surface-high/50" />
          <Skeleton className="h-32 w-full bg-surface-high/50" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const rec = result.recommendation;

  return (
    <div className="bg-surface-low border border-white/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-lowest/60">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-bold text-foreground tracking-tight">
            {result.symbol}
          </span>
          <span className="text-3xs text-muted-foreground">
            @ {result.exchange}
          </span>
        </div>
        {/* Timeframe selector */}
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "px-2 py-1 text-3xs font-bold uppercase tracking-wider rounded transition-all",
                currentTimeframe === tf.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Overall recommendation */}
        <div className={cn("rounded-lg p-3 text-center", recPanelClasses(rec))}>
          <div className={cn("text-lg font-black uppercase tracking-tight", recColor(rec))}>
            {rec.replace("_", " ")}
          </div>
          <div className="text-3xs text-muted-foreground mt-0.5 uppercase tracking-widest">
            Overall Recommendation &bull; {result.timeframe}
          </div>
        </div>

        {/* Gauge bar */}
        <GaugeBar
          buys={result.buy_count}
          sells={result.sell_count}
          neutrals={result.neutral_count}
        />

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Tab bar */}
        <div className="border-b border-white/5">
          {/* Using a simple state-free design: show both sections scrollable */}
        </div>

        {/* Oscillators */}
        <IndicatorSection
          indicators={result.oscillators ?? []}
          title="Oscillators"
        />

        {/* Moving averages */}
        <IndicatorSection
          indicators={result.moving_averages ?? []}
          title="Moving Averages"
        />

        {/* Volume data */}
        {result.volume_data && (
          <>
            <div className="border-t border-white/5" />
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-3 px-2">
                Volume Analysis
              </p>
              <div className="space-y-2 px-2">
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">Volume Ratio</span>
                  <span className="font-mono font-bold">
                    {result.volume_data.volume_ratio}x
                  </span>
                </div>
                <div className="flex justify-between text-2xs">
                  <span className="text-muted-foreground">Price Change</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      (result.volume_data.price_change ?? 0) >= 0
                        ? "text-primary"
                        : "text-destructive"
                    )}
                  >
                    {result.volume_data.price_change}%
                  </span>
                </div>
                <div className="text-2xs text-muted-foreground p-2 bg-surface-high/50 rounded">
                  {result.volume_data.confirmation}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
