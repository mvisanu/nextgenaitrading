"use client";

import {
  AlertTriangle,
  CheckCircle,
  MinusCircle,
  XCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScreenerRow, TAResult } from "@/types";

interface AnalystSummaryProps {
  selectedAsset: ScreenerRow | null;
  taResult: TAResult | null;
}

interface BiasMeta {
  label: string;
  icon: typeof CheckCircle;
  color: string;
  description: string;
}

function getSetupBias(ta: TAResult): BiasMeta {
  const rec = ta.recommendation;
  if (rec === "STRONG_BUY")
    return {
      label: "Bullish",
      icon: CheckCircle,
      color: "text-primary",
      description:
        "Multiple indicators align on a bullish signal. Historically favorable conditions are present across oscillators and moving averages.",
    };
  if (rec === "BUY")
    return {
      label: "Moderately Bullish",
      icon: CheckCircle,
      color: "text-primary",
      description:
        "A majority of indicators lean bullish. The setup shows historically favorable momentum with some neutral readings.",
    };
  if (rec === "SELL")
    return {
      label: "Moderately Bearish",
      icon: XCircle,
      color: "text-destructive",
      description:
        "A majority of indicators lean bearish. Current momentum and trend metrics suggest caution.",
    };
  if (rec === "STRONG_SELL")
    return {
      label: "Bearish",
      icon: XCircle,
      color: "text-destructive",
      description:
        "Multiple indicators align on a bearish signal. The technical setup suggests unfavorable conditions.",
    };
  return {
    label: "Mixed / Neutral",
    icon: MinusCircle,
    color: "text-muted-foreground",
    description:
      "Indicators are divided. No strong directional bias is present. Consider waiting for clearer confirmation.",
  };
}

export function AnalystSummary({ selectedAsset, taResult }: AnalystSummaryProps) {
  if (!selectedAsset || !taResult) return null;

  const bias = getSetupBias(taResult);
  const BiasIcon = bias.icon;
  const isUp = (selectedAsset.change_pct ?? 0) >= 0;

  return (
    <div className="bg-surface-low border border-white/5 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-lowest/60">
        <Info className="h-3.5 w-3.5 text-primary" />
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          Analyst Summary
        </span>
      </div>

      <div className="p-4 space-y-3">
        {/* Bias row */}
        <div className="flex items-start gap-3">
          <BiasIcon className={cn("h-4 w-4 mt-0.5 shrink-0", bias.color)} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("font-bold text-sm", bias.color)}>
                {bias.label}
              </span>
              <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground border border-white/10 px-1.5 py-0.5 rounded">
                {taResult.timeframe}
              </span>
            </div>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              {bias.description}
            </p>
          </div>
        </div>

        {/* Context panel */}
        <div className="p-3 bg-surface-high/60 rounded space-y-1.5">
          <p className="text-2xs leading-relaxed">
            <span className="text-muted-foreground">Screener: </span>
            <span className="font-bold text-foreground">
              {selectedAsset.symbol}
            </span>
            {" appeared because it is "}
            <span
              className={cn("font-bold", isUp ? "text-primary" : "text-destructive")}
            >
              {isUp ? "up" : "down"}{" "}
              {Math.abs(selectedAsset.change_pct ?? 0).toFixed(2)}%
            </span>
            {selectedAsset.rsi && (
              <>
                {" with RSI at "}
                <span className="font-bold text-foreground">
                  {selectedAsset.rsi.toFixed(1)}
                </span>
              </>
            )}
            {selectedAsset.sector && (
              <>
                {" in the "}
                <span className="font-bold text-foreground">
                  {selectedAsset.sector}
                </span>
                {" sector"}
              </>
            )}
            .
          </p>
          <p className="text-2xs leading-relaxed">
            <span className="text-muted-foreground">TA: </span>
            <span className="text-primary font-bold">{taResult.buy_count}</span>
            {" of "}
            {taResult.buy_count + taResult.sell_count + taResult.neutral_count}
            {" indicators signal Buy, "}
            <span className="text-destructive font-bold">{taResult.sell_count}</span>
            {" signal Sell."}
            {taResult.volume_data?.confirmation && (
              <> {taResult.volume_data.confirmation}.</>
            )}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-2.5 rounded bg-yellow-500/5 border border-yellow-500/15">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500/80 mt-0.5 shrink-0" />
          <p className="text-3xs text-muted-foreground leading-relaxed">
            Technical analysis is informational only and not financial advice.
            Past patterns do not guarantee future results. Always conduct your
            own research before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
