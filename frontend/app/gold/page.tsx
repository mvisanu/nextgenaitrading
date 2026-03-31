"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  goldApi,
  commodityAlertApi,
  type GoldSignal,
  type GoldRiskStatus,
  type GoldPerformanceResponse,
  type GoldStrategyPerformance,
  type CommodityAlertPrefs,
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
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Check,
  HelpCircle,
  ChevronRight,
  Info,
  Shield,
  TrendingDown,
  BookOpen,
} from "lucide-react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIMEFRAMES = ["15min", "1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

const TIMEFRAME_LABELS: Record<string, string> = {
  "15min": "15 Min",
  "1h": "1 Hour",
  "4h": "4 Hours",
  "1d": "Daily",
};

const STRATEGY_PLAIN: Record<string, { label: string; description: string; color: string }> = {
  liquidity_sweep: {
    label: "Liquidity Sweep",
    description: "Price sweeps past a key level to collect orders, then reverses sharply.",
    color: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  },
  trend_continuation: {
    label: "Trend Continuation",
    description: "Price is in a strong trend and likely to keep moving in the same direction.",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  },
  breakout_expansion: {
    label: "Breakout",
    description: "Price breaks through a key resistance or support level with momentum.",
    color: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  },
  ema_momentum: {
    label: "Momentum",
    description: "Moving averages are aligned and price has strong directional momentum.",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  },
};

// ---------------------------------------------------------------------------
// Tooltip component — shows an explanation on hover
// ---------------------------------------------------------------------------

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <span
        className="cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        tabIndex={0}
      >
        <HelpCircle className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors" />
      </span>
      {show && (
        <span className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-lg border border-border/30 bg-surface-2 p-3 text-[11px] text-muted-foreground/80 leading-relaxed shadow-xl pointer-events-none">
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confidence pill — colour-coded with plain-English label
// ---------------------------------------------------------------------------

function ConfidencePill({ score }: { score: number }) {
  const level =
    score >= 80 ? { label: "High", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" } :
    score >= 65 ? { label: "Medium", color: "text-amber-400 bg-amber-400/10 border-amber-400/30" } :
    { label: "Low", color: "text-[#ff716a] bg-[#ff716a]/10 border-[#ff716a]/30" };

  return (
    <Tip text={`Confidence ${score}% — how strongly the technical indicators agree. Higher = stronger signal.`}>
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border", level.color)}>
        {level.label} confidence ({score}%)
      </span>
    </Tip>
  );
}

// ---------------------------------------------------------------------------
// Direction hero badge
// ---------------------------------------------------------------------------

function DirectionHero({ direction }: { direction: "long" | "short" }) {
  const isBuy = direction === "long";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-base font-black uppercase tracking-wider border-2",
        isBuy
          ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/40"
          : "text-[#ff716a] bg-[#ff716a]/10 border-[#ff716a]/40"
      )}
    >
      {isBuy ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
      {isBuy ? "Buy Signal" : "Sell Signal"}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero signal card — the most recent approved/candidate signal, beginner-friendly
// ---------------------------------------------------------------------------

function HeroSignalCard({ signal }: { signal: GoldSignal }) {
  const isBuy = signal.direction === "long";
  const strategyInfo = STRATEGY_PLAIN[signal.strategy_name];
  const fmtPrice = (v: number) =>
    v >= 1000
      ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : v.toFixed(4);

  const rrRatio = signal.risk_reward_ratio.toFixed(1);
  const ts = new Date(signal.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dateStr = ts.toLocaleDateString([], { month: "short", day: "numeric" });

  return (
    <div className={cn(
      "rounded-2xl border-2 p-6 space-y-5 transition-all",
      isBuy
        ? "border-emerald-400/30 bg-emerald-400/[0.03]"
        : "border-[#ff716a]/30 bg-[#ff716a]/[0.03]"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50 uppercase tracking-widest">
            <Clock className="h-3 w-3" />
            {dateStr} at {timeStr}
          </div>
          <DirectionHero direction={signal.direction} />
        </div>
        <ConfidencePill score={signal.confidence_score} />
      </div>

      {/* Plain-language strategy */}
      {strategyInfo && (
        <div className="flex items-start gap-2 rounded-xl bg-surface-2 border border-border/10 px-4 py-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-bold text-foreground/90">{strategyInfo.label} Pattern</p>
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{strategyInfo.description}</p>
          </div>
        </div>
      )}

      {/* Reasoning */}
      <p className="text-[13px] text-muted-foreground/80 leading-relaxed">
        {signal.reasoning_summary}
      </p>

      {/* Price levels — large and clear */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-2 border border-border/10 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
            <Tip text="The price at which the AI recommends entering the trade.">Entry Price</Tip>
          </p>
          <p className="text-lg font-black text-foreground tabular-nums">{fmtPrice(signal.entry_price)}</p>
          <p className="text-[10px] text-muted-foreground/40">Where to buy/sell</p>
        </div>
        <div className="rounded-xl bg-surface-2 border border-[#ff716a]/20 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-[#ff716a]/70 font-semibold">
            <Tip text="Your exit price if the trade goes wrong. This limits your loss. Always set this before entering!">Stop Loss</Tip>
          </p>
          <p className="text-lg font-black text-[#ff716a] tabular-nums">{fmtPrice(signal.stop_loss)}</p>
          <p className="text-[10px] text-[#ff716a]/50">Exit if wrong</p>
        </div>
        <div className="rounded-xl bg-surface-2 border border-emerald-400/20 p-4 text-center space-y-1">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-semibold">
            <Tip text="Your target price to take profits. If price reaches here, the trade was successful.">Take Profit</Tip>
          </p>
          <p className="text-lg font-black text-emerald-400 tabular-nums">{fmtPrice(signal.take_profit)}</p>
          <p className="text-[10px] text-emerald-400/50">Target exit</p>
        </div>
      </div>

      {/* Risk/Reward explainer */}
      <div className="rounded-xl bg-surface-2 border border-border/10 px-4 py-3 flex items-center gap-4">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold">
            <Tip text="Risk:Reward ratio. A 1:2 ratio means for every $1 you risk losing, you stand to gain $2. Higher is better.">
              Risk vs. Reward
            </Tip>
          </p>
          <p className="text-base font-black text-foreground">
            Risk $1 → Gain ${rrRatio}
          </p>
        </div>
        <div className="flex-1 h-2 rounded-full bg-surface-high overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400/70"
            style={{ width: `${Math.min((signal.risk_reward_ratio / 5) * 100, 100)}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-full border",
          signal.risk_reward_ratio >= 2
            ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/30"
            : "text-amber-400 bg-amber-400/10 border-amber-400/30"
        )}>
          {signal.risk_reward_ratio >= 2 ? "Favorable" : "Moderate"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
        <span className="px-2 py-0.5 rounded bg-surface-high font-bold uppercase tracking-wider">
          {TIMEFRAME_LABELS[signal.timeframe] ?? signal.timeframe} chart
        </span>
        <span>·</span>
        <span>Volatility index: {signal.volatility_snapshot.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Traffic-light risk status — replaces the dense RiskPanel
// ---------------------------------------------------------------------------

function RiskTrafficLight({ risk }: { risk: GoldRiskStatus }) {
  const isOk = risk.mode === "active";
  const isPaused = risk.mode === "paused";
  const isHalted = risk.mode === "kill_switch";

  const dailyPct = Math.min((risk.daily_loss_pct / risk.daily_loss_cap_pct) * 100, 100);

  return (
    <div className="rounded-2xl border border-border/10 bg-surface-2 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
          isOk ? "bg-emerald-400/10" : isPaused ? "bg-amber-400/10" : "bg-red-400/10"
        )}>
          {isOk
            ? <Shield className="h-5 w-5 text-emerald-400" />
            : isPaused
            ? <Clock className="h-5 w-5 text-amber-400" />
            : <ShieldAlert className="h-5 w-5 text-red-400" />}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {isOk ? "Risk looks healthy" : isPaused ? "Trading paused" : "Trading halted"}
          </p>
          <p className="text-[11px] text-muted-foreground/60">
            {isOk
              ? "The system is within safe risk limits."
              : isPaused
              ? "Signals are paused temporarily."
              : "A safety limit was hit — no new signals."}
          </p>
        </div>
      </div>

      {isHalted && risk.kill_switch_reason && (
        <div className="flex items-start gap-2 rounded-xl bg-red-400/5 border border-red-400/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300">{risk.kill_switch_reason}</p>
        </div>
      )}

      {/* Daily loss meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground/60">
            <Tip text="How much of today's maximum allowed loss has been used. If it reaches 100%, trading halts automatically.">
              Today&apos;s loss limit used
            </Tip>
          </p>
          <p className="text-[12px] font-bold tabular-nums text-foreground/70">
            {dailyPct.toFixed(0)}%
          </p>
        </div>
        <div className="h-2.5 bg-surface-high rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              dailyPct >= 90 ? "bg-red-400" : dailyPct >= 60 ? "bg-amber-400" : "bg-emerald-400"
            )}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
        {dailyPct >= 60 && (
          <p className="text-[10px] text-amber-400/70">
            {dailyPct >= 90
              ? "Close to the daily limit — be cautious with new trades."
              : "Moderate losses today — consider sizing down."}
          </p>
        )}
      </div>

      {risk.consecutive_losses > 0 && (
        <div className="flex items-center justify-between text-[11px]">
          <Tip text="Number of losing trades in a row. After 8 consecutive losses, trading halts automatically.">
            <span className="text-muted-foreground/60">Losses in a row</span>
          </Tip>
          <div className="flex gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 w-4 rounded-sm",
                  i < risk.consecutive_losses ? "bg-[#ff716a]" : "bg-surface-high"
                )}
              />
            ))}
            <span className="ml-2 font-bold text-foreground/70">{risk.consecutive_losses}/8</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// How-it-works explainer — collapsible
// ---------------------------------------------------------------------------

function HowItWorks() {
  const [open, setOpen] = useState(false);

  const steps = [
    {
      num: "1",
      title: "Data is collected",
      desc: "Live price data is fetched every 15 minutes from real markets.",
      color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    },
    {
      num: "2",
      title: "4 conditions are checked",
      desc: "Moving averages, trend direction, momentum (RSI), and trading volume must all agree.",
      color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    },
    {
      num: "3",
      title: "A signal is generated",
      desc: "If all 4 conditions pass, a Buy or Sell signal is created with an entry price, stop loss, and target.",
      color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    },
    {
      num: "4",
      title: "You decide",
      desc: "This is a suggestion, not financial advice. Always use your own judgement and risk management.",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    },
  ];

  return (
    <div className="rounded-2xl border border-border/10 bg-surface-2 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-high/30 transition-colors text-left"
      >
        <BookOpen className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-[12px] font-bold text-foreground/90">How do signals work?</p>
          <p className="text-[11px] text-muted-foreground/60">New to trading? Start here.</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/10 pt-4">
          {steps.map((s) => (
            <div key={s.num} className="flex items-start gap-3">
              <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 border", s.color)}>
                {s.num}
              </span>
              <div>
                <p className="text-[12px] font-bold text-foreground/90">{s.title}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-amber-400/5 border border-amber-400/20 px-3 py-2 text-[11px] text-amber-300/80">
            Signals are for educational purposes only. Past performance does not guarantee future results.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact signal row for the "Recent Signals" list
// ---------------------------------------------------------------------------

function SignalRow({ signal }: { signal: GoldSignal }) {
  const isBuy = signal.direction === "long";
  const fmtPrice = (v: number) =>
    v >= 1000 ? "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(4);
  const ts = new Date(signal.timestamp);
  const timeStr = ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const statusLabel: Record<GoldSignal["status"], string> = {
    candidate: "Pending",
    approved: "Active",
    blocked: "Blocked",
    expired: "Expired",
    sent: "Sent",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-high/20 transition-colors border-b border-border/5 last:border-0">
      <div className={cn(
        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border",
        isBuy
          ? "bg-emerald-400/10 border-emerald-400/30 text-emerald-400"
          : "bg-[#ff716a]/10 border-[#ff716a]/30 text-[#ff716a]"
      )}>
        {isBuy ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold text-foreground truncate">
          {isBuy ? "Buy" : "Sell"} at {fmtPrice(signal.entry_price)}
        </p>
        <p className="text-[10px] text-muted-foreground/50">
          {STRATEGY_PLAIN[signal.strategy_name]?.label ?? signal.strategy_name} · {timeStr}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] font-bold text-foreground/70">{signal.confidence_score}%</p>
        <p className={cn(
          "text-[10px] font-semibold",
          signal.status === "approved" ? "text-emerald-400" :
          signal.status === "candidate" ? "text-amber-400" :
          signal.status === "blocked" ? "text-[#ff716a]" :
          "text-muted-foreground/40"
        )}>
          {statusLabel[signal.status] ?? signal.status}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overall stats — simplified to 3 key numbers
// ---------------------------------------------------------------------------

function StatsRow({
  signals,
  performance,
  engineOnline,
}: {
  signals: GoldSignal[];
  performance: GoldPerformanceResponse | null;
  engineOnline: boolean | null;
}) {
  const activeCount = signals.filter(
    (s) => s.status === "approved" || s.status === "candidate"
  ).length;

  const winRate = performance
    ? (performance.overall_win_rate * 100).toFixed(0) + "%"
    : "--";

  const todayCount = signals.filter((s) => {
    const d = new Date(s.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl bg-surface-2 border border-border/10 p-4 space-y-1 text-center">
        <p className="text-2xl font-black text-foreground tabular-nums">{activeCount}</p>
        <p className="text-[11px] text-muted-foreground/60">
          <Tip text="Signals that are currently active or waiting to be confirmed.">Active signals</Tip>
        </p>
      </div>
      <div className="rounded-2xl bg-surface-2 border border-border/10 p-4 space-y-1 text-center">
        <p className={cn("text-2xl font-black tabular-nums", performance ? "text-emerald-400" : "text-muted-foreground/40")}>
          {winRate}
        </p>
        <p className="text-[11px] text-muted-foreground/60">
          <Tip text="Percentage of past signals that hit their target price (take profit) before their stop loss.">Historical win rate</Tip>
        </p>
      </div>
      <div className="rounded-2xl bg-surface-2 border border-border/10 p-4 space-y-1 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <div className={cn(
            "h-2.5 w-2.5 rounded-full",
            engineOnline === null ? "bg-muted-foreground/40 animate-pulse" :
            engineOnline ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
          )} />
          <p className="text-2xl font-black text-foreground">{todayCount}</p>
        </div>
        <p className="text-[11px] text-muted-foreground/60">
          <Tip text="Number of signals generated today across all timeframes.">Signals today</Tip>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notification preferences panel — same logic, cleaner UI
// ---------------------------------------------------------------------------

function NotificationPrefsPanel() {
  const [prefs, setPrefs] = React.useState<CommodityAlertPrefs | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const [emailEnabled, setEmailEnabled] = React.useState(false);
  const [alertEmail, setAlertEmail] = React.useState("");
  const [smsEnabled, setSmsEnabled] = React.useState(false);
  const [alertPhone, setAlertPhone] = React.useState("");
  const [symbolsInput, setSymbolsInput] = React.useState("XAUUSD");
  const [minConfidence, setMinConfidence] = React.useState(70);
  const [cooldown, setCooldown] = React.useState(60);

  React.useEffect(() => {
    commodityAlertApi.getPrefs()
      .then((p) => {
        setPrefs(p);
        setEmailEnabled(p.email_enabled);
        setAlertEmail(p.alert_email ?? "");
        setSmsEnabled(p.sms_enabled);
        setAlertPhone(p.alert_phone ?? "");
        setSymbolsInput((p.symbols ?? ["XAUUSD"]).join(", "));
        setMinConfidence(p.min_confidence);
        setCooldown(p.cooldown_minutes);
      })
      .catch(() => setError("Could not load notification settings"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const symbols = symbolsInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const updated = await commodityAlertApi.updatePrefs({
        email_enabled: emailEnabled,
        alert_email: alertEmail || null,
        sms_enabled: smsEnabled,
        alert_phone: alertPhone || null,
        symbols,
        min_confidence: minConfidence,
        cooldown_minutes: cooldown,
      });
      setPrefs(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const isActive = emailEnabled || smsEnabled;

  return (
    <div className="rounded-2xl border border-border/10 bg-surface-2 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-high/30 transition-colors text-left"
      >
        <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isActive ? "bg-primary/10" : "bg-surface-high"
        )}>
          {isActive ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground/50" />}
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-bold text-foreground/90">Signal Alerts</p>
          <p className="text-[11px] text-muted-foreground/60">
            {isActive ? "Alerts are active" : "Get notified when a buy signal fires"}
          </p>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            On
          </span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/10 pt-4">
          {loading && <div className="h-32 rounded-xl bg-surface-high animate-pulse" />}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-3 py-2 text-[11px] text-red-300">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              {error}
            </div>
          )}

          {!loading && (
            <>
              {/* Email */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={(e) => setEmailEnabled(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                  <Mail className="h-4 w-4 text-muted-foreground/60" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground/90">Email alerts</p>
                    <p className="text-[10px] text-muted-foreground/50">Receive an email when a signal fires</p>
                  </div>
                </label>
                {emailEnabled && (
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-9 rounded-xl border border-border/20 bg-surface-lowest px-3 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                )}
              </div>

              {/* SMS */}
              <div className="space-y-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smsEnabled}
                    onChange={(e) => setSmsEnabled(e.target.checked)}
                    className="h-4 w-4 accent-primary rounded"
                  />
                  <MessageSquare className="h-4 w-4 text-muted-foreground/60" />
                  <div>
                    <p className="text-[12px] font-semibold text-foreground/90">SMS alerts</p>
                    <p className="text-[10px] text-muted-foreground/50">Receive a text message (requires Twilio setup)</p>
                  </div>
                </label>
                {smsEnabled && (
                  <input
                    type="tel"
                    value={alertPhone}
                    onChange={(e) => setAlertPhone(e.target.value)}
                    placeholder="+1 555 0100"
                    className="w-full h-9 rounded-xl border border-border/20 bg-surface-lowest px-3 text-[12px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                  />
                )}
              </div>

              {/* Symbols */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground/70">
                  Which symbols to watch
                </label>
                <input
                  type="text"
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value.toUpperCase())}
                  placeholder="XAUUSD, XAGUSD, BTCUSD"
                  className="w-full h-9 rounded-xl border border-border/20 bg-surface-lowest px-3 text-[12px] text-foreground font-bold tracking-widest placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground/40">Separate multiple symbols with a comma</p>
              </div>

              {/* Min confidence + cooldown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground/70">
                    Min confidence %
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(Number(e.target.value))}
                    className="w-full h-9 rounded-xl border border-border/20 bg-surface-lowest px-3 text-[12px] text-foreground font-bold tabular-nums focus:outline-none focus:border-primary/60 transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground/40">Only alert for strong signals</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-muted-foreground/70">
                    Cooldown (minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={cooldown}
                    onChange={(e) => setCooldown(Number(e.target.value))}
                    className="w-full h-9 rounded-xl border border-border/20 bg-surface-lowest px-3 text-[12px] text-foreground font-bold tabular-nums focus:outline-none focus:border-primary/60 transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground/40">Wait time between alerts</p>
                </div>
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                size="sm"
                className={cn(
                  "w-full h-9 text-[12px] font-bold gap-2 rounded-xl",
                  saved && "bg-emerald-600 hover:bg-emerald-600"
                )}
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> :
                 saved ? <Check className="h-3.5 w-3.5" /> :
                 <Bell className="h-3.5 w-3.5" />}
                {saving ? "Saving..." : saved ? "Saved!" : "Save Alert Settings"}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Advanced details accordion — technical data for experienced traders
// ---------------------------------------------------------------------------

function AdvancedDetails({
  performance,
  loadingPerf,
}: {
  performance: GoldPerformanceResponse | null;
  loadingPerf: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (!performance && !loadingPerf) return null;

  return (
    <div className="rounded-2xl border border-border/10 bg-surface-2 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-high/30 transition-colors text-left"
      >
        <BarChart2 className="h-4 w-4 text-muted-foreground/60 shrink-0" />
        <div className="flex-1">
          <p className="text-[12px] font-bold text-foreground/90">Advanced Performance Data</p>
          <p className="text-[11px] text-muted-foreground/60">Win rates, expectancy, and per-strategy breakdowns</p>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border/10 pt-4 space-y-3">
          {loadingPerf ? (
            <div className="h-32 rounded-xl bg-surface-high animate-pulse" />
          ) : performance ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-highest/50 border border-border/10 p-3 text-center">
                  <p className="text-xl font-black text-primary tabular-nums">
                    {(performance.overall_win_rate * 100).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">Overall win rate</p>
                </div>
                <div className="rounded-xl bg-surface-highest/50 border border-border/10 p-3 text-center">
                  <p className={cn("text-xl font-black tabular-nums",
                    performance.overall_expectancy >= 0 ? "text-emerald-400" : "text-[#ff716a]"
                  )}>
                    {performance.overall_expectancy >= 0 ? "+" : ""}{performance.overall_expectancy.toFixed(2)}R
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    <Tip text="Avg expected profit per trade expressed as a multiple of the amount risked. +1R means you gain on average 1× your risk per trade.">
                      Avg expectancy
                    </Tip>
                  </p>
                </div>
              </div>
              {performance.strategies.map((s) => (
                <div key={s.strategy_name} className="rounded-xl bg-surface-highest/50 border border-border/10 p-3 space-y-2">
                  <p className="text-[12px] font-bold text-foreground/80">
                    {STRATEGY_PLAIN[s.strategy_name]?.label ?? s.strategy_name}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/60">Win rate</span>
                      <span className="font-bold">{(s.win_rate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/60">Profit factor</span>
                      <span className="font-bold">{s.profit_factor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/60">Max drawdown</span>
                      <span className="font-bold text-[#ff716a]">-{(s.max_drawdown * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground/60">Signals</span>
                      <span className="font-bold">{s.total_signals}</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
        </div>
      )}
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
  const [engineOnline, setEngineOnline] = useState<boolean | null>(null);

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

  // Find the best signal to feature in the hero card
  const heroSignal = signals.find((s) => s.status === "approved") ??
    signals.find((s) => s.status === "candidate") ??
    signals[0] ?? null;

  const recentSignals = signals.slice(0, 8);

  return (
    <AppShell title="Commodity Signals">
      <div className="p-3 sm:p-4 lg:p-6 space-y-5 max-w-[1200px] mx-auto">

        {/* ── Backend offline banner ─────────────────────────────────── */}
        {engineOnline === false && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-3">
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-[12px] font-bold text-amber-300">Backend offline</p>
              <p className="text-[11px] text-amber-300/70 font-mono">
                cd backend &amp;&amp; uvicorn app.main:app --reload
              </p>
            </div>
          </div>
        )}

        {/* ── Sub-page tabs ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { href: "/gold", label: "Overview", icon: LayoutDashboard },
            { href: "/gold/signals", label: "All Signals", icon: TrendingUp },
            { href: "/gold/performance", label: "Performance", icon: BarChart2 },
            { href: "/gold/risk", label: "Risk", icon: ShieldAlert },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all border",
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

        {/* ── Top bar: symbol + timeframe + actions ─────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-black text-foreground">Commodity Signals</span>
            <div className={cn(
              "h-2 w-2 rounded-full",
              engineOnline === null ? "bg-muted-foreground/40 animate-pulse" :
              engineOnline ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
            )} />
          </div>

          {/* Symbol input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="e.g. XAUUSD"
              maxLength={20}
              className="h-9 w-32 rounded-xl border border-border/20 bg-surface-2 px-3 text-[13px] font-bold uppercase tracking-widest text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 transition-colors"
            />
            <Button
              size="sm"
              variant="default"
              onClick={handleSymbolCommit}
              className="h-9 px-4 text-[12px] font-bold rounded-xl"
            >
              Load
            </Button>
          </div>

          {/* Active symbol */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-semibold">Watching</span>
            <span className="text-[13px] font-black text-primary tracking-widest">{committedSymbol}</span>
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center gap-1 bg-surface-2 border border-border/10 rounded-xl p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={cn(
                  "h-7 px-2.5 rounded-lg text-[11px] font-bold transition-all",
                  tf === timeframe
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground/60 hover:text-foreground"
                )}
              >
                {TIMEFRAME_LABELS[tf]}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => void fetchAll(committedSymbol, timeframe)}
            disabled={loadingSignals}
            title="Refresh data"
            className="h-9 w-9 flex items-center justify-center rounded-xl border border-border/20 bg-surface-2 text-muted-foreground/60 hover:text-foreground hover:border-border/40 transition-colors disabled:opacity-40 ml-auto"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingSignals && "animate-spin")} />
          </button>
        </div>

        {/* Error / success banners */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-[12px] text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {analyzeMsg && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-[12px] text-primary/80">
            <Activity className="h-4 w-4 shrink-0 mt-0.5" />
            {analyzeMsg}
          </div>
        )}

        {/* ── 3-stat summary row ─────────────────────────────────────── */}
        <StatsRow signals={signals} performance={performance} engineOnline={engineOnline} />

        {/* ── Main 2-column layout ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* ── LEFT: hero signal + recent signals list ──────────────── */}
          <div className="space-y-5">

            {/* Hero — latest signal */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">Latest Recommendation</h2>
              </div>

              {loadingSignals ? (
                <div className="h-72 rounded-2xl bg-surface-2 border border-border/10 animate-pulse" />
              ) : heroSignal ? (
                <HeroSignalCard signal={heroSignal} />
              ) : (
                <div className="rounded-2xl bg-surface-2 border border-border/10 flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                  <Zap className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-sm font-bold text-foreground/70">No signals yet</p>
                  <p className="text-[12px] text-muted-foreground/50">
                    Click &quot;Run Analysis&quot; to generate signals for {committedSymbol}.
                  </p>
                </div>
              )}
            </div>

            {/* Run analysis CTA */}
            <Button
              onClick={() => void handleAnalyze()}
              disabled={loadingAnalyze}
              className="w-full h-12 text-[13px] font-black gap-2 rounded-xl"
            >
              {loadingAnalyze ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
              {loadingAnalyze ? "Analyzing market data..." : `Run Analysis on ${committedSymbol}`}
            </Button>

            {/* Recent signals list */}
            {recentSignals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground/50" />
                  <h2 className="text-sm font-black text-foreground">Recent Signals</h2>
                  <span className="px-2 py-0.5 rounded-full bg-surface-2 border border-border/10 text-[10px] font-bold text-muted-foreground/50">
                    {recentSignals.length}
                  </span>
                  <Link
                    href="/gold/signals"
                    className="ml-auto flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="rounded-2xl bg-surface-2 border border-border/10 overflow-hidden">
                  {recentSignals.map((sig) => (
                    <SignalRow key={sig.id} signal={sig} />
                  ))}
                </div>
              </div>
            )}

            {/* How it works — beginner explainer */}
            <HowItWorks />
          </div>

          {/* ── RIGHT: risk status + alerts + advanced ───────────────── */}
          <div className="space-y-4">

            {/* Risk status */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-black text-foreground">Risk Status</h2>
              </div>
              {loadingRisk ? (
                <div className="h-40 rounded-2xl bg-surface-2 border border-border/10 animate-pulse" />
              ) : risk ? (
                <RiskTrafficLight risk={risk} />
              ) : null}
            </div>

            {/* Alert settings */}
            <NotificationPrefsPanel />

            {/* Advanced data (collapsed by default) */}
            <AdvancedDetails performance={performance} loadingPerf={loadingPerf} />

            {/* Disclaimer */}
            <div className="rounded-2xl bg-surface-2 border border-border/10 px-4 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <p className="text-[11px] font-bold text-muted-foreground/60">Disclaimer</p>
              </div>
              <p className="text-[10px] text-muted-foreground/40 leading-relaxed pl-5">
                Signals show historically favorable entry zones only. This is not financial advice.
                Past performance does not guarantee future results. Always manage your risk.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
