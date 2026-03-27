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
    <div className={cn("rounded-md border border-border/10 bg-surface-low p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-foreground">
          {snapshot.ticker} — High-Probability Entry Zone
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={cn(
              "text-3xs font-bold px-2 py-0.5 rounded-sm tabular-nums",
              snapshot.confidence_score >= 0.7
                ? "bg-primary/15 text-primary"
                : snapshot.confidence_score >= 0.45
                ? "bg-surface-high text-muted-foreground"
                : "bg-surface-high text-muted-foreground/60"
            )}
          >
            {confidencePct}% confidence
          </span>
          {isInsideZone && (
            <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm">
              Inside zone
            </span>
          )}
        </div>
      </div>

      {/* Zone range row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Confidence score</span>
          <span className="font-mono font-bold text-xs tabular-nums">{confidencePct}%</span>
        </div>
        <ProgressBar value={confidencePct} />
      </div>

      {/* Entry quality meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Entry quality score</span>
          <span className="font-mono font-bold text-xs tabular-nums">{entryQualityPct}%</span>
        </div>
        <ProgressBar value={entryQualityPct} />
      </div>

      {/* Returns and drawdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBlock
          label="Expected 30d return"
          value={formatPct(snapshot.expected_return_30d)}
          valueClassName={
            snapshot.expected_return_30d >= 0
              ? "text-primary"
              : "text-destructive"
          }
          sublabel="scenario-based estimate"
        />
        <StatBlock
          label="Expected 90d return"
          value={formatPct(snapshot.expected_return_90d)}
          valueClassName={
            snapshot.expected_return_90d >= 0
              ? "text-primary"
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

      {/* Expandable explanation */}
      {snapshot.explanation_json.length > 0 && (
        <div className="rounded-md border border-border/10 bg-surface-mid overflow-hidden">
          <button
            type="button"
            onClick={() => setExplanationOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-surface-high/30 transition-colors"
          >
            <span>Reasoning ({snapshot.explanation_json.length} factors)</span>
            {explanationOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
          </button>
          {explanationOpen && (
            <ul className="border-t border-border/10 divide-y divide-border/10">
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

      <p className="text-2xs text-muted-foreground/60">
        Model v{snapshot.model_version} · Calculated{" "}
        {new Date(snapshot.created_at).toLocaleString()}. Past performance
        does not guarantee future results.
      </p>
    </div>
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
    <div className="rounded-sm border border-border/10 bg-surface-lowest px-2.5 py-2">
      <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground truncate mb-0.5">{label}</p>
      <p
        className={cn(
          "text-sm font-bold font-mono tabular-nums",
          valueClassName ?? "text-foreground"
        )}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-3xs text-muted-foreground/60 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}
