"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, SkipForward, HelpCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { optionsApi, type OptionsSignalOut } from "@/lib/options-api";

// ── Plain-English Strategy Registry ──────────────────────────────────────────

interface StrategyInfo {
  label: string;
  shortLabel: string;
  howItWorks: string;
  profitWhen: string;
  riskWhen: string;
  difficulty: "beginner" | "intermediate";
  type: "credit" | "debit";
}

const STRATEGY_INFO: Record<string, StrategyInfo> = {
  cash_secured_put: {
    label: "Sell a Put Option",
    shortLabel: "Put Sell",
    howItWorks:
      "You collect a cash premium upfront. If the stock stays above the strike price at expiration, you keep it all as profit. If it falls below, you may be assigned shares.",
    profitWhen: "Stock holds steady or rises",
    riskWhen: "Stock falls sharply below the strike price",
    difficulty: "beginner",
    type: "credit",
  },
  covered_call: {
    label: "Sell a Call Option",
    shortLabel: "Call Sell",
    howItWorks:
      "You earn income by selling the right to buy your shares. If the stock stays below the strike, you keep the premium and your shares.",
    profitWhen: "Stock stays flat or moves up slightly",
    riskWhen: "Stock falls significantly (offset by premium)",
    difficulty: "beginner",
    type: "credit",
  },
  bull_call_debit: {
    label: "Buy a Call Option",
    shortLabel: "Call Buy",
    howItWorks:
      "You pay a premium for the right to buy shares at the strike price. Your profit grows as the stock rises above the breakeven point.",
    profitWhen: "Stock rises significantly above breakeven",
    riskWhen: "Stock stays flat or falls — you lose the premium paid",
    difficulty: "beginner",
    type: "debit",
  },
  bear_put_debit: {
    label: "Buy a Put Option",
    shortLabel: "Put Buy",
    howItWorks:
      "You pay a premium for the right to sell shares at the strike price. You profit as the stock falls below the breakeven point.",
    profitWhen: "Stock falls significantly below breakeven",
    riskWhen: "Stock stays flat or rises — you lose the premium paid",
    difficulty: "beginner",
    type: "debit",
  },
  iron_condor: {
    label: "Iron Condor",
    shortLabel: "Iron Condor",
    howItWorks:
      "You collect premium by selling a call and a put away from the current price. You profit if the stock stays inside the range between both strikes.",
    profitWhen: "Stock barely moves — stays inside a range",
    riskWhen: "Stock makes a big move outside the range",
    difficulty: "intermediate",
    type: "credit",
  },
  long_straddle: {
    label: "Straddle",
    shortLabel: "Straddle",
    howItWorks:
      "You buy both a call and a put at the same strike. You profit from a large move in either direction, up or down.",
    profitWhen: "Stock makes a big move either way",
    riskWhen: "Stock barely moves — both options decay",
    difficulty: "intermediate",
    type: "debit",
  },
  bull_put_spread: {
    label: "Bull Put Spread",
    shortLabel: "Bull Spread",
    howItWorks:
      "You sell a put and buy a cheaper one as protection. You collect premium with capped downside if the stock holds above the strike.",
    profitWhen: "Stock holds steady or rises",
    riskWhen: "Stock falls below the sold strike",
    difficulty: "intermediate",
    type: "credit",
  },
  bear_call_spread: {
    label: "Bear Call Spread",
    shortLabel: "Bear Spread",
    howItWorks:
      "You sell a call and buy a higher one as protection. You collect premium if the stock stays below the lower strike.",
    profitWhen: "Stock holds steady or falls",
    riskWhen: "Stock rises above the sold strike",
    difficulty: "intermediate",
    type: "credit",
  },
};

const DEFAULT_INFO: StrategyInfo = {
  label: "Options Trade",
  shortLabel: "Trade",
  howItWorks: "A customized options strategy selected by the signal engine.",
  profitWhen: "Favorable market conditions",
  riskWhen: "Adverse market conditions",
  difficulty: "intermediate",
  type: "credit",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface BeginnerTradeCardProps {
  signal: OptionsSignalOut;
  dryRun: boolean;
  underlyingPrice?: number;
  onApproved?: () => void;
  onViewDetails?: (symbol: string) => void;
}

export function BeginnerTradeCard({
  signal,
  dryRun,
  underlyingPrice = 100,
  onApproved,
  onViewDetails,
}: BeginnerTradeCardProps) {
  const [skipped, setSkipped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const info = STRATEGY_INFO[signal.strategy] ?? DEFAULT_INFO;
  const confidencePct = Math.round(signal.confidence * 100);
  const isBlocked = signal.blocked;

  const trendLabel =
    signal.underlying_trend === "bullish"
      ? "Bullish signal"
      : signal.underlying_trend === "bearish"
      ? "Bearish signal"
      : "Neutral signal";

  const trendStyle =
    signal.underlying_trend === "bullish"
      ? "text-emerald-400 bg-emerald-900/20 border-emerald-800/40"
      : signal.underlying_trend === "bearish"
      ? "text-red-400 bg-red-900/20 border-red-800/40"
      : "text-sky-400 bg-sky-900/20 border-sky-800/40";

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
        underlying_price: underlyingPrice,
      }),
    onSuccess: (result) => {
      toast.success(result.dry_run ? "Paper trade placed!" : "Live trade submitted!", {
        description: `${signal.symbol} · ${info.shortLabel}`,
      });
      onApproved?.();
    },
    onError: (err: Error) => {
      toast.error("Could not place trade", { description: err.message });
    },
  });

  if (skipped) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-200",
        isBlocked
          ? "border-zinc-800 bg-zinc-900/20 opacity-55"
          : "border-zinc-700/70 bg-zinc-900/60 hover:border-zinc-600"
      )}
    >
      {/* Main card body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Top row: symbol + strategy + trend badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-zinc-100">{signal.symbol}</span>
              <span
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                  trendStyle
                )}
              >
                {trendLabel}
              </span>
              <span
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border font-medium",
                  info.difficulty === "beginner"
                    ? "text-[#44DFA3] bg-emerald-900/10 border-emerald-800/30"
                    : "text-amber-400 bg-amber-900/10 border-amber-800/30"
                )}
              >
                {info.difficulty === "beginner" ? "★ Beginner" : "Intermediate"}
              </span>
            </div>
            <div className="text-sm font-semibold text-zinc-200 mt-0.5">{info.label}</div>
            <div className="text-xs text-zinc-500">
              Profit when: <span className="text-zinc-400">{info.profitWhen}</span>
            </div>
          </div>

          {/* Confidence score */}
          <div className="shrink-0 text-right">
            <div className="text-[10px] text-zinc-600 uppercase tracking-wide">Confidence</div>
            <div
              className={cn(
                "text-xl font-mono font-bold",
                confidencePct >= 65
                  ? "text-[#44DFA3]"
                  : confidencePct >= 45
                  ? "text-amber-400"
                  : "text-zinc-400"
              )}
            >
              {confidencePct}%
            </div>
          </div>
        </div>

        {/* Confidence bar */}
        {!isBlocked && (
          <div className="space-y-1">
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  confidencePct >= 65 ? "bg-[#44DFA3]" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(confidencePct, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Block reason */}
        {isBlocked && signal.block_reason && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-900/15 border border-amber-800/25 rounded-xl px-3 py-2">
            <span className="mt-0.5">⚠</span>
            <span>{signal.block_reason}</span>
          </div>
        )}

        {/* Earnings warning */}
        {!isBlocked &&
          signal.days_to_earnings !== null &&
          signal.days_to_earnings !== undefined &&
          signal.days_to_earnings <= 10 && (
            <div className="text-xs text-amber-500/80 flex items-center gap-1.5">
              <span>⚠</span>
              <span>
                Earnings report in {signal.days_to_earnings} day
                {signal.days_to_earnings !== 1 ? "s" : ""} — options may be pricier than usual
              </span>
            </div>
          )}

        {/* Expandable explanation */}
        {expanded && (
          <div className="bg-zinc-800/50 rounded-xl p-3 border border-zinc-700/40 space-y-2">
            <p className="text-xs text-zinc-300 leading-relaxed">{info.howItWorks}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-emerald-900/10 border border-emerald-800/20 rounded-lg p-2">
                <div className="text-[10px] text-emerald-600 uppercase tracking-wide mb-1">You profit when</div>
                <div className="text-emerald-400">{info.profitWhen}</div>
              </div>
              <div className="bg-red-900/10 border border-red-800/20 rounded-lg p-2">
                <div className="text-[10px] text-red-600 uppercase tracking-wide mb-1">You risk loss when</div>
                <div className="text-red-400">{info.riskWhen}</div>
              </div>
            </div>
            <div className="text-[10px] text-zinc-600 pt-1">
              {info.type === "credit"
                ? "💰 Credit strategy — you receive premium upfront"
                : "💸 Debit strategy — you pay premium upfront"}
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 pt-0.5">
          {!isBlocked && (
            <button
              onClick={() => execute.mutate()}
              disabled={execute.isPending}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                dryRun
                  ? "bg-[#44DFA3]/10 hover:bg-[#44DFA3]/15 border border-[#44DFA3]/30 text-[#44DFA3]"
                  : "bg-red-900/25 hover:bg-red-900/40 border border-red-700/50 text-red-300",
                execute.isPending && "opacity-60 cursor-not-allowed"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              {execute.isPending
                ? "Placing…"
                : dryRun
                ? "Place Paper Trade"
                : "Place Live Trade"}
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="px-2.5 py-2.5 rounded-xl text-zinc-600 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all"
            title={expanded ? "Hide explanation" : "How does this work?"}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <HelpCircle className="w-4 h-4" />
            )}
          </button>

          {onViewDetails && (
            <button
              onClick={() => onViewDetails(signal.symbol)}
              className="px-2.5 py-2 rounded-xl text-xs text-zinc-600 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-700 transition-all whitespace-nowrap"
            >
              Pro View
            </button>
          )}

          {!isBlocked && (
            <button
              onClick={() => setSkipped(true)}
              className="px-2 py-2.5 text-zinc-700 hover:text-zinc-500 transition-all"
              title="Skip this trade"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
