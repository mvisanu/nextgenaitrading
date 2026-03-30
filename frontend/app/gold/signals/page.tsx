"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  goldApi,
  type GoldSignal,
} from "@/lib/api";
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Zap,
  BarChart2,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";

const TIMEFRAMES = ["15min", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

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

const STATUS_COLORS: Record<string, string> = {
  candidate: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  blocked: "text-red-400 bg-red-400/10 border-red-400/30",
  expired: "text-muted-foreground bg-muted/10 border-border/30",
  sent: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

function StrategyBadge({ name }: { name: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
      STRATEGY_COLORS[name] ?? "text-muted-foreground bg-muted/10 border-border/30"
    )}>
      {STRATEGY_LABELS[name] ?? name}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: "long" | "short" }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-widest border",
      direction === "long"
        ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
        : "text-[#ff716a] bg-[#ff716a]/10 border-[#ff716a]/30"
    )}>
      {direction === "long" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {direction.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: GoldSignal["status"] }) {
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
      STATUS_COLORS[status] ?? "text-muted-foreground bg-muted/10 border-border/30"
    )}>
      {status}
    </span>
  );
}

const SUB_NAV = [
  { href: "/gold", label: "Overview", icon: LayoutDashboard },
  { href: "/gold/signals", label: "Signals", icon: TrendingUp },
  { href: "/gold/performance", label: "Performance", icon: BarChart2 },
  { href: "/gold/risk", label: "Risk", icon: ShieldAlert },
];

export default function GoldSignalsPage() {
  const [symbolInput, setSymbolInput] = useState("XAUUSD");
  const [committedSymbol, setCommittedSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [signals, setSignals] = useState<GoldSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = useCallback(async (symbol: string, tf: Timeframe) => {
    setLoading(true);
    setError(null);
    try {
      const res = await goldApi.signals(symbol, tf, 50);
      setSignals(res.signals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSignals(committedSymbol, timeframe);
  }, [committedSymbol, timeframe, fetchSignals]);

  const commitSymbol = useCallback(() => {
    const clean = symbolInput.trim().toUpperCase();
    if (clean.length < 1) return;
    setCommittedSymbol(clean);
  }, [symbolInput]);

  const filtered = statusFilter === "all"
    ? signals
    : signals.filter((s) => s.status === statusFilter);

  const fmtPrice = (v: number) =>
    v >= 1000
      ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : v.toFixed(4);

  return (
    <AppShell title="Signals — Commodity">
      <div className="p-3 lg:p-4 space-y-4 max-w-[1400px] mx-auto">

        {/* Sub-nav */}
        <div className="flex items-center gap-2 flex-wrap">
          {SUB_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                href === "/gold/signals"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-border/20"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-black uppercase tracking-widest text-foreground">
              Signals — {committedSymbol}
            </span>
          </div>

          {/* Symbol input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && commitSymbol()}
              placeholder="Symbol..."
              maxLength={20}
              className="h-8 w-32 rounded border border-border/20 bg-surface-2 px-3 text-[12px] font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
            />
            <Button size="sm" onClick={commitSymbol} className="h-8 px-3 text-[11px] font-black uppercase tracking-widest">
              Load
            </Button>
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                  tf === timeframe
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-transparent"
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1">
            {["all", "approved", "candidate", "blocked", "sent", "expired"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                  s === statusFilter
                    ? "bg-surface-high text-foreground border-border/40"
                    : "text-muted-foreground/50 hover:text-foreground border-transparent"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => void fetchSignals(committedSymbol, timeframe)}
            disabled={loading}
            title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded border border-border/20 bg-surface-2 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Analyze button */}
        <Button
          onClick={async () => {
            setLoading(true);
            setError(null);
            try {
              const res = await goldApi.analyze(committedSymbol, timeframe);
              setSignals((prev) => [...res.signals, ...prev].slice(0, 50));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Analysis failed");
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="h-9 text-[11px] font-black uppercase tracking-widest gap-2"
        >
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Run Analysis
        </Button>

        {/* Signals table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 rounded bg-surface-2 border border-border/10 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 rounded bg-surface-2 border border-border/10 text-muted-foreground/40 text-[12px] uppercase tracking-widest">
            No signals matching filter
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border/10">
            <table className="w-full text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-border/10 bg-surface-2">
                  {["Time", "Strategy", "Dir", "Entry", "SL", "TP", "R:R", "TF", "Conf", "Pos Size", "Volatility", "Status", "Reasoning"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sig, i) => {
                  const ts = new Date(sig.timestamp);
                  return (
                    <tr
                      key={sig.id}
                      className={cn(
                        "border-b border-border/5 transition-colors",
                        i % 2 === 0 ? "bg-surface-lowest" : "bg-surface-2/50",
                        "hover:bg-surface-mid/30"
                      )}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground/50">
                        {ts.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                        {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap"><StrategyBadge name={sig.strategy_name} /></td>
                      <td className="px-3 py-2"><DirectionBadge direction={sig.direction} /></td>
                      <td className="px-3 py-2 font-semibold text-foreground">{fmtPrice(sig.entry_price)}</td>
                      <td className="px-3 py-2 font-semibold text-[#ff716a]">{fmtPrice(sig.stop_loss)}</td>
                      <td className="px-3 py-2 font-semibold text-emerald-400">{fmtPrice(sig.take_profit)}</td>
                      <td className="px-3 py-2 font-semibold text-foreground/70">1:{sig.risk_reward_ratio.toFixed(2)}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded bg-surface-high text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                          {sig.timeframe}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5 w-20">
                          <div className="flex-1 h-1 bg-surface-high rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                sig.confidence_score >= 80 ? "bg-emerald-400" : sig.confidence_score >= 65 ? "bg-amber-400" : "bg-[#ff716a]"
                              )}
                              style={{ width: `${sig.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-foreground/70">{sig.confidence_score}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground/60">
                        {(sig.position_size_recommendation * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-muted-foreground/60">
                        {sig.volatility_snapshot.toFixed(2)}
                      </td>
                      <td className="px-3 py-2"><StatusBadge status={sig.status} /></td>
                      <td className="px-3 py-2 max-w-[280px] text-muted-foreground/60 truncate" title={sig.reasoning_summary}>
                        {sig.reasoning_summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/30 uppercase tracking-wider text-center">
          Historically favorable entry zones only. Not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
