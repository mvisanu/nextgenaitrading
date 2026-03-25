"use client";

/**
 * MarketPulse — Live market data tab combining TradingView screener results
 * and Reddit social sentiment to surface actionable stock ideas.
 *
 * Sections:
 *   1. Reddit Trending — tickers most mentioned on r/wallstreetbets, r/stocks, r/investing
 *   2. Quality Growth — high-quality stocks from TradingView screener
 *   3. Momentum Leaders — strong recent performers
 *   4. Value Opportunities — undervalued stocks
 *
 * Each stock has a "View Chart" link and an "Add to Watchlist" action.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  ChevronRight,
  BarChart4,
  Users,
  Zap,
  Target,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SocialPost {
  title: string;
  subreddit: string;
  score: number;
  comments: number;
  url: string;
  flair: string | null;
  hoursAgo: number;
}

interface SocialTicker {
  ticker: string;
  mentions: number;
  totalScore: number;
  topPosts: SocialPost[];
  sentiment: "bullish" | "bearish" | "mixed";
}

interface SocialResponse {
  tickers: SocialTicker[];
  sources: string[];
  postsScanned: number;
  fetchedAt: string;
}

interface ScreenerStock {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  pe: number | null;
  rsi: number | null;
  sector: string | null;
  signal: string | null;
}

interface MarketPulseSection {
  id: string;
  title: string;
  description: string;
  stocks: ScreenerStock[];
}

interface MarketPulseResponse {
  sections: MarketPulseSection[];
  fetchedAt: string;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function compactNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ─── Social Ticker Card ─────────────────────────────────────────────────────

function SocialTickerCard({ ticker }: { ticker: SocialTicker }) {
  const [expanded, setExpanded] = useState(false);

  const sentimentColor = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    mixed: "text-amber-400",
  }[ticker.sentiment];

  const sentimentBg = {
    bullish: "bg-green-500/10 border-green-500/20",
    bearish: "bg-red-500/10 border-red-500/20",
    mixed: "bg-amber-500/10 border-amber-500/20",
  }[ticker.sentiment];

  const SentimentIcon = {
    bullish: ArrowUpRight,
    bearish: ArrowDownRight,
    mixed: Minus,
  }[ticker.sentiment];

  return (
    <div className={cn("rounded-lg border p-3 space-y-2", sentimentBg)}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-primary">
          {ticker.ticker}
        </span>
        <Badge variant="secondary" className="text-[9px] py-0 gap-1">
          <MessageSquare className="h-2.5 w-2.5" />
          {ticker.mentions} mentions
        </Badge>
        <Badge className={cn("text-[9px] py-0 gap-1 border", sentimentBg, sentimentColor)}>
          <SentimentIcon className="h-2.5 w-2.5" />
          {ticker.sentiment}
        </Badge>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href={`/dashboard?ticker=${encodeURIComponent(ticker.ticker)}`}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
          >
            <TrendingUp className="h-3 w-3" />
            Chart
          </Link>
          <Link
            href={`/screener?symbol=${encodeURIComponent(ticker.ticker)}`}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
          >
            <BarChart4 className="h-3 w-3" />
            TA
          </Link>
        </div>
      </div>

      {/* Top post preview */}
      {ticker.topPosts.length > 0 && (
        <div className="space-y-1">
          <a
            href={ticker.topPosts[0].url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-1.5 text-xs text-foreground/80 hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
            <span className="line-clamp-2">{ticker.topPosts[0].title}</span>
          </a>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>r/{ticker.topPosts[0].subreddit}</span>
            <span>{ticker.topPosts[0].score} pts</span>
            <span>{ticker.topPosts[0].comments} comments</span>
            <span>{ticker.topPosts[0].hoursAgo}h ago</span>
          </div>
        </div>
      )}

      {/* Expand for more posts */}
      {ticker.topPosts.length > 1 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {expanded ? "Hide" : `+${ticker.topPosts.length - 1} more post${ticker.topPosts.length > 2 ? "s" : ""}`}
          </button>

          {expanded && (
            <div className="space-y-1.5 pl-2 border-l-2 border-border/50">
              {ticker.topPosts.slice(1).map((post, i) => (
                <a
                  key={i}
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="line-clamp-1">{post.title}</span>
                  <span className="text-[9px] text-muted-foreground/60">
                    r/{post.subreddit} · {post.score} pts · {post.hoursAgo}h ago
                  </span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Screener Stock Row ─────────────────────────────────────────────────────

function StockRow({ stock }: { stock: ScreenerStock }) {
  const isPositive = stock.changePct >= 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-secondary/40 rounded transition-colors">
      {/* Symbol + name */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-foreground">
            {stock.symbol}
          </span>
          {stock.signal === "BUY" && (
            <Badge className="text-[8px] py-0 bg-green-500/15 text-green-400 border-green-500/30">
              BUY
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground truncate block">
          {stock.name}
        </span>
      </div>

      {/* Price + change */}
      <div className="text-right shrink-0">
        <div className="text-xs font-mono font-semibold text-foreground">
          {usd.format(stock.price)}
        </div>
        <div
          className={cn(
            "text-[10px] font-mono",
            isPositive ? "text-green-400" : "text-red-400"
          )}
        >
          {isPositive ? "+" : ""}
          {stock.changePct.toFixed(2)}%
        </div>
      </div>

      {/* RSI */}
      {stock.rsi != null && (
        <div className="text-right shrink-0 w-10">
          <div className="text-[9px] text-muted-foreground">RSI</div>
          <div
            className={cn(
              "text-[10px] font-mono font-semibold",
              stock.rsi >= 70
                ? "text-red-400"
                : stock.rsi <= 30
                ? "text-green-400"
                : "text-foreground"
            )}
          >
            {stock.rsi}
          </div>
        </div>
      )}

      {/* P/E */}
      {stock.pe != null && (
        <div className="text-right shrink-0 w-12 hidden sm:block">
          <div className="text-[9px] text-muted-foreground">P/E</div>
          <div className="text-[10px] font-mono text-foreground">
            {stock.pe.toFixed(1)}
          </div>
        </div>
      )}

      {/* Volume */}
      <div className="text-right shrink-0 w-14 hidden md:block">
        <div className="text-[9px] text-muted-foreground">Vol</div>
        <div className="text-[10px] font-mono text-foreground">
          {compactNumber(stock.volume)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Link
          href={`/dashboard?ticker=${encodeURIComponent(stock.symbol)}`}
          title="View chart"
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
        >
          <TrendingUp className="h-3 w-3" />
        </Link>
        <Link
          href={`/screener?symbol=${encodeURIComponent(stock.symbol)}`}
          title="Technical analysis"
          className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
        >
          <BarChart4 className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function ScreenerSection({
  section,
  icon: Icon,
}: {
  section: MarketPulseSection;
  icon: typeof TrendingUp;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader className="pb-0">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 w-full text-left"
        >
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">
              {section.title}
            </h3>
            <p className="text-[10px] text-muted-foreground">
              {section.description}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] py-0 shrink-0">
            {section.stocks.length}
          </Badge>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-2 px-0">
          <div className="divide-y divide-border/50">
            {section.stocks.map((stock) => (
              <StockRow key={stock.symbol} stock={stock} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Section Icons ──────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, typeof TrendingUp> = {
  "quality-growth": Zap,
  momentum: TrendingUp,
  value: DollarSign,
};

// ─── Main Component ─────────────────────────────────────────────────────────

export function MarketPulse() {
  const {
    data: socialData,
    isLoading: socialLoading,
    refetch: refetchSocial,
  } = useQuery<SocialResponse>({
    queryKey: ["ideas-social"],
    queryFn: () => fetch("/api/ideas/social").then((r) => r.json()),
    staleTime: 5 * 60_000,
  });

  const {
    data: pulseData,
    isLoading: pulseLoading,
    refetch: refetchPulse,
  } = useQuery<MarketPulseResponse>({
    queryKey: ["ideas-market-pulse"],
    queryFn: () => fetch("/api/ideas/market-pulse").then((r) => r.json()),
    staleTime: 10 * 60_000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const isLoading = socialLoading || pulseLoading;

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSocial(), refetchPulse()]);
    setRefreshing(false);
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex-1">
          Live market data from TradingView screener + Reddit social sentiment.
          Use these as starting points for your own research.
        </p>
        <div className="flex items-center gap-2">
          {socialData?.fetchedAt && (
            <span className="text-[10px] text-muted-foreground">
              Updated {relativeTime(socialData.fetchedAt)}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleRefresh}
            disabled={refreshing || isLoading}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[10px] text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          Market data is for research only. Social sentiment is not financial advice.
          Reddit mentions reflect retail discussion, not institutional analysis. Always do your own due diligence.
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Reddit Trending Section */}
          {socialData && socialData.tickers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-orange-400 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      Reddit Trending
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      Most discussed tickers on {socialData.sources.join(", ")} ({socialData.postsScanned} posts scanned)
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {socialData.tickers.length} tickers
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {socialData.tickers.slice(0, 8).map((t) => (
                  <SocialTickerCard key={t.ticker} ticker={t} />
                ))}
                {socialData.tickers.length > 8 && (
                  <p className="text-[10px] text-muted-foreground text-center pt-1">
                    +{socialData.tickers.length - 8} more trending tickers
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {socialData && socialData.tickers.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No trending tickers found on Reddit right now.
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Reddit data refreshes every 5 minutes. Try again later.
                </p>
              </CardContent>
            </Card>
          )}

          {/* TradingView Screener Sections */}
          {pulseData?.sections.map((section) => (
            <ScreenerSection
              key={section.id}
              section={section}
              icon={SECTION_ICONS[section.id] ?? Target}
            />
          ))}
        </>
      )}
    </div>
  );
}
