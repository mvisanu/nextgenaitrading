"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, SkipForward, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StrategyBadge } from "./StrategyBadge";
import { IVRankBadge } from "./IVRankBadge";
import { cn } from "@/lib/utils";
import { optionsApi, type OptionsSignalOut, type OptionsRiskModelOut } from "@/lib/options-api";

interface SignalCardProps {
  signal: OptionsSignalOut;
  riskModel?: OptionsRiskModelOut | null;
  dryRun: boolean;
  onViewChain?: (symbol: string) => void;
  onApproved?: () => void;
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded px-2 py-1 text-center min-w-0">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</div>
      <div className={cn("text-xs font-mono font-semibold", color ?? "text-zinc-200")}>{value}</div>
    </div>
  );
}

export function SignalCard({
  signal,
  riskModel,
  dryRun,
  onViewChain,
  onApproved,
}: SignalCardProps) {
  const [skipped, setSkipped] = useState(false);

  const execute = useMutation({
    mutationFn: () =>
      optionsApi.execute({
        symbol: signal.symbol,
        strategy: signal.strategy,
        legs: signal.legs,
        iv_rank: signal.iv_rank,
        iv_percentile: signal.iv_percentile,
        underlying_trend: signal.underlying_trend,
        confidence: signal.confidence,
        dry_run: dryRun,
        underlying_price: 100,
      }),
    onSuccess: (result) => {
      const mode = result.dry_run ? "dry-run" : "live";
      toast.success(`Order ${result.status} (${mode})`, {
        description: result.order_id ? `Order ID: ${result.order_id}` : undefined,
      });
      onApproved?.();
    },
    onError: (err: Error) => {
      toast.error("Execution failed", { description: err.message });
    },
  });

  if (skipped) return null;

  const isBlocked = signal.blocked;
  const trendColor =
    signal.underlying_trend === "bullish"
      ? "text-emerald-400"
      : signal.underlying_trend === "bearish"
      ? "text-red-400"
      : "text-zinc-400";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 flex flex-col gap-2 transition-all",
        isBlocked
          ? "border-amber-800/50 bg-zinc-900/40 opacity-60"
          : "border-zinc-700 bg-zinc-900/60"
      )}
    >
      {/* Row 1: symbol + strategy + confidence */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-zinc-100 text-sm">{signal.symbol}</span>
          <StrategyBadge strategy={signal.strategy} />
          {isBlocked && signal.block_reason && (
            <span className="text-[10px] border border-amber-700 bg-amber-900/20 text-amber-300 rounded px-1.5 py-0.5 truncate max-w-32">
              {signal.block_reason}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-zinc-400 shrink-0">
          {(signal.confidence * 100).toFixed(0)}% conf.
        </span>
      </div>

      {/* Row 2: IV badges + trend + earnings */}
      <div className="flex flex-wrap items-center gap-2">
        <IVRankBadge ivRank={signal.iv_rank} ivPercentile={signal.iv_percentile} />
        <span className={cn("text-xs font-medium", trendColor)}>
          {signal.underlying_trend.charAt(0).toUpperCase() + signal.underlying_trend.slice(1)}
        </span>
        {signal.days_to_earnings !== null && signal.days_to_earnings !== undefined && (
          <span className="text-xs text-amber-400 font-mono">
            Earn. in {signal.days_to_earnings}d
          </span>
        )}
      </div>

      {/* Row 3: risk model stats */}
      {riskModel && (
        <div className="grid grid-cols-3 gap-1.5">
          <MiniStat
            label="Max Profit"
            value={`+$${riskModel.max_profit.toFixed(0)}`}
            color="text-emerald-400"
          />
          <MiniStat
            label="Max Loss"
            value={`$${riskModel.max_loss.toFixed(0)}`}
            color="text-red-400"
          />
          <MiniStat
            label="POP"
            value={`${(riskModel.probability_of_profit * 100).toFixed(1)}%`}
          />
        </div>
      )}

      {/* Row 4: breakevens */}
      {riskModel && riskModel.breakeven_prices.length > 0 && (
        <div className="text-[10px] text-zinc-500 font-mono">
          BE:{" "}
          {riskModel.breakeven_prices
            .map((be) => `$${be.toFixed(2)}`)
            .join(" / ")}
        </div>
      )}

      {/* Action row */}
      {!isBlocked && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-primary/90 hover:bg-primary text-primary-foreground text-xs h-7"
            onClick={() => execute.mutate()}
            disabled={execute.isPending}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {execute.isPending ? "Submitting…" : dryRun ? "Approve (Dry-Run)" : "Approve (Live)"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-200 text-xs h-7 px-2"
            onClick={() => setSkipped(true)}
          >
            <SkipForward className="w-3 h-3 mr-1" />
            Skip
          </Button>
          {onViewChain && (
            <Button
              size="sm"
              variant="ghost"
              className="text-zinc-500 hover:text-zinc-300 text-xs h-7 px-2"
              onClick={() => onViewChain(signal.symbol)}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Chain
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
