"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import {
  goldApi,
  type GoldStrategyPerformance,
  type GoldPerformanceResponse,
} from "@/lib/api";
import {
  BarChart2,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  LayoutDashboard,
} from "lucide-react";

const STRATEGY_COLORS: Record<string, string> = {
  liquidity_sweep: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  trend_continuation: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  breakout_expansion: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  ema_momentum: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
};

const STRATEGY_LABELS: Record<string, string> = {
  liquidity_sweep: "Liquidity Sweep",
  trend_continuation: "Trend Continuation",
  breakout_expansion: "Breakout Expansion",
  ema_momentum: "EMA Momentum",
};

const SUB_NAV = [
  { href: "/gold", label: "Overview", icon: LayoutDashboard },
  { href: "/gold/signals", label: "Signals", icon: TrendingUp },
  { href: "/gold/performance", label: "Performance", icon: BarChart2 },
  { href: "/gold/risk", label: "Risk", icon: ShieldAlert },
];

const DAY_OPTIONS = [7, 14, 30, 60, 90] as const;

function StatRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/5 last:border-0">
      <span className="text-[11px] text-muted-foreground/60">{label}</span>
      <span className={cn("text-[12px] font-bold tabular-nums", className ?? "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function StrategyCard({ strategy }: { strategy: GoldStrategyPerformance }) {
  const color = STRATEGY_COLORS[strategy.strategy_name] ?? "";
  const winPct = (strategy.win_rate * 100).toFixed(1);
  const ddPct = (strategy.max_drawdown * 100).toFixed(1);

  return (
    <div className="rounded bg-surface-mid border border-border/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className={cn(
          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
          color
        )}>
          {STRATEGY_LABELS[strategy.strategy_name] ?? strategy.strategy_name}
        </span>
        <span className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
          {strategy.total_signals} signals
        </span>
      </div>

      {/* Win rate bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
          <span>Win Rate</span>
          <span className="text-foreground/80 tabular-nums">{winPct}%</span>
        </div>
        <div className="h-2 bg-surface-high rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full",
              strategy.win_rate >= 0.6 ? "bg-emerald-400" : strategy.win_rate >= 0.5 ? "bg-amber-400" : "bg-[#ff716a]"
            )}
            style={{ width: `${winPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-0">
        <StatRow
          label="Expectancy"
          value={`${strategy.expectancy >= 0 ? "+" : ""}${strategy.expectancy.toFixed(2)}R`}
          className={strategy.expectancy >= 0 ? "text-emerald-400" : "text-[#ff716a]"}
        />
        <StatRow label="Profit Factor" value={strategy.profit_factor.toFixed(2)} />
        <StatRow
          label="Max Drawdown"
          value={`-${ddPct}%`}
          className="text-[#ff716a]"
        />
        <StatRow
          label="Avg R-Multiple"
          value={`${strategy.avg_r_multiple >= 0 ? "+" : ""}${strategy.avg_r_multiple.toFixed(2)}R`}
          className={strategy.avg_r_multiple >= 1 ? "text-emerald-400" : "text-amber-400"}
        />
      </div>
    </div>
  );
}

export default function GoldPerformancePage() {
  const [symbolInput, setSymbolInput] = useState("XAUUSD");
  const [committedSymbol, setCommittedSymbol] = useState("XAUUSD");
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<GoldPerformanceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (symbol: string, d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await goldApi.performance(symbol, d);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load performance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData(committedSymbol, days);
  }, [committedSymbol, days, fetchData]);

  const commitSymbol = () => {
    const clean = symbolInput.trim().toUpperCase();
    if (clean.length >= 1) setCommittedSymbol(clean);
  };

  const ranked = data
    ? [...data.strategies].sort((a, b) => b.expectancy - a.expectancy)
    : [];

  return (
    <AppShell title="Performance — Commodity">
      <div className="p-2 sm:p-3 lg:p-4 space-y-4 max-w-[1400px] mx-auto">

        {/* Sub-nav */}
        <div className="flex items-center gap-2 flex-wrap">
          {SUB_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                href === "/gold/performance"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-border/20"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* Header + controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-black uppercase tracking-widest text-foreground">
              Strategy Performance — {committedSymbol}
            </span>
          </div>

          {/* Symbol */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && commitSymbol()}
              placeholder="Symbol..."
              maxLength={20}
              className="h-8 w-32 rounded border border-border/20 bg-surface-mid px-3 text-[12px] font-bold uppercase tracking-widest text-foreground placeholder:text-primary/40 focus:outline-none focus:border-primary/60 transition-colors"
            />
            <button
              onClick={commitSymbol}
              className="h-8 px-3 rounded bg-primary text-background text-[11px] font-black uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              Load
            </button>
          </div>

          {/* Days selector */}
          <div className="flex items-center gap-1 flex-wrap">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  "h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                  d === days
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-transparent"
                )}
              >
                {d}d
              </button>
            ))}
          </div>

          <button
            onClick={() => void fetchData(committedSymbol, days)}
            disabled={loading}
            title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded border border-border/20 bg-surface-mid text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-52 rounded bg-surface-mid border border-border/10 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Overall summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded bg-surface-mid border border-primary/20 p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                  Overall Win Rate
                </div>
                <div className="text-2xl font-black text-primary tabular-nums">
                  {(data.overall_win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="rounded bg-surface-mid border border-border/10 p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                  Avg Expectancy
                </div>
                <div className={cn(
                  "text-2xl font-black tabular-nums",
                  data.overall_expectancy >= 0 ? "text-emerald-400" : "text-[#ff716a]"
                )}>
                  {data.overall_expectancy >= 0 ? "+" : ""}
                  {data.overall_expectancy.toFixed(2)}R
                </div>
              </div>
              <div className="rounded bg-surface-mid border border-border/10 p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                  Strategies
                </div>
                <div className="text-2xl font-black text-foreground tabular-nums">
                  {data.strategies.length}
                </div>
              </div>
              <div className="rounded bg-surface-mid border border-border/10 p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
                  Window
                </div>
                <div className="text-2xl font-black text-foreground tabular-nums">
                  {data.days}d
                </div>
              </div>
            </div>

            {/* Strategy ranking table */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Strategy Rankings (by Expectancy)
                </span>
              </div>
              <div className="overflow-x-auto rounded border border-border/10">
                <table className="w-full text-[11px] tabular-nums">
                  <thead>
                    <tr className="border-b border-border/10 bg-surface-mid">
                      {["Rank", "Strategy", "Win Rate", "Expectancy", "Profit Factor", "Max DD", "Avg R", "Signals"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((s, i) => (
                      <tr
                        key={s.strategy_name}
                        className={cn(
                          "border-b border-border/5 transition-colors",
                          i % 2 === 0 ? "bg-surface-lowest" : "bg-surface-mid/50",
                          "hover:bg-surface-mid/30"
                        )}
                      >
                        <td className="px-3 py-2.5 font-black text-muted-foreground/40">
                          #{i + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                            STRATEGY_COLORS[s.strategy_name] ?? ""
                          )}>
                            {STRATEGY_LABELS[s.strategy_name] ?? s.strategy_name}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{(s.win_rate * 100).toFixed(1)}%</td>
                        <td className={cn("px-3 py-2.5 font-bold", s.expectancy >= 0 ? "text-emerald-400" : "text-[#ff716a]")}>
                          {s.expectancy >= 0 ? "+" : ""}{s.expectancy.toFixed(2)}R
                        </td>
                        <td className="px-3 py-2.5 font-semibold">{s.profit_factor.toFixed(2)}</td>
                        <td className="px-3 py-2.5 font-semibold text-[#ff716a]">-{(s.max_drawdown * 100).toFixed(1)}%</td>
                        <td className={cn("px-3 py-2.5 font-bold", s.avg_r_multiple >= 1 ? "text-emerald-400" : "text-amber-400")}>
                          {s.avg_r_multiple >= 0 ? "+" : ""}{s.avg_r_multiple.toFixed(2)}R
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground/60">{s.total_signals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strategy cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {ranked.map((s) => (
                <StrategyCard key={s.strategy_name} strategy={s} />
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-[10px] text-muted-foreground/30 uppercase tracking-wider text-center">
          Historically favorable entry zones only. Not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
