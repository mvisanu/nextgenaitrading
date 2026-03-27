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

function badgeClass(score: number): string {
  if (score >= 0.6) {
    return "bg-primary/15 text-primary";
  }
  if (score >= 0.3) {
    return "bg-amber-500/15 text-amber-400";
  }
  return "bg-surface-high text-muted-foreground";
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
      <span className="text-2xs text-muted-foreground">No theme alignment</span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visibleThemes.map(([key, score]) => (
        <span
          key={key}
          className={cn("text-3xs font-bold px-2 py-0.5 rounded-sm tabular-nums", badgeClass(score))}
          title={`${formatThemeName(key)}: ${(score * 100).toFixed(0)}%`}
        >
          {formatThemeName(key)}
          <span className="ml-1 opacity-70">{(score * 100).toFixed(0)}%</span>
        </span>
      ))}
    </div>
  );
}
