"use client";

/**
 * HistoricalOutcomePanel — displays positive outcome rates and expected
 * returns as stat blocks derived from historical analog scoring.
 *
 * Uses only approved probabilistic vocabulary:
 * "positive outcome rate", "historically favorable", "scenario-based estimate".
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      ? "bg-green-500"
      : pct >= 45
      ? "bg-amber-500"
      : "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-mono font-semibold",
            pct >= 60
              ? "text-green-400"
              : pct >= 45
              ? "text-amber-400"
              : "text-destructive"
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
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
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Historical Outcome Rates
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Based on historically favorable analog setups. Results are scenario-based
          estimates, not guarantees.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
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
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">
              Expected return — 30d
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold font-mono",
                snapshot.expected_return_30d >= 0
                  ? "text-green-400"
                  : "text-destructive"
              )}
            >
              {formatPct(snapshot.expected_return_30d)}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              scenario-based estimate
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[11px] text-muted-foreground">
              Expected return — 90d
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm font-semibold font-mono",
                snapshot.expected_return_90d >= 0
                  ? "text-green-400"
                  : "text-destructive"
              )}
            >
              {formatPct(snapshot.expected_return_90d)}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              scenario-based estimate
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
          Historical analog win rates are derived from similar past market
          conditions. Past analog outcomes do not guarantee future results.
          Always apply your own risk assessment before acting.
        </p>
      </CardContent>
    </Card>
  );
}
