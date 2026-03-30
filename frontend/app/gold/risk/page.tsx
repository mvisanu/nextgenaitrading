"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { goldApi, type GoldRiskStatus } from "@/lib/api";
import {
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Activity,
  Clock,
  TrendingUp,
  BarChart2,
  LayoutDashboard,
} from "lucide-react";

const SUB_NAV = [
  { href: "/gold", label: "Overview", icon: LayoutDashboard },
  { href: "/gold/signals", label: "Signals", icon: TrendingUp },
  { href: "/gold/performance", label: "Performance", icon: BarChart2 },
  { href: "/gold/risk", label: "Risk", icon: ShieldAlert },
];

const MODE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active: {
    label: "Active",
    color: "text-emerald-400",
    bg: "border-emerald-400/20 bg-emerald-400/5",
    icon: <Activity className="h-4 w-4" />,
  },
  paused: {
    label: "Paused",
    color: "text-amber-400",
    bg: "border-amber-400/20 bg-amber-400/5",
    icon: <Clock className="h-4 w-4" />,
  },
  kill_switch: {
    label: "Kill Switch Active",
    color: "text-red-400",
    bg: "border-red-400/20 bg-red-400/5",
    icon: <ShieldAlert className="h-4 w-4" />,
  },
};

const SYMBOLS = ["XAUUSD", "XAGUSD", "XPTUSD", "USOIL", "BRENTOIL", "COPPER", "NATGAS"];

export default function GoldRiskPage() {
  const [symbols, setSymbols] = useState(["XAUUSD"]);
  const [symbolInput, setSymbolInput] = useState("");
  const [riskData, setRiskData] = useState<Record<string, GoldRiskStatus>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = useCallback(async (syms: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(syms.map((s) => goldApi.riskStatus(s)));
      const map: Record<string, GoldRiskStatus> = {};
      results.forEach((r, i) => { map[syms[i]] = r; });
      setRiskData(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load risk data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRisk(symbols);
    const id = setInterval(() => void fetchRisk(symbols), 30_000);
    return () => clearInterval(id);
  }, [symbols, fetchRisk]);

  const addSymbol = (sym: string) => {
    const clean = sym.trim().toUpperCase();
    if (clean && !symbols.includes(clean)) {
      const next = [...symbols, clean];
      setSymbols(next);
    }
  };

  const removeSymbol = (sym: string) => {
    if (symbols.length <= 1) return;
    setSymbols(symbols.filter((s) => s !== sym));
  };

  return (
    <AppShell title="Risk Management — Commodity">
      <div className="p-3 lg:p-4 space-y-4 max-w-[1400px] mx-auto">

        {/* Sub-nav */}
        <div className="flex items-center gap-2 flex-wrap">
          {SUB_NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 h-7 px-3 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                href === "/gold/risk"
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-border/20"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-black uppercase tracking-widest text-foreground">
              Risk Management Engine
            </span>
          </div>

          {/* Quick add presets */}
          <div className="flex items-center gap-1 flex-wrap">
            {SYMBOLS.map((s) => (
              <button
                key={s}
                onClick={() => symbols.includes(s) ? removeSymbol(s) : addSymbol(s)}
                className={cn(
                  "h-7 px-2.5 rounded text-[11px] font-bold uppercase tracking-widest transition-all border",
                  symbols.includes(s)
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-surface-high border-border/20"
                )}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Custom symbol */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { addSymbol(symbolInput); setSymbolInput(""); } }}
              placeholder="Add symbol..."
              maxLength={20}
              className="h-8 w-32 rounded border border-border/20 bg-surface-2 px-3 text-[12px] font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => void fetchRisk(symbols)}
            disabled={loading}
            title="Refresh (auto-refreshes every 30s)"
            className="h-8 w-8 flex items-center justify-center rounded border border-border/20 bg-surface-2 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-colors disabled:opacity-40"
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

        {/* Risk cards */}
        {loading && Object.keys(riskData).length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {symbols.map((s) => (
              <div key={s} className="h-64 rounded bg-surface-2 border border-border/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {symbols.map((sym) => {
              const risk = riskData[sym];
              if (!risk) return (
                <div key={sym} className="h-64 rounded bg-surface-2 border border-border/10 animate-pulse" />
              );

              const mode = MODE_CONFIG[risk.mode] ?? MODE_CONFIG.active;
              const dailyPct = Math.min((risk.daily_loss_pct / risk.daily_loss_cap_pct) * 100, 100);
              const lossBarColor = dailyPct >= 90 ? "bg-red-400" : dailyPct >= 60 ? "bg-amber-400" : "bg-emerald-400";

              return (
                <div key={sym} className={cn("rounded border p-4 space-y-4", mode.bg)}>
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-foreground tracking-widest">{sym}</span>
                      <button
                        onClick={() => removeSymbol(sym)}
                        className="text-muted-foreground/30 hover:text-muted-foreground/70 text-[10px] transition-colors"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                    <span className={cn("flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest", mode.color)}>
                      {mode.icon}
                      {mode.label}
                    </span>
                  </div>

                  {/* Kill switch warning */}
                  {risk.kill_switch_active && risk.kill_switch_reason && (
                    <div className="flex items-start gap-2 rounded bg-red-400/10 border border-red-400/30 px-3 py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-red-300">{risk.kill_switch_reason}</span>
                    </div>
                  )}

                  {/* Daily loss progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                      <span>Daily Loss Cap</span>
                      <span className="tabular-nums text-foreground/70">
                        {risk.daily_loss_pct.toFixed(2)}% / {risk.daily_loss_cap_pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-surface-high rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", lossBarColor)} style={{ width: `${dailyPct}%` }} />
                    </div>
                  </div>

                  {/* Consecutive losses */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                        Consecutive Losses
                      </span>
                      <span className="text-[13px] font-black tabular-nums text-foreground">
                        {risk.consecutive_losses}
                        <span className="text-muted-foreground/40 text-[11px] font-normal"> / 8</span>
                      </span>
                    </div>
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
                  </div>

                  {/* Blocked signals */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">
                      Signals Blocked Today
                    </span>
                    <span className={cn(
                      "text-[13px] font-black tabular-nums",
                      risk.signals_blocked_today > 0 ? "text-[#ff716a]" : "text-muted-foreground/40"
                    )}>
                      {risk.signals_blocked_today}
                    </span>
                  </div>

                  {/* Last updated */}
                  <div className="text-[10px] text-muted-foreground/30 text-right tabular-nums">
                    Updated {new Date(risk.last_updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Risk rules info */}
        <div className="rounded bg-surface-2 border border-border/10 p-4 space-y-3">
          <div className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">
            Risk Rules
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px]">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-1">Daily Loss Cap</div>
              <div className="font-bold text-foreground">2.0% of equity</div>
              <div className="text-muted-foreground/50 mt-0.5">Blocks all new signals for the day when breached</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-1">Kill Switch</div>
              <div className="font-bold text-foreground">8 consecutive losses</div>
              <div className="text-muted-foreground/50 mt-0.5">Pauses the engine for 24 hours automatically</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold mb-1">Auto-Refresh</div>
              <div className="font-bold text-foreground">Every 30 seconds</div>
              <div className="text-muted-foreground/50 mt-0.5">Live risk status monitoring across all symbols</div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/30 uppercase tracking-wider text-center">
          Paper trading only. No live orders are placed. Not financial advice.
        </p>
      </div>
    </AppShell>
  );
}
