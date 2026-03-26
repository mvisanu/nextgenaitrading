"use client";

/**
 * /opportunities — V3 Watchlist + Buy Zone + Live Scanner
 *
 * Refactored layout: full-width scanner table with status strip header,
 * onboarding empty state, and streamlined add/scan controls.
 *
 * Protected route: requires authentication.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Crosshair,
  Radar,
  TrendingUp,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { WatchlistTable } from "@/components/opportunities/WatchlistTable";
import { opportunitiesApi } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Status summary strip ───────────────────────────────────────────────────

function StatusStrip({ rows }: { rows: import("@/types").OpportunityRow[] }) {
  const stats = useMemo(() => {
    const total = rows.length;
    const strongBuy = rows.filter((r) => r.signal_strength === "STRONG_BUY").length;
    const watching = rows.filter(
      (r) => r.signal_strength && r.signal_strength !== "STRONG_BUY" && r.signal_strength !== "SUPPRESSED"
    ).length;
    const pending = rows.filter((r) => r.signal_strength == null).length;
    return { total, strongBuy, watching, pending };
  }, [rows]);

  if (stats.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-card/50 border border-border rounded-lg text-xs">
      <div className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Tracking</span>
        <span className="font-semibold text-foreground tabular-nums">{stats.total}</span>
      </div>

      {stats.strongBuy > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-green-400 font-semibold tabular-nums">{stats.strongBuy}</span>
          <span className="text-muted-foreground">STRONG BUY</span>
        </div>
      )}

      {stats.watching > 0 && (
        <div className="flex items-center gap-1.5">
          <Crosshair className="h-3 w-3 text-muted-foreground" />
          <span className="text-foreground font-semibold tabular-nums">{stats.watching}</span>
          <span className="text-muted-foreground">watching</span>
        </div>
      )}

      {stats.pending > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400/60 shrink-0" />
          <span className="text-amber-400 font-semibold tabular-nums">{stats.pending}</span>
          <span className="text-muted-foreground">calculating</span>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding empty state ─────────────────────────────────────────────────

function OnboardingGuide() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 max-w-lg mx-auto text-center">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Radar className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        Live Scanner & Buy Signals
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Add tickers to your watchlist and the scanner will continuously evaluate 10 conditions
        to find high-probability entry zones.
      </p>

      <div className="w-full space-y-3 text-left">
        {[
          {
            step: "1",
            icon: TrendingUp,
            title: "Add tickers",
            desc: "Type a symbol (e.g. AAPL, NVDA) in the input above and click Add.",
          },
          {
            step: "2",
            icon: Radar,
            title: "Scanner runs automatically",
            desc: "Every 5 minutes during market hours, the scanner checks all 10 buy conditions.",
          },
          {
            step: "3",
            icon: Crosshair,
            title: "Get STRONG BUY signals",
            desc: "When all 10 conditions pass, you get a STRONG BUY signal with entry zone details.",
          },
        ].map((item) => (
          <div
            key={item.step}
            className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50"
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">{item.step}</span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 mt-6 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-left">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground">
          Signals are based on historical backtest data and technical indicators.
          This is not financial advice. Always do your own research.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const { user } = useAuth();

  const {
    data: opportunities = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["opportunities"],
    queryFn: opportunitiesApi.list,
    enabled: !!user,
    refetchInterval: 5 * 60_000,
  });

  const hasData = opportunities.length > 0;

  return (
    <AppShell title="Opportunities">
      <h1 data-testid="page-title" className="sr-only">
        Opportunities
      </h1>

      <div className="space-y-4">
        {/* Status summary */}
        <StatusStrip rows={opportunities} />

        {/* Scanner table or onboarding */}
        {!isLoading && !hasData ? (
          <>
            {/* Show add ticker input above the onboarding guide */}
            <WatchlistTable
              rows={opportunities}
              isLoading={isLoading}
              onRefetch={refetch}
            />
          </>
        ) : (
          <WatchlistTable
            rows={opportunities}
            isLoading={isLoading}
            onRefetch={refetch}
          />
        )}

        {/* Show onboarding below when empty */}
        {!isLoading && !hasData && <OnboardingGuide />}
      </div>
    </AppShell>
  );
}
