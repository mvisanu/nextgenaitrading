"use client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  BrokerCredential, SignalCheckResult, SignalMarker
} from "@/types";
import {
  ArrowDownCircle, ArrowUpCircle, ChevronDown, ChevronRight, CircleHelp, MinusCircle
} from "lucide-react";

export function BuySellToggle({
  value,
  onSelect,
}: {
  value: "buy" | "sell";
  onSelect: (side: "buy" | "sell") => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={value === "buy"}
        onClick={() => onSelect("buy")}
        className={cn(
          "flex-1 py-2 font-bold text-xs rounded-sm border transition-colors",
          value === "buy"
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-surface-highest text-muted-foreground border-transparent hover:text-foreground"
        )}
      >
        BUY
      </button>
      <button
        type="button"
        aria-pressed={value === "sell"}
        onClick={() => onSelect("sell")}
        className={cn(
          "flex-1 py-2 font-bold text-xs rounded-sm border transition-colors",
          value === "sell"
            ? "bg-destructive/10 text-destructive border-destructive/30"
            : "bg-surface-highest text-muted-foreground border-transparent hover:text-foreground"
        )}
      >
        SELL
      </button>
    </div>
  );
}

// ─── Market Pulse Row ─────────────────────────────────────────────────────────

export function PaperStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-low border border-border/10 px-3 py-2 rounded-sm text-center">
      <p className="text-3xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold font-mono tabular-nums mt-0.5", color)}>{value}</p>
    </div>
  );
}

// ─── Signal Result Panel ──────────────────────────────────────────────────────

export function SignalResultPanel({ result }: { result: SignalCheckResult }) {
  const sq = result.squeeze;
  return (
    <div className="bg-surface-lowest rounded-sm border border-border/10 p-3 space-y-2.5">
      {/* Summary row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-3xs text-muted-foreground uppercase">Last Result</span>
        <span
          className={cn(
            "text-3xs font-bold uppercase",
            result.signal === "buy"
              ? "text-primary"
              : result.signal === "sell"
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {result.signal?.toUpperCase() ?? "HOLD"}
        </span>
      </div>

      {/* Plain-English interpretation */}
      <SignalPlainEnglish result={result} />

      {/* Confirmation progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-3xs text-muted-foreground flex items-center gap-1">
            Confirmations
            <Tip text="Each confirmation is one indicator (e.g. RSI, MACD, EMA) agreeing with the signal. More confirmations = higher confidence." />
          </span>
          <span className="text-3xs font-bold tabular-nums text-foreground">
            {result.confirmation_count ?? 0}/8
          </span>
        </div>
        <div className="w-full bg-border/10 h-1.5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all rounded-full",
              (result.confirmation_count ?? 0) >= 7
                ? "bg-primary"
                : (result.confirmation_count ?? 0) >= 5
                  ? "bg-amber-400"
                  : "bg-destructive/60"
            )}
            style={{ width: `${((result.confirmation_count ?? 0) / 8) * 100}%` }}
          />
        </div>
        <p className="text-3xs text-muted-foreground italic mt-1">
          Regime: <span className="font-semibold capitalize text-foreground/70">{result.regime ?? "—"}</span>
          <Tip text="Regime = the current market trend detected by the AI. 'bull' means uptrend, 'bear' means downtrend, 'neutral' means sideways." />
        </p>
      </div>

      {/* Squeeze status card */}
      {sq && (
        <div
          className={cn(
            "rounded-sm border p-2.5 space-y-1.5",
            sq.is_squeeze
              ? "border-amber-500/30 bg-amber-500/10"
              : sq.breakout_state !== "none"
                ? sq.breakout_state === "bullish"
                  ? "border-primary/20 bg-primary/5"
                  : "border-destructive/20 bg-destructive/5"
                : "border-border/10 bg-surface-low"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-2xs font-bold">
              {sq.is_squeeze
                ? "Squeeze Active"
                : sq.breakout_state === "bullish"
                  ? "Bullish Breakout"
                  : sq.breakout_state === "bearish"
                    ? "Bearish Breakout"
                    : "No Squeeze"}
            </p>
            {sq.is_squeeze && (
              <span className="text-3xs font-bold text-amber-400">
                Strength {sq.squeeze_strength.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-3xs">
            <div>
              <p className="text-muted-foreground">Band Width</p>
              <p className="font-mono font-bold tabular-nums">{sq.bb_width_pct.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Percentile</p>
              <p className="font-mono font-bold tabular-nums">{sq.bb_width_percentile.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Breakout</p>
              <p
                className={cn(
                  "font-mono font-bold capitalize",
                  sq.breakout_state === "bullish" ? "text-primary" :
                  sq.breakout_state === "bearish" ? "text-destructive" : ""
                )}
              >
                {sq.breakout_state}
                {sq.breakout_confirmed && " \u2713"}
              </p>
            </div>
          </div>
          <p className="text-3xs text-muted-foreground italic">
            {sq.is_squeeze
              ? "Volatility is unusually tight — this can precede a larger move."
              : sq.breakout_state !== "none"
                ? `Breakout detected ${sq.bars_since_squeeze} bar(s) after squeeze.`
                : "Bands are normal width — no compression detected."}
          </p>
        </div>
      )}

      {result.reason && (
        <p className="text-3xs text-muted-foreground italic">{result.reason}</p>
      )}

      {/* Indicator breakdown */}
      {result.confirmation_details?.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/10">
          <p className="text-3xs font-bold text-muted-foreground uppercase tracking-widest">Indicators</p>
          {result.confirmation_details.map((detail, i) => (
            <div key={i} className="flex items-center justify-between text-3xs gap-2">
              <div className="flex items-center gap-1.5">
                <span className={detail.met ? "text-primary font-bold" : "text-destructive font-bold"}>
                  {detail.met ? "\u2713" : "\u2717"}
                </span>
                <span className={detail.met ? "text-foreground" : "text-muted-foreground"}>
                  {detail.name}
                </span>
              </div>
              <span className="text-muted-foreground font-mono tabular-nums shrink-0">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Signal Decision Banner ───────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof ArrowUpCircle;
}> = {
  buy: {
    label: "BUY",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: ArrowUpCircle,
  },
  sell: {
    label: "SELL",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    icon: ArrowDownCircle,
  },
  hold: {
    label: "HOLD",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: MinusCircle,
  },
};

export function SignalDecisionBanner({
  result,
  symbol,
  mode,
  dryRun,
}: {
  result: SignalCheckResult;
  symbol: string;
  mode: string;
  dryRun: boolean;
}) {
  const sig = result.signal?.toLowerCase() ?? "hold";
  const config = SIGNAL_CONFIG[sig] ?? SIGNAL_CONFIG.hold;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-4 border-b ${config.border} ${config.bg} px-4 py-2.5`}
      data-testid="signal-decision"
    >
      <Icon className={`h-6 w-6 ${config.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black tracking-tighter uppercase ${config.color}`}>
          {config.label}
        </p>
        <p className="text-3xs text-muted-foreground">
          <span className="font-mono font-bold text-foreground">{symbol}</span>
          {" · "}<span className="capitalize">{mode}</span>
          {" · "}{dryRun ? "Dry Run" : "LIVE"}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-center">
          <p className="text-3xs text-muted-foreground uppercase">Regime</p>
          <p className={cn("text-2xs font-bold", config.color)}>
            {result.regime ?? "\u2014"}
          </p>
        </div>
        <div className="h-6 w-px bg-border/20" />
        <div className="text-center">
          <p className="text-3xs text-muted-foreground uppercase">Confirms</p>
          <p className="font-mono font-bold text-sm text-foreground tabular-nums">
            {result.confirmation_count ?? 0}/8
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-4 bg-surface-low border border-border/10 rounded-sm overflow-hidden"
      data-testid={title === "Order History" ? "orders" : undefined}
    >
      <div className="flex items-center justify-between h-9 px-4 border-b border-border/10">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">{title}</span>
          {count > 0 && (
            <span className="text-3xs font-bold bg-surface-high text-muted-foreground px-1.5 py-0.5 rounded-sm">
              {count}
            </span>
          )}
        </button>
        {open && action}
      </div>
      {open && <div className="px-4 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ─── Signal Marker Builder ────────────────────────────────────────────────────

export function buildSignalMarkers(
  result: SignalCheckResult,
  candles: { time: string | number; high: number; low: number }[]
): SignalMarker[] {
  if (!candles.length || !result.signal) return [];
  const sig = result.signal.toLowerCase();
  if (sig === "hold") return [];

  const lastCandle = candles[candles.length - 1];
  return [
    {
      time: lastCandle.time,
      position: sig === "buy" ? "belowBar" : "aboveBar",
      color: sig === "buy" ? "#44dfa3" : "#ff716a",
      shape: sig === "buy" ? "arrowUp" : "arrowDown",
      text: sig.toUpperCase(),
    },
  ];
}

// ─── Volume Formatter ─────────────────────────────────────────────────────────

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + "B";
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + "M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + "K";
  return String(Math.round(vol));
}

// ─── Credential Badge ─────────────────────────────────────────────────────────

export function CredentialBadge({ credential }: { credential: BrokerCredential }) {
  if (credential.provider === "alpaca") {
    return (
      <Badge variant="alpaca" className="shrink-0 text-3xs">
        Alpaca
      </Badge>
    );
  }
  return (
    <Badge variant="robinhood" className="shrink-0 text-3xs">
      Robinhood
    </Badge>
  );
}

// ─── Tip Tooltip ─────────────────────────────────────────────────────────────
// Lightweight inline tooltip using CSS — no extra dependency.

export function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <CircleHelp className="h-3 w-3 text-muted-foreground/50 hover:text-amber-400 transition-colors" />
      <span
        className={cn(
          "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50",
          "w-52 rounded-sm bg-surface-highest border border-border/20",
          "px-2.5 py-2 text-3xs text-muted-foreground leading-relaxed shadow-xl",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "whitespace-normal"
        )}
      >
        {text}
      </span>
    </span>
  );
}

// ─── Signal Plain-English Interpretation ──────────────────────────────────────

export function SignalPlainEnglish({ result }: { result: SignalCheckResult }) {
  const count = result.confirmation_count ?? 0;
  const signal = result.signal?.toLowerCase() ?? "hold";
  const regime = result.regime?.toLowerCase() ?? "neutral";

  // Build a plain-English summary
  const strengthLabel =
    count >= 7 ? "strong" : count >= 5 ? "moderate" : count >= 3 ? "weak" : "very weak";

  const signalEmoji =
    signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "🟡";

  const regimeLabel =
    regime === "bull" ? "uptrend" : regime === "bear" ? "downtrend" : "sideways market";

  const recommendation =
    signal === "buy" && count >= 7
      ? "Conditions look favorable for an entry. Suitable for paper trading."
      : signal === "buy" && count >= 5
        ? "Mildly positive signal. Consider waiting for stronger confirmation."
        : signal === "sell"
          ? "The AI suggests reducing exposure or skipping a new entry."
          : "No strong directional signal. Consider waiting for a clearer setup.";

  return (
    <div className="rounded-sm border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 space-y-1">
      <p className="text-3xs font-bold text-amber-300/80 uppercase tracking-widest">What this means</p>
      <p className="text-2xs text-foreground/80 leading-relaxed">
        {signalEmoji}{" "}
        <span className="font-semibold capitalize">{signal === "hold" ? "Hold / Wait" : signal}</span>{" "}
        signal with <span className="font-semibold">{strengthLabel} confidence</span> ({count}/8 indicators agree).{" "}
        The AI detects a{" "}
        <span className="font-semibold">{regimeLabel}</span>.
      </p>
      <p className="text-3xs text-muted-foreground leading-relaxed italic">
        {recommendation}
      </p>
    </div>
  );
}
