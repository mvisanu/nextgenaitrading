"use client";

/**
 * GeneratedIdeaCard — auto-generated idea card from the V3 idea engine.
 *
 * Sovereign Terminal design system applied.
 * No prohibited language: never "guaranteed", "safe", "certain to go up".
 */

import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import { AddToWatchlistButton } from "./AddToWatchlistButton";
import { cn } from "@/lib/utils";
import type { GeneratedIdeaRow } from "@/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Megatrend tags receive a highlighted badge colour
const MEGATREND_TAGS = new Set([
  "ai",
  "robotics",
  "longevity",
  "humanoids",
  "autopilot",
]);

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function FinancialQualityBlock({
  score,
  flags,
}: {
  score: number;
  flags: string[];
}) {
  const unavailable = flags.includes("financials_unavailable");

  if (unavailable) {
    return (
      <div className="text-2xs text-muted-foreground italic">
        Financials unavailable
      </div>
    );
  }

  const qualityLabel =
    score >= 0.75
      ? { label: "Strong", color: "text-primary" }
      : score >= 0.50
      ? { label: "Moderate", color: "text-amber-400" }
      : { label: "Weak", color: "text-destructive" };

  const flagLabels: Record<string, string> = {
    revenue_growth_positive: "Revenue growing",
    earnings_growth_positive: "Earnings growing",
    margins_improving: "Margins improving",
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Financial quality:</span>
        <span className={cn("text-3xs font-bold tabular-nums", qualityLabel.color)}>
          {qualityLabel.label} ({(score * 100).toFixed(0)}%)
        </span>
      </div>
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {flags.map((f) => (
            <span key={f} className="text-3xs text-muted-foreground/60 bg-surface-high px-1.5 py-0.5 rounded-sm">
              {flagLabels[f] ?? f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MoatBlock({
  score,
  description,
}: {
  score: number;
  description: string | null;
}) {
  const isStrong = score >= 0.70;
  const isWeak = score < 0.30;

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Competitive moat:</span>
        {isStrong ? (
          <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm tabular-nums">
            Strong ({(score * 100).toFixed(0)}%)
          </span>
        ) : isWeak ? (
          <span className="bg-destructive/15 text-destructive text-3xs font-bold px-2 py-0.5 rounded-sm">
            Low moat — higher risk
          </span>
        ) : (
          <span className="bg-surface-high text-muted-foreground text-3xs font-bold px-2 py-0.5 rounded-sm tabular-nums">
            Moderate ({(score * 100).toFixed(0)}%)
          </span>
        )}
      </div>
      {description && (
        <p className="text-3xs text-muted-foreground/70 italic">{description}</p>
      )}
    </div>
  );
}

interface GeneratedIdeaCardProps {
  idea: GeneratedIdeaRow;
  className?: string;
}

export function GeneratedIdeaCard({ idea, className }: GeneratedIdeaCardProps) {
  const ideaScorePct = (idea.idea_score * 100).toFixed(0);
  const confidencePct = (idea.confidence_score * 100).toFixed(0);
  const winRatePct =
    idea.historical_win_rate_90d != null
      ? (idea.historical_win_rate_90d * 100).toFixed(0)
      : null;

  return (
    <div className={cn("rounded-md border border-border/10 bg-surface-mid p-4 space-y-3 transition-colors hover:border-border/20", className)}>
      {/* Header row: ticker + badges + idea score */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Ticker + company + score */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary">
              {idea.ticker}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {idea.company_name}
            </span>
            <span className="ml-auto bg-surface-high text-muted-foreground text-3xs font-bold px-2 py-0.5 rounded-sm tabular-nums shrink-0">
              Score {ideaScorePct}%
            </span>
          </div>

          {/* Theme + megatrend badges */}
          {idea.theme_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {idea.theme_tags.map((tag) => {
                const isMega = MEGATREND_TAGS.has(tag.toLowerCase());
                return (
                  <span
                    key={tag}
                    className={cn(
                      "text-3xs font-bold px-2 py-0.5 rounded-sm",
                      isMega
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-high text-muted-foreground"
                    )}
                  >
                    {tag.toUpperCase()}
                  </span>
                );
              })}
            </div>
          )}

          {/* Entry priority amber badges */}
          {(idea.near_52w_low || idea.at_weekly_support) && (
            <div className="flex flex-wrap gap-1">
              {idea.near_52w_low && (
                <span className="bg-amber-500/15 text-amber-400 text-3xs font-bold px-2 py-0.5 rounded-sm">
                  Near 52-week low — historically attractive entry area
                </span>
              )}
              {idea.at_weekly_support && (
                <span className="bg-amber-500/15 text-amber-400 text-3xs font-bold px-2 py-0.5 rounded-sm">
                  At weekly support — historically favorable entry zone
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Why flagged */}
      <div className="space-y-0.5">
        <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          Why flagged
        </p>
        <p className="text-xs text-foreground/90">{idea.reason_summary}</p>
        {idea.news_headline && idea.news_url && (
          <a
            href={idea.news_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-2xs text-primary/70 hover:text-primary transition-colors mt-0.5"
          >
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
            <span className="line-clamp-1">{idea.news_headline}</span>
            {idea.news_source && (
              <span className="text-muted-foreground shrink-0">
                — {idea.news_source}
              </span>
            )}
          </a>
        )}
      </div>

      {/* Price + entry zone */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 bg-surface-low rounded-sm px-3 py-2">
        <div>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Current Price</p>
          <span className="font-mono font-bold text-xs text-foreground tabular-nums">{usd.format(idea.current_price)}</span>
        </div>
        <div>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Entry Zone</p>
          <span className="font-mono text-xs text-foreground/80 tabular-nums">
            {idea.buy_zone_low != null && idea.buy_zone_high != null
              ? `${usd.format(idea.buy_zone_low)} – ${usd.format(idea.buy_zone_high)}`
              : "Calculating…"}
          </span>
        </div>
        {idea.ideal_entry_price != null && (
          <div>
            <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Ideal Entry</p>
            <span className="font-mono font-bold text-xs text-primary tabular-nums">
              {usd.format(idea.ideal_entry_price)}
            </span>
          </div>
        )}
      </div>

      {/* Moat */}
      <MoatBlock score={idea.moat_score} description={idea.moat_description} />

      {/* Financial quality */}
      <FinancialQualityBlock
        score={idea.financial_quality_score}
        flags={idea.financial_flags}
      />

      {/* Confidence + win rate */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Confidence:</span>
          <span
            className={cn(
              "text-3xs font-bold tabular-nums px-2 py-0.5 rounded-sm",
              idea.confidence_score >= 0.70
                ? "bg-primary/15 text-primary"
                : idea.confidence_score >= 0.55
                ? "bg-amber-500/15 text-amber-400"
                : "bg-surface-high text-muted-foreground"
            )}
          >
            {confidencePct}%
          </span>
        </div>

        {winRatePct != null && (
          <div className="flex items-center gap-1.5">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
              90d win rate:
            </span>
            <span
              className={cn(
                "text-3xs font-mono font-bold tabular-nums",
                idea.historical_win_rate_90d! >= 0.65
                  ? "text-primary"
                  : idea.historical_win_rate_90d! >= 0.50
                  ? "text-amber-400"
                  : "text-muted-foreground"
              )}
            >
              {winRatePct}%
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/10">
        <AddToWatchlistButton
          ideaId={idea.id}
          ticker={idea.ticker}
          added_to_watchlist={idea.added_to_watchlist}
        />
        <Link
          href={`/dashboard?ticker=${encodeURIComponent(idea.ticker)}`}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          <TrendingUp className="h-3 w-3" />
          View Chart
        </Link>
      </div>

      {/* Footer: generated time */}
      <div className="text-3xs text-muted-foreground/50 text-right tabular-nums">
        Generated {relativeTime(idea.generated_at)}
        {idea.source !== "merged" && (
          <span className="ml-1 opacity-70">via {idea.source}</span>
        )}
      </div>
    </div>
  );
}
