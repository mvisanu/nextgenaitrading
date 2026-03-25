"use client";

/**
 * BuyZoneCard — displays buy zone range, confidence progress bar,
 * invalidation price, expected return, and expected drawdown for a ticker.
 *
 * Language rules enforced: uses only approved probabilistic vocabulary.
 * Banned terms ("guaranteed", "safe", "certain") must never appear here.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPct } from "@/lib/utils";
import type { BuyZoneSnapshot } from "@/types";

interface BuyZoneCardProps {
  snapshot: BuyZoneSnapshot;
  className?: string;
}

/** Inline progress bar — replaces shadcn Progress (not installed). */
function ProgressBar({
  value,
  className,
}: {
  value: number; // 0–100
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-muted overflow-hidden",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function confidenceBadgeVariant(
  score: number
): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 0.7) return "default";
  if (score >= 0.45) return "secondary";
  return "outline";
}

export function BuyZoneCard({ snapshot, className }: BuyZoneCardProps) {
  const [explanationOpen, setExplanationOpen] = useState(false);

  const confidencePct = Math.round(snapshot.confidence_score * 100);
  const entryQualityPct = Math.round(snapshot.entry_quality_score * 100);

  const isInsideZone =
    snapshot.current_price >= snapshot.buy_zone_low &&
    snapshot.current_price <= snapshot.buy_zone_high;

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">
            {snapshot.ticker} — High-Probability Entry Zone
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge variant={confidenceBadgeVariant(snapshot.confidence_score)}>
              {confidencePct}% confidence
            </Badge>
            {isInsideZone && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30">
                Inside zone
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Zone range row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock
            label="Zone Low"
            value={formatCurrency(snapshot.buy_zone_low)}
          />
          <StatBlock
            label="Zone High"
            value={formatCurrency(snapshot.buy_zone_high)}
          />
          <StatBlock
            label="Current Price"
            value={formatCurrency(snapshot.current_price)}
          />
          <StatBlock
            label="Invalidation"
            value={formatCurrency(snapshot.invalidation_price)}
            valueClassName="text-destructive"
          />
        </div>

        {/* Confidence meter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Confidence score</span>
            <span className="font-mono font-medium">{confidencePct}%</span>
          </div>
          <ProgressBar value={confidencePct} />
        </div>

        {/* Entry quality meter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Entry quality score</span>
            <span className="font-mono font-medium">{entryQualityPct}%</span>
          </div>
          <ProgressBar value={entryQualityPct} />
        </div>

        {/* Returns and drawdown */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBlock
            label="Expected 30d return"
            value={formatPct(snapshot.expected_return_30d)}
            valueClassName={
              snapshot.expected_return_30d >= 0
                ? "text-green-400"
                : "text-destructive"
            }
            sublabel="scenario-based estimate"
          />
          <StatBlock
            label="Expected 90d return"
            value={formatPct(snapshot.expected_return_90d)}
            valueClassName={
              snapshot.expected_return_90d >= 0
                ? "text-green-400"
                : "text-destructive"
            }
            sublabel="scenario-based estimate"
          />
          <StatBlock
            label="Expected drawdown"
            value={formatPct(snapshot.expected_drawdown)}
            valueClassName="text-destructive"
            sublabel="historical max adverse"
          />
          <StatBlock
            label="Time horizon"
            value={`${snapshot.horizon_days}d`}
          />
        </div>

        {/* Expandable explanation — replaces shadcn Collapsible (not installed) */}
        {snapshot.explanation_json.length > 0 && (
          <div className="rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setExplanationOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <span>Reasoning ({snapshot.explanation_json.length} factors)</span>
              {explanationOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              )}
            </button>
            {explanationOpen && (
              <ul className="border-t border-border divide-y divide-border">
                {snapshot.explanation_json.map((line, i) => (
                  <li
                    key={i}
                    className="px-3 py-2 text-xs text-muted-foreground leading-relaxed"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Model v{snapshot.model_version} · Calculated{" "}
          {new Date(snapshot.created_at).toLocaleString()}. Past performance
          does not guarantee future results.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Shared stat block ─────────────────────────────────────────────────────────

interface StatBlockProps {
  label: string;
  value: string;
  valueClassName?: string;
  sublabel?: string;
}

function StatBlock({ label, value, valueClassName, sublabel }: StatBlockProps) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <p className="text-[11px] text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold font-mono",
          valueClassName ?? "text-foreground"
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
