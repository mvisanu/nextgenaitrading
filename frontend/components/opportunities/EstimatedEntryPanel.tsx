"use client";

/**
 * EstimatedEntryPanel — expanded-row detail panel for a watchlist ticker.
 *
 * Shows:
 *   - Estimated entry zone (historically favorable)
 *   - Ideal entry based on backtest
 *   - Disclaimer (required wording)
 *   - 90-day positive outcome rate + worst drawdown
 *   - Invalidation level
 *   - Setup count (when available from the signal)
 *
 * All dollar values use Intl.NumberFormat USD.
 * No prohibited language: never "guaranteed", "safe", "certain to go up".
 */

import { cn } from "@/lib/utils";
import type { OpportunityRow } from "@/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

interface EstimatedEntryPanelProps {
  row: OpportunityRow;
  className?: string;
}

export function EstimatedEntryPanel({ row, className }: EstimatedEntryPanelProps) {
  const isPending = row.ideal_entry_price == null;

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/30 p-4 text-xs space-y-3",
        className
      )}
    >
      {/* Entry zone */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-muted-foreground whitespace-nowrap">
            Estimated entry zone (historically favorable):
          </span>
          {row.buy_zone_low != null && row.buy_zone_high != null ? (
            <span className="font-mono font-semibold text-foreground">
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
            <span className="font-mono font-semibold text-primary">
              {usd.format(row.ideal_entry_price!)}
            </span>
          )}
        </div>

        {/* Required disclaimer */}
        <p className="text-[10px] text-muted-foreground/70 italic">
          This is not a guaranteed price. Based on historical backtest data.
        </p>
      </div>

      {/* Outcome stats */}
      {(row.backtest_win_rate_90d != null || row.expected_drawdown != null) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-3">
          {row.backtest_win_rate_90d != null && (
            <div>
              <span className="text-muted-foreground">90-day positive outcome rate: </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  row.backtest_win_rate_90d >= 0.65
                    ? "text-green-400"
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
              <span className="text-muted-foreground">Worst drawdown: </span>
              <span className="font-mono font-semibold text-red-400">
                -{(row.expected_drawdown * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Invalidation level */}
      {row.invalidation_price != null && (
        <div className="flex items-baseline gap-2 border-t border-border/60 pt-3">
          <span className="text-muted-foreground">Invalidation level:</span>
          <span className="font-mono font-semibold text-red-400">
            {usd.format(row.invalidation_price)}
          </span>
          <span className="text-[10px] text-muted-foreground/70 italic">
            — consider reassessing if price falls below this level
          </span>
        </div>
      )}

      {/* Confidence + signal status summary */}
      {(row.backtest_confidence != null || row.suppressed_reason) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-3">
          {row.backtest_confidence != null && (
            <div>
              <span className="text-muted-foreground">Confidence score: </span>
              <span
                className={cn(
                  "font-mono font-semibold",
                  row.backtest_confidence >= 0.70
                    ? "text-green-400"
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
              <span className="text-muted-foreground">Signal suppressed: </span>
              <span className="font-mono text-muted-foreground/80">
                {row.suppressed_reason.replace(/_/g, " ")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
