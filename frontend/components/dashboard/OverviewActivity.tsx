"use client";

import { useQuery } from "@tanstack/react-query";
import { BarChart4,ChevronDown,ChevronUp,Crosshair,TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useAuth } from "@/components/layout/AppShell";
import { strategyApi } from "@/lib/api";

import { cn } from "@/lib/utils";



export function DashboardUserStatus() {
  const { user } = useAuth();
  return <span>{user?.email ?? ""}</span>;
}

// ─── KPI Cards panel ─────────────────────────────────────────────────────────

export function KpiCardsPanel() {
  const [expanded, setExpanded] = useState(false);
  const { data: runs = [] } = useQuery({
    queryKey: ["strategies", "runs"],
    queryFn: () => strategyApi.listRuns(10),
    staleTime: 300_000,  // 5 minutes — strategy run counts don't need frequent refresh
  });

  const totalRuns = runs.length;
  const lastRun = runs[0];
  const winningRuns = runs.filter(
    (r) => r.current_signal === "BUY"
  ).length;

  return (
    <div className="shrink-0 border-b border-border/10 bg-surface-low">
      {/* Compact KPI strip — always visible */}
      <div className="flex items-center px-3 h-8 gap-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={expanded ? "Collapse" : "Show recent runs"}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Runs</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">{totalRuns}</span>
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Buy</span>
            <span className="text-xs font-semibold text-primary tabular-nums">{winningRuns}</span>
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Last</span>
            <span className="text-xs font-semibold text-foreground font-mono tabular-nums">{lastRun?.symbol ?? "\u2014"}</span>
            {lastRun?.current_signal && (
              <span className={cn("text-xs font-semibold", lastRun.current_signal === "BUY" ? "text-primary" : lastRun.current_signal === "SELL" ? "text-destructive" : "text-muted-foreground")}>
                {lastRun.current_signal}
              </span>
            )}
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          {/* Quick links — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1 shrink-0" data-testid="kpi-card">
            <Link href="/strategies" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <TrendingUp className="h-3 w-3" />
              Strategies
            </Link>
            <Link href="/research?view=screener" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <BarChart4 className="h-3 w-3" />
              Screener
            </Link>
            <Link href="/research?view=watchlist" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <Crosshair className="h-3 w-3" />
              Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* Expandable recent runs table */}
      {expanded && (
        <div className="px-3 pb-2" data-testid="recent-runs">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Recent Strategy Runs</h2>
          {runs.length === 0 ? (
            <p className="text-2xs text-muted-foreground">No strategy runs yet. <Link href="/strategies" className="text-primary hover:underline">Run a strategy</Link> to see results here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/10">
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Symbol</th>
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Mode</th>
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Timeframe</th>
                    <th className="text-left pb-0.5 text-3xs uppercase tracking-widest font-bold">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 5).map((r) => (
                    <tr key={r.id} className="hover:bg-surface-high/30 transition-colors">
                      <td className="pr-3 py-0.5 font-mono font-bold text-foreground">{r.symbol}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.mode_name}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.timeframe}</td>
                      <td className="py-0.5">
                        <span className={r.current_signal === "BUY" ? "text-primary" : r.current_signal === "SELL" ? "text-destructive" : "text-muted-foreground"}>
                          {r.current_signal ?? "\u2014"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
