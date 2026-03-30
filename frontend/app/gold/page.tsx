"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  goldApi,
  type GoldSignal,
  type GoldRiskStatus,
  type GoldPerformanceResponse,
  type GoldStrategyPerformance,
} from "@/lib/api";
import {
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Zap,
  BarChart2,
  ChevronUp,
  ChevronDown,
  Clock,
  WifiOff,
  LayoutDashboard,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const MODE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  active: {
    label: "Active",
    color: "text-emerald-400",
    icon: <Activity className="h-3.5 w-3.5" />,
  },
  paused: {
    label: "Paused",
    color: "text-amber-400",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  kill_switch: {
    label: "Kill Switch",
    color: "text-red-400",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StrategyBadge({ name }: { name: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
        STRATEGY_COLORS[name] ?? "text-muted-foreground bg-muted/10 border-border/30"
      )}
    >
      {STRATEGY_LABELS[name] ?? name}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: "long" | "short" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-widest border",
        direction === "long"
          ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
          : "text-[#ff716a] bg-[#ff716a]/10 border-[#ff716a]/30"
      )}
    >
      {direction === "long" ? (
        <ChevronUp className="h-3 w-3" />
      ) : (
        <ChevronDown className="h-3 w-3" />
      )}
      {direction.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: GoldSignal["status"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
        STATUS_COLORS[status] ?? "text-muted-foreground bg-muted/10 border-border/30"
      )}
    >
      {status}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-400"
      : score >= 65
      ? "bg-amber-400"
      : "bg-[#ff716a]";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[11px] font-bold tabular-nums text-foreground/80 w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function PriceCell({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass?: string;
}) {
  const formatted =
    value >= 1000
      ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
        {label}
      </span>
      <span className={cn("text-[12px] font-bold tabular-nums", colorClass ?? "text-foreground")}>
        {formatted}
      </span>
    </div>
  );
}

function SignalCard({ signal }: { signal: GoldSignal }) {
  const ts = new Date(signal.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = ts.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className="rounded bg-surface-2 border border-border/10 p-3 space-y-2.5 hover:border-border/30 transition-colors">
      {/* Header row */}
      <div className="flex items-start gap-2 flex-wrap">
        <StrategyBadge name={signal.strategy_name} />
        <DirectionBadge direction={signal.direction} />
        <StatusBadge status={signal.status} />
        <span className="ml-auto text-[10px] text-muted-foreground/50 tabular-nums whitespace-nowrap">
          {dateStr} {timeStr}
        </span>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-3 gap-3">
        <PriceCell label="Entry" value={signal.entry_price} colorClass="text-foreground" />
        <PriceCell label="Stop Loss" value={signal.stop_loss} colorClass="text-[#ff716a]" />
        <PriceCell label="Take Profit" value={signal.take_profit} colorClass="text-emerald-400" />
      </div>

      {/* R:R + Timeframe row */}
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-muted-foreground/60 uppercase tracking-widest text-[10px] font-semibold">
          R:R
        </span>
        <span className="font-bold text-foreground tabular-nums">
          1 : {signal.risk_reward_ratio.toFixed(2)}
        </span>
        <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-high text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {signal.timeframe}
        </span>
        <span className="ml-auto text-muted-foreground/50 text-[10px]">
          vol {signal.volatility_snapshot.toFixed(2)}
        </span>
      </div>

      {/* Confidence */}
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold mb-1">
          Confidence
        </div>
        <ConfidenceBar score={signal.confidence_score} />
      </div>

      {/* Reasoning */}
      <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">
        {signal.reasoning_summary}
      </p>
    </div>
  );
}

function RiskPanel({ risk }: { risk: GoldRiskStatus }) {
  const mode = MODE_CONFIG[risk.mode] ?? MODE_CONFIG.active;
  const dailyPct = Math.min((risk.daily_loss_pct / risk.daily_loss_cap_pct) * 100, 100);
  const lossBarColor =
    dailyPct >= 90 ? "bg-red-400" : dailyPct >= 60 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="rounded bg-surface-2 border border-border/10 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className={cn("flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest", mode.color)}>
          {mode.icon}
          {mode.label}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums">
          {new Date(risk.last_updated).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {risk.kill_switch_active && risk.kill_switch_reason && (
        <div className="flex items-start gap-2 rounded bg-red-400/5 border border-red-400/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <span className="text-[11px] text-red-300">{risk.kill_switch_reason}</span>
        </div>
      )}

      {/* Daily Loss */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
          <span>Daily Loss</span>
          <span className="tabular-nums text-foreground/70">
            {risk.daily_loss_pct.toFixed(2)}% / {risk.daily_loss_cap_pct.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-surface-high rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", lossBarColor)}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      {/* Consecutive Losses */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
          Consecutive Losses
        </span>
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {risk.consecutive_losses}
          <span className="text-muted-foreground/40 text-[11px] font-normal"> / 8</span>
        </span>
      </div>

      {/* Consecutive loss dots */}
      <div className="flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-2 flex-1 rounded-sm",
              i < risk.consecutive_losses ? "bg-[#ff716a]" : "bg-surface-high"
            )}
          />
        ))}
      </div>

      {/* Signals Blocked */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
          Signals Blocked Today
        </span>
        <span className="text-[13px] font-black tabular-nums text-[#ff716a]">
          {risk.signals_blocked_today}
        </span>
      </div>
    </div>
  );
}

function PerformanceCard({ strategy }: { strategy: GoldStrategyPerformance }) {
  const colorClass = STRATEGY_COLORS[strategy.strategy_name] ?? "";

  return (
    <div className="rounded bg-surface-2 border border-border/10 p-3 space-y-2">
      <StrategyBadge name={strategy.strategy_name} />

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/60">Win Rate</span>
          <span className="font-bold tabular-nums text-foreground">
            {(strategy.win_rate * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/60">Expectancy</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              strategy.expectancy >= 0 ? "text-emerald-400" : "text-[#ff716a]"
            )}
          >
            {strategy.expectancy >= 0 ? "+" : ""}
            {strategy.expectancy.toFixed(2)}R
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/60">Profit Factor</span>
          <span className="font-bold tabular-nums text-foreground">
            {strategy.profit_factor.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground/60">Max DD</span>
          <span className="font-bold tabular-nums text-[#ff716a]">
            -{(strategy.max_drawdown * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center justify-between col-span-2">
          <span className="text-muted-foreground/60">Avg R-Multiple</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              strategy.avg_r_multiple >= 1 ? "text-emerald-400" : "text-amber-400"
            )}
          >
            {strategy.avg_r_multiple >= 0 ? "+" : ""}
            {strategy.avg_r_multiple.toFixed(2)}R
          </span>
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">
        {strategy.total_signals} signals
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GoldPage() {
  const [symbolInput, setSymbolInput] = useState("XAUUSD");
  const [committedSymbol, setCommittedSymbol] = useState("XAUUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");

  const [signals, setSignals] = useState<GoldSignal[]>([]);
  const [risk, setRisk] = useState<GoldRiskStatus | null>(null);
  const [performance, setPerformance] = useState<GoldPerformanceResponse | null>(null);

  const [loadingSignals, setLoadingSignals] = useState(false);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingPerf, setLoadingPerf] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);

  const [analyzeMsg, setAnalyzeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Connection status: null = checking, true = online, false = offline
  const [engineOnline, setEngineOnline] = useState<boolean | null>(null);

  // Fetch signals + risk + performance whenever committed symbol or timeframe changes
  const fetchAll = useCallback(async (symbol: string, tf: Timeframe) => {
    setError(null);
    setLoadingSignals(true);
    setLoadingRisk(true);
    setLoadingPerf(true);

    try {
      const [sigRes, riskRes, perfRes] = await Promise.all([
        goldApi.signals(symbol, tf, 20),
        goldApi.riskStatus(symbol),
        goldApi.performance(symbol, 30),
      ]);
      setSignals(sigRes.signals);
      setRisk(riskRes);
      setPerformance(perfRes);
      setEngineOnline(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load data";
      // Distinguish "engine offline" from other errors
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed to fetch")) {
        setEngineOnline(false);
      }
      setError(msg);
    } finally {
      setLoadingSignals(false);
      setLoadingRisk(false);
      setLoadingPerf(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll(committedSymbol, timeframe);
  }, [committedSymbol, timeframe, fetchAll]);

  const handleAnalyze = useCallback(async () => {
    setLoadingAnalyze(true);
    setAnalyzeMsg(null);
    setError(null);
    try {
      const res = await goldApi.analyze(committedSymbol, timeframe);
      setAnalyzeMsg(res.message);
      // Prepend the fresh signals to the list
      setSignals((prev) => [...res.signals, ...prev].slice(0, 30));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoadingAnalyze(false);
    }
  }, [committedSymbol, timeframe]);

  const handleSymbolCommit = useCallback(() => {
    const clean = symbolInput.trim().toUpperCase();
    if (clean.length < 1) return;
    setCommittedSymbol(clean);
    setAnalyzeMsg(null);
  }, [symbolInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSymbolCommit();
    },
    [handleSymbolCommit]
  );

  const modeConfig = risk ? (MODE_CONFIG[risk.mode] ?? MODE_CONFIG.active) : null;

  return (
    <AppShell title="Commodity Signals">
      <div className="p-3 lg:p-4 space-y-4 max-w-[1400px] mx-auto">

        {/* ── Backend offline banner ────────────────────────────────────── */}
        {engineOnline === false && (
          <div className="flex items-start gap-3 rounded border border-amber-400/30 bg-amber-400/5 px-4 py-3">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-bold text-amber-300 uppercase tracking-widest">
                Backend offline
              </p>
              <p className="text-[11px] text-amber-300/70 font-mono">
                cd backend &amp;&amp; uvicorn app.main:app --reload
              </p>
            </div>
          </div>
        )}

        {/* ── Sub-page quick links ─────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { href: "/gold", label: "Overview", icon: LayoutDashboard },
            { href: "/gold/signals", label: "Signals", icon: TrendingUp },
            { href: "/gold/performance", label: "Performance", icon: BarChart2 },
            { href: "/gold/risk", label: "Risk", icon: ShieldAlert },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                href === "/gold"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-border/20"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          {/* Title + connection dot */}
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-black uppercase tracking-widest text-foreground">
              Commodity Signal Engine
            </span>
            {/* Connection status dot */}
            {engineOnline === null ? (
              <span
                title="Checking connection..."
                className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse"
              />
            ) : engineOnline ? (
              <span
                title="Gold engine online"
                className="h-2 w-2 rounded-full bg-emerald-400"
              />
            ) : (
              <span
                title="Gold engine offline"
                className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"
              />
            )}
          </div>

          {/* Symbol input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter symbol..."
              maxLength={20}
              className={cn(
                "h-8 w-36 rounded border border-border/20 bg-surface-2 px-3",
                "text-[12px] font-bold uppercase tracking-widest text-foreground",
                "placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60",
                "transition-colors"
              )}
            />
            <Button
              size="sm"
              variant="default"
              onClick={handleSymbolCommit}
              className="h-8 px-3 text-[11px] font-black uppercase tracking-widest"
            >
              Load
            </Button>
          </div>

          {/* Active symbol display */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/20">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
              Active
            </span>
            <span className="text-[12px] font-black text-primary tracking-widest">
              {committedSymbol}
            </span>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all",
                  tf === timeframe
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border border-transparent"
                )}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Mode badge */}
          {modeConfig && (
            <div
              className={cn(
                "ml-auto flex items-center gap-1.5 px-2 py-1 rounded border text-[11px] font-black uppercase tracking-widest",
                risk?.mode === "active"
                  ? "text-emerald-400 bg-emerald-400/5 border-emerald-400/20"
                  : risk?.mode === "kill_switch"
                  ? "text-red-400 bg-red-400/5 border-red-400/20"
                  : "text-amber-400 bg-amber-400/5 border-amber-400/20"
              )}
            >
              {modeConfig.icon}
              {modeConfig.label}
            </div>
          )}

          {/* Refresh */}
          <button
            onClick={() => void fetchAll(committedSymbol, timeframe)}
            disabled={loadingSignals}
            title="Refresh"
            className="h-8 w-8 flex items-center justify-center rounded border border-border/20 bg-surface-2 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingSignals && "animate-spin")} />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Analyze message */}
        {analyzeMsg && (
          <div className="flex items-start gap-2 rounded border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-primary/80">
            <Activity className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {analyzeMsg}
          </div>
        )}

        {/* ── Main 2-column layout ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">

          {/* ── LEFT: Signal cards + history table ──────────────────────── */}
          <div className="space-y-4">

            {/* Signal cards grid */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Live Signals
                </span>
                <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-high text-[10px] font-bold text-muted-foreground/50">
                  {signals.length}
                </span>
              </div>

              {loadingSignals ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-52 rounded bg-surface-2 border border-border/10 animate-pulse"
                    />
                  ))}
                </div>
              ) : signals.length === 0 ? (
                <div className="flex items-center justify-center h-32 rounded bg-surface-2 border border-border/10 text-muted-foreground/40 text-[12px] uppercase tracking-widest">
                  No signals — click Analyze to generate
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {signals.slice(0, 6).map((sig) => (
                    <SignalCard key={sig.id} signal={sig} />
                  ))}
                </div>
              )}
            </div>

            {/* Signals history table */}
            {signals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground/60" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                    Signal History
                  </span>
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-high text-[10px] font-bold text-muted-foreground/50">
                    {signals.length}
                  </span>
                </div>

                <div className="overflow-x-auto rounded border border-border/10">
                  <table className="w-full text-[11px] tabular-nums">
                    <thead>
                      <tr className="border-b border-border/10 bg-surface-2">
                        {[
                          "Time",
                          "Strategy",
                          "Dir",
                          "Entry",
                          "SL",
                          "TP",
                          "R:R",
                          "Conf",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {signals.map((sig, i) => {
                        const ts = new Date(sig.timestamp);
                        const fmtPrice = (v: number) =>
                          v >= 1000
                            ? v.toLocaleString("en-US", { maximumFractionDigits: 2 })
                            : v.toFixed(4);
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
                            <td className="px-3 py-2 whitespace-nowrap">
                              <StrategyBadge name={sig.strategy_name} />
                            </td>
                            <td className="px-3 py-2">
                              <DirectionBadge direction={sig.direction} />
                            </td>
                            <td className="px-3 py-2 text-foreground font-semibold">
                              {fmtPrice(sig.entry_price)}
                            </td>
                            <td className="px-3 py-2 text-[#ff716a] font-semibold">
                              {fmtPrice(sig.stop_loss)}
                            </td>
                            <td className="px-3 py-2 text-emerald-400 font-semibold">
                              {fmtPrice(sig.take_profit)}
                            </td>
                            <td className="px-3 py-2 text-foreground/70 font-semibold">
                              1:{sig.risk_reward_ratio.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5 w-20">
                                <div className="flex-1 h-1 bg-surface-high rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full",
                                      sig.confidence_score >= 80
                                        ? "bg-emerald-400"
                                        : sig.confidence_score >= 65
                                        ? "bg-amber-400"
                                        : "bg-[#ff716a]"
                                    )}
                                    style={{ width: `${sig.confidence_score}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-foreground/70">
                                  {sig.confidence_score}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={sig.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: Risk + Performance + Analyze button ───────────────── */}
          <div className="space-y-4">

            {/* Risk status panel */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Risk Status
                </span>
              </div>
              {loadingRisk ? (
                <div className="h-44 rounded bg-surface-2 border border-border/10 animate-pulse" />
              ) : risk ? (
                <RiskPanel risk={risk} />
              ) : null}
            </div>

            {/* Run Analysis button */}
            <Button
              onClick={() => void handleAnalyze()}
              disabled={loadingAnalyze}
              className="w-full h-10 text-[11px] font-black uppercase tracking-widest gap-2"
            >
              {loadingAnalyze ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {loadingAnalyze ? "Analyzing..." : `Run Analysis — ${committedSymbol}`}
            </Button>

            {/* Disclaimer */}
            <p className="text-[10px] text-muted-foreground/30 uppercase tracking-wider leading-relaxed text-center">
              Historically favorable entry zones only.
              Not financial advice. Past performance does not guarantee future results.
            </p>

            {/* Strategy performance cards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
                  Strategy Performance
                </span>
                <span className="ml-1 text-[10px] text-muted-foreground/40">
                  ({performance?.days ?? 30}d)
                </span>
              </div>

              {loadingPerf ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-28 rounded bg-surface-2 border border-border/10 animate-pulse"
                    />
                  ))}
                </div>
              ) : performance ? (
                <div className="space-y-2">
                  {/* Overall summary */}
                  <div className="rounded bg-surface-2 border border-primary/20 p-3 flex gap-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                        Overall Win Rate
                      </span>
                      <span className="text-base font-black text-primary tabular-nums">
                        {(performance.overall_win_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">
                        Avg Expectancy
                      </span>
                      <span
                        className={cn(
                          "text-base font-black tabular-nums",
                          performance.overall_expectancy >= 0
                            ? "text-emerald-400"
                            : "text-[#ff716a]"
                        )}
                      >
                        {performance.overall_expectancy >= 0 ? "+" : ""}
                        {performance.overall_expectancy.toFixed(2)}R
                      </span>
                    </div>
                  </div>

                  {performance.strategies.map((s) => (
                    <PerformanceCard key={s.strategy_name} strategy={s} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
