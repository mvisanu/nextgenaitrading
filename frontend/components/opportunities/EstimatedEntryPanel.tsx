"use client";

/**
 * EstimatedEntryPanel — expanded-row detail panel for a watchlist ticker.
 *
 * Sovereign Terminal design system applied.
 */

import { cn } from "@/lib/utils";
import type { OpportunityRow } from "@/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

interface EstimatedEntryPanelProps {
  row: OpportunityRow;
  className?: string;
}

export function EstimatedEntryPanel({ row, className }: EstimatedEntryPanelProps) {
  const isPending = row.ideal_entry_price == null;

  return (
    <div
      className={cn(
        "rounded-md border border-border/10 bg-surface-low p-4 text-xs space-y-3",
        className
      )}
    >
      {/* Entry zone */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">Entry Details</p>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-muted-foreground whitespace-nowrap">
            Estimated entry zone (historically favorable):
          </span>
          {row.buy_zone_low != null && row.buy_zone_high != null ? (
            <span className="font-mono font-bold text-foreground tabular-nums">
              {usd.format(row.buy_zone_low)} – {usd.format(row.buy_zone_high)}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Calculating…</span>
          )}
        </div>

        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-muted-foreground whitespace-nowrap">
            Ideal entry based on backtest:
          </span>
          {isPending ? (
            <span className="text-muted-foreground italic">Calculating…</span>
          ) : (
            <span className="font-mono font-bold text-primary tabular-nums">
              {usd.format(row.ideal_entry_price!)}
            </span>
          )}
        </div>

        {/* Required disclaimer */}
        <p className="text-2xs text-muted-foreground/60 italic">
          This is not a guaranteed price. Based on historical backtest data.
        </p>
      </div>

      {/* Outcome stats */}
      {(row.backtest_win_rate_90d != null || row.expected_drawdown != null) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/10 pt-3">
          {row.backtest_win_rate_90d != null && (
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">90d Outcome Rate</p>
              <span
                className={cn(
                  "font-mono font-bold tabular-nums",
                  row.backtest_win_rate_90d >= 0.65
                    ? "text-primary"
                    : row.backtest_win_rate_90d >= 0.50
                    ? "text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {(row.backtest_win_rate_90d * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {row.expected_drawdown != null && (
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Worst Drawdown</p>
              <span className="font-mono font-bold text-destructive tabular-nums">
                -{(row.expected_drawdown * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invalidation level */}
      {row.invalidation_price != null && (
        <div className="flex items-baseline gap-2 border-t border-border/10 pt-3 flex-wrap">
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Invalidation Level</p>
          <span className="font-mono font-bold text-destructive tabular-nums">
            {usd.format(row.invalidation_price)}
          </span>
          <span className="text-2xs text-muted-foreground/60 italic">
            — consider reassessing if price falls below this level
          </span>
        </div>
      )}

      {/* Confidence + signal status summary */}
      {(row.backtest_confidence != null || row.suppressed_reason) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/10 pt-3">
          {row.backtest_confidence != null && (
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Confidence Score</p>
              <span
                className={cn(
                  "font-mono font-bold tabular-nums",
                  row.backtest_confidence >= 0.70
                    ? "text-primary"
                    : row.backtest_confidence >= 0.55
                    ? "text-amber-400"
                    : "text-muted-foreground"
                )}
              >
                {(row.backtest_confidence * 100).toFixed(0)}%
              </span>
            </div>
          )}

          {row.suppressed_reason && (
            <div>
              <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Signal Suppressed</p>
              <span className="font-mono text-muted-foreground/80 text-xs">
                {row.suppressed_reason.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
