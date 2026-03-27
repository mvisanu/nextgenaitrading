"use client";

/**
 * IdeaFeed — scrollable feed of auto-generated idea cards from the V3 idea engine.
 *
 * Sovereign Terminal design system applied.
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

  // Client-side filtering
  let displayedIdeas = allIdeas;
  if (activeTab === "theme") {
    displayedIdeas = displayedIdeas.filter((idea) => idea.theme_tags.length > 0);
  }
  if (activeThemes.size > 0) {
    displayedIdeas = displayedIdeas.filter((idea) =>
      idea.theme_tags.some((tag) => activeThemes.has(tag.toLowerCase()))
    );
  }

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
      <div className="flex items-center gap-0 border-b border-border/10 overflow-x-auto">
        {SOURCE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors uppercase tracking-widest",
              activeTab === tab.key
                ? "border-primary text-primary"
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
                "rounded-sm px-2 py-0.5 text-3xs font-bold transition-colors",
                activeThemes.has(chip.key)
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-high text-muted-foreground hover:text-foreground"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-2xs text-muted-foreground whitespace-nowrap tabular-nums">
            Updated: {relativeTime(lastScanData?.last_scan_at ?? null)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 hover:bg-surface-high/50 font-bold uppercase tracking-widest"
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
        <p className="text-2xs text-muted-foreground tabular-nums">
          {sortedIdeas.length} idea{sortedIdeas.length !== 1 ? "s" : ""} — ranked by confidence score
        </p>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 w-full bg-surface-mid" />
          ))}
        </div>
      ) : sortedIdeas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center max-w-md mx-auto">
          <div className="h-10 w-10 rounded-full bg-surface-high flex items-center justify-center mb-3">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground">
            No ideas generated yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The scanner automatically runs every hour during market hours (9:30 AM – 4:00 PM ET, weekdays).
          </p>

          <Button
            size="sm"
            className="mt-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs"
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
            <p className="text-2xs text-muted-foreground mt-2">
              Scanning ~30 stocks across news, themes, and technicals. This may take a minute...
            </p>
          )}

          {/* How it works guide */}
          <div className="mt-6 w-full border border-border/10 rounded-md p-4 text-left space-y-3 bg-surface-high/50">
            <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">How it works</p>
            <div className="space-y-2 text-2xs text-muted-foreground">
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
            <div className="border-t border-border/10 pt-2 text-3xs text-muted-foreground/60">
              Three idea sources: <strong>News</strong> (RSS feeds for catalysts), <strong>Theme</strong> (megatrend/moat screening), <strong>Technical</strong> (pullback setups in ~30 liquid stocks).
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedIdeas.map((idea) => (
            <GeneratedIdeaCard key={idea.id} idea={idea} />
          ))}
        </div>
      )}
    </div>
  );
}
