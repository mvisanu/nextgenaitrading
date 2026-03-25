"use client";

/**
 * ThemeScoreBadge — renders one Badge per theme category.
 *
 * Color logic:
 *   score < 0.30  → gray   (secondary variant)
 *   0.30 ≤ score < 0.60 → amber
 *   score ≥ 0.60  → green
 *
 * Zero-score themes are omitted entirely.
 * Theme names are title-cased for display ("renewable_energy" → "Renewable Energy").
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ThemeScoreBadgeProps {
  /** Map of theme key → score (0.0–1.0). Zero-score themes are hidden. */
  scoresByCategory: Record<string, number>;
  className?: string;
}

function formatThemeName(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function badgeClassName(score: number): string {
  if (score >= 0.6) {
    return "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/20";
  }
  if (score >= 0.3) {
    return "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/20";
  }
  return "bg-muted/50 text-muted-foreground border-border hover:bg-muted";
}

export function ThemeScoreBadge({
  scoresByCategory,
  className,
}: ThemeScoreBadgeProps) {
  const visibleThemes = Object.entries(scoresByCategory).filter(
    ([, score]) => score > 0
  );

  if (visibleThemes.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No theme alignment</span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visibleThemes.map(([key, score]) => (
        <Badge
          key={key}
          variant="outline"
          className={cn("text-xs font-medium", badgeClassName(score))}
          title={`${formatThemeName(key)}: ${(score * 100).toFixed(0)}%`}
        >
          {formatThemeName(key)}
          <span className="ml-1 opacity-70">{(score * 100).toFixed(0)}%</span>
        </Badge>
      ))}
    </div>
  );
}
