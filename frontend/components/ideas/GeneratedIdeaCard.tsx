"use client";

/**
 * GeneratedIdeaCard — auto-generated idea card from the V3 idea engine.
 *
 * Renders:
 *   - Ticker + company name
 *   - Megatrend + theme tag badges
 *   - Entry priority amber badges (Near 52-week low / At weekly support)
 *   - Reason summary + optional news headline link
 *   - Current price + estimated entry zone + ideal entry
 *   - Competitive moat block (score badge + description)
 *   - Financial quality block (or "Financials unavailable")
 *   - Confidence + 90d win rate badges
 *   - AddToWatchlistButton + "View Chart" link
 *   - "Generated X minutes ago" footer
 *
 * No prohibited language: never "guaranteed", "safe", "certain to go up".
 */

import Link from "next/link";
import { ExternalLink, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="text-[10px] text-muted-foreground italic">
        Financials unavailable
      </div>
    );
  }

  const qualityLabel =
    score >= 0.75
      ? { label: "Strong", color: "text-green-400" }
      : score >= 0.50
      ? { label: "Moderate", color: "text-amber-400" }
      : { label: "Weak", color: "text-red-400" };

  const flagLabels: Record<string, string> = {
    revenue_growth_positive: "Revenue growing",
    earnings_growth_positive: "Earnings growing",
    margins_improving: "Margins improving",
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Financial quality:</span>
        <span className={cn("text-[10px] font-semibold", qualityLabel.color)}>
          {qualityLabel.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          ({(score * 100).toFixed(0)}%)
        </span>
      </div>
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flags.map((f) => (
            <span key={f} className="text-[9px] text-muted-foreground/70">
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
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">Competitive moat:</span>
        {isStrong ? (
          <Badge className="text-[9px] py-0 bg-green-500/15 text-green-400 border-green-500/30">
            Strong ({(score * 100).toFixed(0)}%)
          </Badge>
        ) : isWeak ? (
          <Badge className="text-[9px] py-0 bg-red-500/15 text-red-400 border-red-500/30">
            Low competitive moat — higher risk
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[9px] py-0">
            Moderate ({(score * 100).toFixed(0)}%)
          </Badge>
        )}
      </div>
      {description && (
        <p className="text-[9px] text-muted-foreground/80 italic">{description}</p>
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
    <Card className={cn("hover:border-border/80 transition-colors", className)}>
      <CardHeader className="pb-2">
        {/* Header row: ticker + badges + idea score */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Ticker + company */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">
                {idea.ticker}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {idea.company_name}
              </span>
              <Badge variant="secondary" className="text-[9px] py-0 ml-auto">
                Score {ideaScorePct}%
              </Badge>
            </div>

            {/* Theme + megatrend badges */}
            {idea.theme_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {idea.theme_tags.map((tag) => {
                  const isMega = MEGATREND_TAGS.has(tag.toLowerCase());
                  return (
                    <Badge
                      key={tag}
                      className={cn(
                        "text-[9px] py-0",
                        isMega
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {tag.toUpperCase()}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Entry priority amber badges */}
            {(idea.near_52w_low || idea.at_weekly_support) && (
              <div className="flex flex-wrap gap-1">
                {idea.near_52w_low && (
                  <Badge className="text-[9px] py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">
                    Near 52-week low — historically attractive entry area
                  </Badge>
                )}
                {idea.at_weekly_support && (
                  <Badge className="text-[9px] py-0 bg-amber-500/15 text-amber-400 border-amber-500/30">
                    At weekly support — historically favorable entry zone
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Why flagged */}
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">
            Why flagged
          </p>
          <p className="text-xs text-foreground/90">{idea.reason_summary}</p>
          {idea.news_headline && idea.news_url && (
            <a
              href={idea.news_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary transition-colors mt-0.5"
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
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <span className="text-muted-foreground">Current price: </span>
            <span className="font-mono font-semibold">{usd.format(idea.current_price)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Entry zone: </span>
            <span className="font-mono text-foreground/80">
              {idea.buy_zone_low != null && idea.buy_zone_high != null
                ? `${usd.format(idea.buy_zone_low)} – ${usd.format(idea.buy_zone_high)}`
                : "Calculating…"}
            </span>
          </div>
          {idea.ideal_entry_price != null && (
            <div>
              <span className="text-muted-foreground">Ideal entry: </span>
              <span className="font-mono font-semibold text-primary">
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
            <span className="text-[10px] text-muted-foreground">Confidence:</span>
            <Badge
              className={cn(
                "text-[9px] py-0",
                idea.confidence_score >= 0.70
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : idea.confidence_score >= 0.55
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-secondary text-muted-foreground border-border"
              )}
            >
              {confidencePct}%
            </Badge>
          </div>

          {winRatePct != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                Historical 90d win rate:
              </span>
              <span
                className={cn(
                  "text-[10px] font-mono font-semibold",
                  idea.historical_win_rate_90d! >= 0.65
                    ? "text-green-400"
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
        <div className="flex items-center gap-2 pt-1 border-t border-border/60">
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
        <div className="text-[9px] text-muted-foreground/60 text-right">
          Generated {relativeTime(idea.generated_at)}
          {idea.source !== "merged" && (
            <span className="ml-1 opacity-70">via {idea.source}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
