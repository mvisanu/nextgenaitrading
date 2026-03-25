"use client";

/**
 * IdeaFeed — scrollable feed of auto-generated idea cards from the V3 idea engine.
 *
 * Features:
 *   - Filter tabs: All / News / Theme / Technical
 *   - Theme filter chips: AI, Energy, Defense, Space, Semiconductors, Longevity, Robotics
 *   - "Last updated X minutes ago" banner from GET /api/ideas/generated/last-scan
 *   - Manual refresh button (triggers POST /api/scanner/run-now then re-fetches)
 *   - Cards sorted by idea_score descending
 *   - TanStack Query with 5-minute staleTime
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GeneratedIdeaCard } from "./GeneratedIdeaCard";
import { generatedIdeasApi } from "@/lib/api";
import { cn, getErrorMessage } from "@/lib/utils";

type SourceTab = "all" | "news" | "theme" | "technical";

const SOURCE_TABS: { key: SourceTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "news", label: "News" },
  { key: "theme", label: "Theme" },
  { key: "technical", label: "Technical" },
];

const THEME_CHIPS = [
  { key: "ai", label: "AI" },
  { key: "energy", label: "Energy" },
  { key: "defense", label: "Defense" },
  { key: "space", label: "Space" },
  { key: "semiconductors", label: "Semiconductors" },
  { key: "longevity", label: "Longevity" },
  { key: "robotics", label: "Robotics" },
  { key: "bitcoin", label: "Bitcoin" },
  { key: "healthcare", label: "Healthcare" },
  { key: "medicine", label: "Medicine" },
];

function relativeTime(isoString: string | null): string {
  if (!isoString) return "Not yet scanned";
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
}

export function IdeaFeed() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SourceTab>("all");
  const [activeThemes, setActiveThemes] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  // Build query params
  // "theme" tab shows ideas that have any theme_tags (client-side filter),
  // not source="theme" which would only show the theme-scanner source.
  const queryParams = {
    source: activeTab !== "all" && activeTab !== "theme" ? activeTab : undefined,
    theme: activeThemes.size === 1 ? Array.from(activeThemes)[0] : undefined,
    limit: 50,
  };

  const {
    data: allIdeas = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["generated-ideas", activeTab, Array.from(activeThemes).sort().join(",")],
    queryFn: () => generatedIdeasApi.list(queryParams),
    staleTime: 5 * 60_000,
  });

  const { data: lastScanData } = useQuery({
    queryKey: ["generated-ideas-last-scan"],
    queryFn: generatedIdeasApi.lastScan,
    staleTime: 5 * 60_000,
  });

  // Client-side filtering:
  // 1. "Theme" tab: show only ideas that have at least one theme tag
  // 2. Active theme chips: OR filter across selected chips
  let displayedIdeas = allIdeas;
  if (activeTab === "theme") {
    displayedIdeas = displayedIdeas.filter((idea) => idea.theme_tags.length > 0);
  }
  if (activeThemes.size > 0) {
    displayedIdeas = displayedIdeas.filter((idea) =>
      idea.theme_tags.some((tag) => activeThemes.has(tag.toLowerCase()))
    );
  }

  // Sorted by idea_score desc (API returns sorted, but enforce here)
  const sortedIdeas = [...displayedIdeas].sort((a, b) => b.idea_score - a.idea_score);

  function toggleTheme(key: string) {
    setActiveThemes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await generatedIdeasApi.runNow();
      toast.success(`Scan complete — ${result.generated} idea${result.generated !== 1 ? "s" : ""} generated.`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Idea scan failed. Please try again."));
    }
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["generated-ideas-last-scan"] });
    setRefreshing(false);
  }

  const isSpinning = isLoading || isFetching || refreshing;

  return (
    <div className="space-y-3">
      {/* Source filter tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Theme chips + last scan banner + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {THEME_CHIPS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => toggleTheme(chip.key)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors border",
                activeThemes.has(chip.key)
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/30"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            Last updated: {relativeTime(lastScanData?.last_scan_at ?? null)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleRefresh}
            disabled={isSpinning}
          >
            {isSpinning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Ideas count */}
      {!isLoading && (
        <p className="text-[10px] text-muted-foreground">
          {sortedIdeas.length} idea{sortedIdeas.length !== 1 ? "s" : ""} —
          ranked by confidence score
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full" />
          ))}
        </div>
      ) : sortedIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center max-w-md mx-auto">
          <Sparkles className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">
            No ideas generated yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The scanner automatically runs every hour during market hours (9:30 AM – 4:00 PM ET, weekdays).
          </p>

          <Button
            variant="default"
            size="sm"
            className="mt-4"
            onClick={handleRefresh}
            disabled={isSpinning}
          >
            {isSpinning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isSpinning ? "Scanning..." : "Scan Now"}
          </Button>
          {isSpinning && (
            <p className="text-[10px] text-muted-foreground mt-2">
              Scanning ~30 stocks across news, themes, and technicals. This may take a minute...
            </p>
          )}

          <div className="mt-6 w-full border border-border rounded-lg p-4 text-left space-y-3 bg-card">
            <p className="text-[11px] font-semibold text-foreground">How it works</p>
            <div className="space-y-2 text-[11px] text-muted-foreground">
              <div className="flex gap-2">
                <span className="shrink-0 font-mono text-primary font-bold">1.</span>
                <span>Click <strong className="text-foreground">Scan Now</strong> to generate ideas instantly, or wait for the automatic hourly scan.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-mono text-primary font-bold">2.</span>
                <span>Each idea card shows a <strong className="text-foreground">confidence score</strong>, entry zone, moat rating, and financial quality — ranked by an overall idea score.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-mono text-primary font-bold">3.</span>
                <span>Use the <strong className="text-foreground">filter tabs</strong> (News / Theme / Technical) and <strong className="text-foreground">theme chips</strong> above to narrow results.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-mono text-primary font-bold">4.</span>
                <span>Click <strong className="text-foreground">Add to Watchlist</strong> on any card to track it on the Opportunities page with live buy signals.</span>
              </div>
              <div className="flex gap-2">
                <span className="shrink-0 font-mono text-primary font-bold">5.</span>
                <span>Click <strong className="text-foreground">View Chart</strong> to see the full price chart on the dashboard.</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 text-[10px] text-muted-foreground/70">
              Three idea sources: <strong>News</strong> (RSS feeds for catalysts), <strong>Theme</strong> (megatrend/moat screening), <strong>Technical</strong> (pullback setups in ~30 liquid stocks).
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedIdeas.map((idea) => (
            <GeneratedIdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
