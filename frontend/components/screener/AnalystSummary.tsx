"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      color: "text-bull",
      description:
        "Multiple indicators align on a bullish signal. Historically favorable conditions are present across oscillators and moving averages.",
    };
  if (rec === "BUY")
    return {
      label: "Moderately Bullish",
      icon: CheckCircle,
      color: "text-bull",
      description:
        "A majority of indicators lean bullish. The setup shows historically favorable momentum with some neutral readings.",
    };
  if (rec === "SELL")
    return {
      label: "Moderately Bearish",
      icon: XCircle,
      color: "text-bear",
      description:
        "A majority of indicators lean bearish. Current momentum and trend metrics suggest caution.",
    };
  if (rec === "STRONG_SELL")
    return {
      label: "Bearish",
      icon: XCircle,
      color: "text-bear",
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Analyst Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Bias */}
        <div className="flex items-start gap-3">
          <BiasIcon className={cn("h-5 w-5 mt-0.5 shrink-0", bias.color)} />
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("font-medium text-sm", bias.color)}>
                {bias.label}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {taResult.timeframe}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {bias.description}
            </p>
          </div>
        </div>

        {/* Why it appeared */}
        <div className="p-2.5 bg-secondary/50 rounded-md space-y-1.5">
          <p className="text-xs">
            <span className="text-muted-foreground">Screener: </span>
            <span className="font-medium">{selectedAsset.symbol}</span>
            {" appeared because it is "}
            <span
              className={cn(
                "font-medium",
                isUp ? "text-bull" : "text-bear"
              )}
            >
              {isUp ? "up" : "down"}{" "}
              {Math.abs(selectedAsset.change_pct ?? 0).toFixed(2)}%
            </span>
            {selectedAsset.rsi && (
              <>
                {" "}with RSI at{" "}
                <span className="font-medium">
                  {selectedAsset.rsi.toFixed(1)}
                </span>
              </>
            )}
            {selectedAsset.sector && (
              <>
                {" "}in the{" "}
                <span className="font-medium">{selectedAsset.sector}</span>{" "}
                sector
              </>
            )}
            .
          </p>
          <p className="text-xs">
            <span className="text-muted-foreground">TA: </span>
            {taResult.buy_count} of{" "}
            {taResult.buy_count + taResult.sell_count + taResult.neutral_count}{" "}
            indicators signal Buy, {taResult.sell_count} signal Sell.
            {taResult.volume_data?.confirmation && (
              <> {taResult.volume_data.confirmation}.</>
            )}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/5 border border-yellow-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Technical analysis is informational only and not financial advice.
            Past patterns do not guarantee future results. Always conduct your
            own research before making investment decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
