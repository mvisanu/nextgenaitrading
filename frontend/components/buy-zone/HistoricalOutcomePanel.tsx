"use client";

/**
 * HistoricalOutcomePanel — displays positive outcome rates and expected
 * returns as stat blocks derived from historical analog scoring.
 *
 * Uses only approved probabilistic vocabulary:
 * "positive outcome rate", "historically favorable", "scenario-based estimate".
 */

import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/utils";
import type { BuyZoneSnapshot } from "@/types";

interface HistoricalOutcomePanelProps {
  snapshot: BuyZoneSnapshot;
  className?: string;
}

/** Inline progress bar — replaces shadcn Progress (not installed). */
function OutcomeBar({
  value,
  label,
}: {
  value: number; // 0–1
  label: string;
}) {
  const pct = Math.round(value * 100);
  const barColor =
    pct >= 60
      ? "bg-primary"
      : pct >= 45
      ? "bg-amber-500"
      : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-mono font-bold text-xs tabular-nums",
            pct >= 60
              ? "text-primary"
              : pct >= 45
              ? "text-amber-400"
              : "text-destructive"
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-high overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function HistoricalOutcomePanel({
  snapshot,
  className,
}: HistoricalOutcomePanelProps) {
  return (
    <div className={cn("rounded-md border border-border/10 bg-surface-low p-4 space-y-4", className)}>
      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-1">Historical Outcome Rates</p>
        <p className="text-2xs text-muted-foreground">
          Based on historically favorable analog setups. Results are scenario-based
          estimates, not guarantees.
        </p>
      </div>

      {/* Positive outcome rate bars */}
      <OutcomeBar
        value={snapshot.positive_outcome_rate_30d}
        label="Positive outcome rate — 30-day horizon"
      />
      <OutcomeBar
        value={snapshot.positive_outcome_rate_90d}
        label="Positive outcome rate — 90-day horizon"
      />

      {/* Expected return stat blocks */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-sm border border-border/10 bg-surface-lowest px-2.5 py-2">
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            Expected return — 30d
          </p>
          <p
            className={cn(
              "text-sm font-bold font-mono tabular-nums",
              snapshot.expected_return_30d >= 0
                ? "text-primary"
                : "text-destructive"
            )}
          >
            {formatPct(snapshot.expected_return_30d)}
          </p>
          <p className="text-3xs text-muted-foreground/60 mt-0.5">
            scenario-based estimate
          </p>
        </div>
        <div className="rounded-sm border border-border/10 bg-surface-lowest px-2.5 py-2">
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            Expected return — 90d
          </p>
          <p
            className={cn(
              "text-sm font-bold font-mono tabular-nums",
              snapshot.expected_return_90d >= 0
                ? "text-primary"
                : "text-destructive"
            )}
          >
            {formatPct(snapshot.expected_return_90d)}
          </p>
          <p className="text-3xs text-muted-foreground/60 mt-0.5">
            scenario-based estimate
          </p>
        </div>
      </div>

      <p className="text-2xs text-muted-foreground border-t border-border/10 pt-3">
        Historical analog win rates are derived from similar past market
        conditions. Past analog outcomes do not guarantee future results.
        Always apply your own risk assessment before acting.
      </p>
    </div>
  );
}
