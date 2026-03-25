"use client";

/**
 * BuyNowBadge — Signal status badge for watchlist rows.
 *
 * States:
 *   STRONG_BUY  — pulsing green dot + "STRONG BUY" text
 *   WATCHING    — gray "Watching"
 *   NOT_READY   — gray "Not Ready"
 *   PENDING     — amber + spinner (buy zone still calculating)
 *   null        — same as PENDING
 *
 * Hover/focus tooltip lists all 10 conditions from `condition_details`
 * with a green check or red × per condition.
 */

import { useState, useRef } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SignalStatus, ConditionDetail } from "@/types";

// Human-readable labels for the 10 condition keys
const CONDITION_LABELS: Record<string, string> = {
  price_in_zone: "Price inside buy zone",
  above_50d_ma: "Above 50-day MA",
  above_200d_ma: "Above 200-day MA",
  rsi_confirms: "RSI not overbought (30–55)",
  volume_confirms: "Volume declining on pullback",
  near_support: "Near proven support level",
  trend_regime_bullish: "Trend regime not bearish",
  backtest_confidence: "Backtest confidence >= 65%",
  not_near_earnings: "Not near earnings (manual flag)",
  no_duplicate_in_cooldown: "No duplicate signal (4-hr cooldown)",
};

interface BuyNowBadgeProps {
  signal_status: SignalStatus | null;
  condition_details?: ConditionDetail[] | null;
  className?: string;
}

export function BuyNowBadge({
  signal_status,
  condition_details,
  className,
}: BuyNowBadgeProps) {
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const hasConditions =
    condition_details != null && condition_details.length > 0;

  function badgeContent() {
    if (!signal_status || signal_status === "PENDING") {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            "bg-amber-500/15 text-amber-400 border border-amber-500/30"
          )}
        >
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Checking…
        </span>
      );
    }

    if (signal_status === "STRONG_BUY") {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
            "bg-green-500/15 text-green-400 border border-green-500/30"
          )}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          STRONG BUY
        </span>
      );
    }

    if (signal_status === "WATCHING") {
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
            "bg-secondary text-muted-foreground border border-border"
          )}
        >
          Watching
        </span>
      );
    }

    // NOT_READY
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
          "bg-secondary text-muted-foreground/70 border border-border"
        )}
      >
        Not Ready
      </span>
    );
  }

  if (!hasConditions) {
    return <span className={className}>{badgeContent()}</span>;
  }

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Signal status: ${signal_status ?? "Pending"}. Click for conditions.`}
        aria-expanded={tooltipVisible}
        onMouseEnter={() => setTooltipVisible(true)}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
        className="cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
      >
        {badgeContent()}
      </button>

      {tooltipVisible && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 left-0 top-full mt-1.5",
            "w-72 rounded-md border border-border bg-popover shadow-lg p-3"
          )}
        >
          <p className="text-[10px] font-semibold text-foreground mb-2 uppercase tracking-wide">
            Condition checklist
          </p>
          <ul className="space-y-1">
            {condition_details!.map((c) => (
              <li key={c.key} className="flex items-start gap-1.5">
                {c.pass_ ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                )}
                <span
                  className={cn(
                    "text-[10px] leading-tight",
                    c.pass_ ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {CONDITION_LABELS[c.key] ?? c.key}
                </span>
              </li>
            ))}
          </ul>
          {signal_status === "NOT_READY" && (
            <p className="text-[9px] text-muted-foreground mt-2 border-t border-border pt-2">
              All 10 conditions must pass for a signal to fire.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
