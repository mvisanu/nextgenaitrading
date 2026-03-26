"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Maximize2, Minimize2, ExternalLink, TrendingUp, RefreshCw } from "lucide-react";
import { newsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/types";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function sourceName(raw: string): string {
  // Clean up RSS feed titles to short labels
  if (raw.includes("Yahoo")) return "Yahoo Finance";
  if (raw.includes("Wall Street") || raw.includes("WSJ") || raw.includes("dj.com")) return "WSJ";
  if (raw.includes("CNN")) return "CNN Business";
  if (raw.includes("Federal Reserve")) return "Fed";
  if (raw.includes("EIA") || raw.includes("eia.gov")) return "EIA";
  if (raw.length > 25) return raw.slice(0, 22) + "...";
  return raw;
}

interface NewsPanelProps {
  ticker?: string;
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

export function NewsPanel({ ticker, isMaximized, onToggleMaximize }: NewsPanelProps) {
  const { data: news = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["news-feed", ticker],
    queryFn: () => newsApi.list(100, ticker),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div
      className={cn(
        "flex flex-col border-t border-border bg-card",
        isMaximized ? "absolute inset-0 z-40" : "shrink-0"
      )}
      style={isMaximized ? undefined : { height: 220 }}
    >
      {/* Header */}
      <div className="flex items-center h-8 shrink-0 border-b border-border bg-secondary/50 px-3">
        <span className="text-[12px] font-semibold text-foreground mr-2">News</span>
        {ticker && (
          <span className="text-[10px] text-muted-foreground font-mono bg-secondary rounded px-1.5 py-0.5">
            {ticker}
          </span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh news"
          className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
        </button>

        <button
          onClick={onToggleMaximize}
          title={isMaximized ? "Minimize" : "Maximize"}
          className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </button>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            Loading news...
          </div>
        ) : news.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            No news available{ticker ? ` for ${ticker}` : ""}
          </div>
        ) : (
          <table className="w-full">
            <tbody>
              {news.map((item, idx) => (
                <NewsRow key={`${item.url}-${idx}`} item={item} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const isHighRelevance = item.relevance_score >= 0.5;

  return (
    <tr
      className="group hover:bg-secondary/40 transition-colors cursor-pointer border-b border-border/50"
      onClick={() => {
        if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
      }}
    >
      <td className="px-3 py-2 text-[12px] text-foreground leading-snug">
        <div className="flex items-start gap-2">
          {isHighRelevance && (
            <span className="inline-flex items-center shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 tracking-wider uppercase">
              <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
              Trending
            </span>
          )}
          <span className="line-clamp-2">{item.headline}</span>
        </div>
        {item.tickers_mentioned.length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {item.tickers_mentioned.slice(0, 5).map((t) => (
              <span
                key={t}
                className="text-[9px] font-mono font-semibold text-primary bg-primary/10 rounded px-1 py-0.5"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="hidden sm:table-cell px-2 py-2 text-right whitespace-nowrap align-top">
        <div className="text-[11px] text-muted-foreground">{sourceName(item.source)}</div>
        <div className="text-[10px] text-muted-foreground/60">{timeAgo(item.published_at)}</div>
      </td>
      <td className="sm:hidden px-2 py-2 text-right whitespace-nowrap align-top">
        <div className="text-[10px] text-muted-foreground/60">{timeAgo(item.published_at)}</div>
      </td>
      <td className="pr-3 py-2 align-top">
        <ExternalLink className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
      </td>
    </tr>
  );
}
