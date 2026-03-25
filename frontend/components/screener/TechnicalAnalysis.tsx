"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
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
  if (rec.includes("BUY")) return "text-bull";
  if (rec.includes("SELL")) return "text-bear";
  return "text-muted-foreground";
}

function recBg(rec: string) {
  if (rec.includes("BUY")) return "bg-bull/10 border-bull/30";
  if (rec.includes("SELL")) return "bg-bear/10 border-bear/30";
  return "bg-secondary border-border";
}

function SignalIcon({ signal }: { signal?: string }) {
  if (signal === "BUY") return <TrendingUp className="h-3 w-3 text-bull" />;
  if (signal === "SELL") return <TrendingDown className="h-3 w-3 text-bear" />;
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
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden bg-secondary">
        <div
          className="bg-bull transition-all"
          style={{ width: `${buyPct}%` }}
        />
        <div
          className="bg-muted-foreground/40 transition-all"
          style={{ width: `${neutralPct}%` }}
        />
        <div
          className="bg-bear transition-all"
          style={{ width: `${sellPct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-bull font-medium">{buys} Buy</span>
        <span className="text-muted-foreground">{neutrals} Neutral</span>
        <span className="text-bear font-medium">{sells} Sell</span>
      </div>
    </div>
  );
}

function IndicatorTable({
  indicators,
  title,
}: {
  indicators: TAIndicator[];
  title: string;
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {indicators.map((ind) => (
          <div
            key={ind.name}
            className="flex items-center justify-between py-1 px-2 rounded hover:bg-secondary/50"
          >
            <div className="flex items-center gap-2">
              <SignalIcon signal={ind.signal} />
              <span className="text-xs">{ind.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                {typeof ind.value === "number"
                  ? ind.value.toFixed(2)
                  : (ind.value ?? "\u2014")}
              </span>
              <Badge
                variant={
                  ind.signal === "BUY"
                    ? "bull"
                    : ind.signal === "SELL"
                    ? "bear"
                    : "secondary"
                }
                className="text-[9px] px-1 h-4 min-w-[36px] justify-center"
              >
                {ind.signal ?? "\u2014"}
              </Badge>
            </div>
          </div>
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
      <Card className="border-border bg-card">
        <CardContent className="py-16 text-center">
          <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Select an asset to view technical analysis
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Click any row in the screener results
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result) return null;

  const rec = result.recommendation;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {result.symbol}
            <span className="text-xs text-muted-foreground font-normal">
              @ {result.exchange}
            </span>
          </CardTitle>
        </div>
        {/* Timeframe selector */}
        <div className="flex gap-1 mt-2">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf.value}
              variant={currentTimeframe === tf.value ? "default" : "outline"}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => onTimeframeChange(tf.value)}
            >
              {tf.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation badge */}
        <div className={cn("rounded-lg border p-3 text-center", recBg(rec))}>
          <div className={cn("text-lg font-bold", recColor(rec))}>
            {rec.replace("_", " ")}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Overall Recommendation &bull; {result.timeframe}
          </div>
        </div>

        {/* Gauge */}
        <GaugeBar
          buys={result.buy_count}
          sells={result.sell_count}
          neutrals={result.neutral_count}
        />

        <Separator />

        {/* Indicator tabs */}
        <Tabs defaultValue="oscillators">
          <TabsList className="w-full h-8">
            <TabsTrigger value="oscillators" className="text-xs flex-1">
              Oscillators
            </TabsTrigger>
            <TabsTrigger value="moving_averages" className="text-xs flex-1">
              Moving Averages
            </TabsTrigger>
            {result.volume_data && (
              <TabsTrigger value="volume" className="text-xs flex-1">
                Volume
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="oscillators" className="mt-3">
            <IndicatorTable
              indicators={result.oscillators ?? []}
              title="Oscillators"
            />
          </TabsContent>
          <TabsContent value="moving_averages" className="mt-3">
            <IndicatorTable
              indicators={result.moving_averages ?? []}
              title="Moving Averages"
            />
          </TabsContent>
          {result.volume_data && (
            <TabsContent value="volume" className="mt-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Volume Ratio</span>
                  <span className="font-mono">
                    {result.volume_data.volume_ratio}x
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Price Change</span>
                  <span
                    className={cn(
                      "font-mono",
                      (result.volume_data.price_change ?? 0) >= 0
                        ? "text-bull"
                        : "text-bear"
                    )}
                  >
                    {result.volume_data.price_change}%
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2 p-2 bg-secondary/50 rounded">
                  {result.volume_data.confirmation}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
