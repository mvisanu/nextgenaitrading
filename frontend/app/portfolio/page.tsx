"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { liveApi } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Holding {
  id: string;
  symbol: string;
  name: string;
  sector: string;
  tag: string;
  tagColor: "primary" | "crypto" | "energy" | "consumer";
  quantity: number;
  avgCost: number;
  lastPrice: number;
  dayPnlPct: number; // manually entered day % change
}

interface ActivityEntry {
  id: string;
  type: "BUY" | "SELL" | "DIVIDEND";
  symbol: string;
  description: string;
  amount: number;
  timestamp: string;
}

interface AllocationSlice {
  label: string;
  pct: number;
  color: string;
  dasharray: string;
  dashoffset: string;
}

type Period = "5D" | "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";

// ─── Default demo holdings ─────────────────────────────────────────────────

const DEFAULT_HOLDINGS: Holding[] = [
  {
    id: "1",
    symbol: "TSLA",
    name: "Tesla, Inc.",
    sector: "Consumer",
    tag: "CONS",
    tagColor: "consumer",
    quantity: 1200,
    avgCost: 168.42,
    lastPrice: 174.6,
    dayPnlPct: 3.5,
  },
  {
    id: "2",
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    sector: "Semiconductors",
    tag: "TECH",
    tagColor: "primary",
    quantity: 450,
    avgCost: 412.0,
    lastPrice: 914.5,
    dayPnlPct: -0.3,
  },
  {
    id: "3",
    symbol: "BTC",
    name: "Bitcoin",
    sector: "Crypto",
    tag: "CRYPTO",
    tagColor: "crypto",
    quantity: 4.21,
    avgCost: 28140,
    lastPrice: 68214,
    dayPnlPct: 4.2,
  },
  {
    id: "4",
    symbol: "MSFT",
    name: "Microsoft Corp.",
    sector: "Software",
    tag: "TECH",
    tagColor: "primary",
    quantity: 300,
    avgCost: 398.1,
    lastPrice: 420.55,
    dayPnlPct: -0.4,
  },
  {
    id: "5",
    symbol: "ETH",
    name: "Ethereum",
    sector: "Crypto",
    tag: "CRYPTO",
    tagColor: "crypto",
    quantity: 25.0,
    avgCost: 2410,
    lastPrice: 3640.2,
    dayPnlPct: 0.9,
  },
];

const DEFAULT_ACTIVITY: ActivityEntry[] = [
  {
    id: "a1",
    type: "BUY",
    symbol: "NVDA",
    description: "50 shares @ $912.45",
    amount: -45622,
    timestamp: "Today, 10:24 AM",
  },
  {
    id: "a2",
    type: "SELL",
    symbol: "AAPL",
    description: "100 shares @ $182.10",
    amount: 18210,
    timestamp: "Yesterday, 3:15 PM",
  },
  {
    id: "a3",
    type: "DIVIDEND",
    symbol: "JPM",
    description: "Quarterly cash credit",
    amount: 1452.12,
    timestamp: "2 days ago",
  },
];

const PERIODS: Period[] = ["5D", "1W", "1M", "3M", "6M", "1Y", "YTD", "ALL"];

// ─── localStorage hook ────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        setValue(JSON.parse(raw) as T);
      }
    } catch {
      // ignore parse errors
    }
    setLoaded(true);
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // ignore quota errors
        }
        return resolved;
      });
    },
    [key]
  );

  return [loaded ? value : defaultValue, set];
}

// ─── Computed helpers ─────────────────────────────────────────────────────

function computeMarketValue(h: Holding): number {
  return h.quantity * h.lastPrice;
}

function computeUnrealizedPnl(h: Holding): number {
  return (h.lastPrice - h.avgCost) * h.quantity;
}

function computeDayPnl(h: Holding): number {
  const mv = computeMarketValue(h);
  return (mv * h.dayPnlPct) / 100;
}

function buildAllocationSlices(
  groups: { label: string; value: number; color: string }[]
): AllocationSlice[] {
  const total = groups.reduce((s, g) => s + g.value, 0);
  if (total === 0) return [];
  let cumulative = 0;
  return groups
    .filter((g) => g.value > 0)
    .map((g) => {
      const pct = Math.round((g.value / total) * 100);
      const slice: AllocationSlice = {
        label: g.label,
        pct,
        color: g.color,
        dasharray: `${pct}, 100`,
        dashoffset: String(-cumulative),
      };
      cumulative += pct;
      return slice;
    });
}

const TAG_COLORS: Record<string, { color: string; tagColor: Holding["tagColor"] }> = {
  primary: { color: "#44DFA3", tagColor: "primary" },
  crypto: { color: "rgba(68,223,163,0.55)", tagColor: "crypto" },
  energy: { color: "#dfe2f1", tagColor: "energy" },
  consumer: { color: "#9a9dac", tagColor: "consumer" },
};

const SECTOR_COLORS: Record<string, string> = {
  Tech: "#dfe2f1",
  Software: "#c8cbdb",
  Semiconductors: "#b0b4c8",
  Crypto: "rgba(68,223,163,0.55)",
  Healthcare: "#9a9dac",
  Finance: "#373b47",
  Energy: "#dfe2f1",
  Consumer: "#9a9dac",
  Other: "#3f4857",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCurrency(n: number): string {
  return "$" + fmt(Math.abs(n));
}

function fmtSign(n: number): string {
  return (n >= 0 ? "+" : "-") + fmtCurrency(n);
}

function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + fmt(n) + "%";
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Inline SVG Donut Chart ──────────────────────────────────────────────────

interface DonutChartProps {
  slices: AllocationSlice[];
  centerLabel: string;
  centerValue: string;
}

function DonutChart({ slices, centerLabel, centerValue }: DonutChartProps) {
  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28 shrink-0">
        <svg className="w-full h-full" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" fill="none" stroke="#1d2634" strokeWidth="4" />
          {slices.map((slice) => (
            <circle
              key={slice.label}
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke={slice.color}
              strokeWidth="4"
              strokeDasharray={slice.dasharray}
              strokeDashoffset={slice.dashoffset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">
            {centerLabel}
          </span>
          <span className="text-xs font-black tabular-nums">{centerValue}</span>
        </div>
      </div>
      <div className="flex-1 space-y-2">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-[10px] uppercase tracking-wider font-semibold text-foreground flex-1">
              {slice.label}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground ml-auto">
              {slice.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Equity Curve ─────────────────────────────────────────────────────────────

function EquityCurve() {
  return (
    <div className="relative w-full h-full min-h-[180px] overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="border-r border-b border-white/[0.03]" />
        ))}
      </div>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 200" preserveAspectRatio="none">
        <defs>
          <linearGradient id="portfolioGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#44DFA3" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#44DFA3" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,160 Q150,140 300,170 T450,120 T600,80 T750,110 T900,40 L1000,20 L1000,200 L0,200 Z"
          fill="url(#portfolioGradient)"
        />
        <path
          d="M0,160 Q150,140 300,170 T450,120 T600,80 T750,110 T900,40 L1000,20"
          fill="none"
          stroke="#44DFA3"
          strokeWidth="2"
        />
      </svg>
      <div className="absolute top-3 left-3 flex flex-col gap-10 pointer-events-none">
        <span className="text-[9px] font-bold text-primary/60 tabular-nums">1.25M</span>
        <span className="text-[9px] font-bold text-primary/60 tabular-nums">1.10M</span>
      </div>
      <div className="absolute bottom-1 left-0 right-0 flex justify-between px-3 pointer-events-none">
        {["Jan", "Mar", "May", "Jul", "Sep", "Nov"].map((m) => (
          <span key={m} className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tag color helper ─────────────────────────────────────────────────────────

function tagClass(color: Holding["tagColor"]): string {
  switch (color) {
    case "primary":
      return "bg-primary/10 text-primary";
    case "crypto":
      return "bg-emerald/10 text-emerald";
    case "energy":
      return "bg-white/10 text-foreground";
    case "consumer":
    default:
      return "bg-surface-high text-muted-foreground";
  }
}

// ─── Holding Form Modal ───────────────────────────────────────────────────────

interface HoldingFormState {
  symbol: string;
  name: string;
  sector: string;
  tag: string;
  tagColor: Holding["tagColor"];
  quantity: string;
  avgCost: string;
  lastPrice: string;
  dayPnlPct: string;
}

const EMPTY_HOLDING_FORM: HoldingFormState = {
  symbol: "",
  name: "",
  sector: "Tech",
  tag: "TECH",
  tagColor: "primary",
  quantity: "",
  avgCost: "",
  lastPrice: "",
  dayPnlPct: "0",
};

function holdingToForm(h: Holding): HoldingFormState {
  return {
    symbol: h.symbol,
    name: h.name,
    sector: h.sector,
    tag: h.tag,
    tagColor: h.tagColor,
    quantity: String(h.quantity),
    avgCost: String(h.avgCost),
    lastPrice: String(h.lastPrice),
    dayPnlPct: String(h.dayPnlPct),
  };
}

interface HoldingModalProps {
  initial: HoldingFormState;
  onSave: (form: HoldingFormState) => void;
  onClose: () => void;
  title: string;
}

function HoldingModal({ initial, onSave, onClose, title }: HoldingModalProps) {
  const [form, setForm] = useState<HoldingFormState>(initial);

  function setField(field: keyof HoldingFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim()) return;
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="bg-card rounded-lg w-full max-w-md p-6 border border-border/20 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Symbol *
              </label>
              <input
                required
                value={form.symbol}
                onChange={(e) => setField("symbol", e.target.value.toUpperCase())}
                placeholder="TSLA"
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Name
              </label>
              <input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="Tesla, Inc."
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Sector
              </label>
              <select
                value={form.sector}
                onChange={(e) => setField("sector", e.target.value)}
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40"
              >
                {["Tech", "Software", "Semiconductors", "Crypto", "Healthcare", "Finance", "Energy", "Consumer", "Other"].map(
                  (s) => <option key={s} value={s}>{s}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Tag Color
              </label>
              <select
                value={form.tagColor}
                onChange={(e) => {
                  const tc = e.target.value as Holding["tagColor"];
                  const defaultTag = tc === "primary" ? "TECH" : tc === "crypto" ? "CRYPTO" : tc === "energy" ? "ENERGY" : "CONS";
                  setForm((prev) => ({ ...prev, tagColor: tc, tag: defaultTag }));
                }}
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40"
              >
                <option value="primary">Green (TECH)</option>
                <option value="crypto">Teal (CRYPTO)</option>
                <option value="energy">Light (ENERGY)</option>
                <option value="consumer">Gray (CONS)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
              Tag Label
            </label>
            <input
              value={form.tag}
              onChange={(e) => setField("tag", e.target.value.toUpperCase().slice(0, 8))}
              placeholder="TECH"
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.quantity}
                onChange={(e) => setField("quantity", e.target.value)}
                placeholder="100"
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Avg Cost $
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.avgCost}
                onChange={(e) => setField("avgCost", e.target.value)}
                placeholder="100.00"
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Last Price $
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={form.lastPrice}
                onChange={(e) => setField("lastPrice", e.target.value)}
                placeholder="120.00"
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
              Day&apos;s Change % (e.g. 1.5 or -0.3)
            </label>
            <input
              type="number"
              step="any"
              value={form.dayPnlPct}
              onChange={(e) => setField("dayPnlPct", e.target.value)}
              placeholder="0.0"
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest py-2.5 rounded transition-colors"
            >
              Save Holding
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-lowest hover:bg-surface-high text-muted-foreground text-[10px] font-black uppercase tracking-widest py-2.5 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Activity Form Modal ──────────────────────────────────────────────────────

interface ActivityFormState {
  type: ActivityEntry["type"];
  symbol: string;
  description: string;
  amount: string;
}

interface ActivityModalProps {
  onSave: (form: ActivityFormState) => void;
  onClose: () => void;
}

function ActivityModal({ onSave, onClose }: ActivityModalProps) {
  const [form, setForm] = useState<ActivityFormState>({
    type: "BUY",
    symbol: "",
    description: "",
    amount: "",
  });

  function setField(field: keyof ActivityFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim()) return;
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="bg-card rounded-lg w-full max-w-sm p-6 border border-border/20 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Add Activity</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Type
              </label>
              <select
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="DIVIDEND">DIVIDEND</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
                Symbol *
              </label>
              <input
                required
                value={form.symbol}
                onChange={(e) => setField("symbol", e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
              Description
            </label>
            <input
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="50 shares @ $100.00"
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div>
            <label className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground block mb-1">
              Amount $ (negative = cash out, positive = cash in)
            </label>
            <input
              type="number"
              step="any"
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="-5000"
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest py-2.5 rounded transition-colors"
            >
              Add Entry
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-surface-lowest hover:bg-surface-high text-muted-foreground text-[10px] font-black uppercase tracking-widest py-2.5 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Map PositionSnapshot → Holding ──────────────────────────────────────────

function positionToHolding(pos: {
  id: number;
  symbol: string;
  quantity: number;
  avg_entry_price: number | null;
  mark_price: number | null;
  strategy_mode: string | null;
}): Holding {
  const isCrypto = pos.symbol.includes("-") || ["BTC", "ETH", "SOL", "DOGE", "ADA"].includes(pos.symbol);
  return {
    id: String(pos.id),
    symbol: pos.symbol,
    name: pos.symbol,
    sector: isCrypto ? "Crypto" : "Tech",
    tag: isCrypto ? "CRYPTO" : "TECH",
    tagColor: isCrypto ? "crypto" : "primary",
    quantity: pos.quantity,
    avgCost: pos.avg_entry_price ?? 0,
    lastPrice: pos.mark_price ?? pos.avg_entry_price ?? 0,
    dayPnlPct: 0,
  };
}

// ─── Map BrokerOrder → ActivityEntry ─────────────────────────────────────────

function orderToActivity(order: {
  id: number;
  created_at: string;
  symbol: string;
  side: string;
  notional_usd: number | null;
  quantity: number | null;
  filled_price: number | null;
  dry_run: boolean;
  status: string | null;
}): ActivityEntry {
  const date = new Date(order.created_at);
  const isToday = new Date().toDateString() === date.toDateString();
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const timestamp = isToday ? `Today, ${timeStr}` : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${timeStr}`;
  const qty = order.quantity ? `${order.quantity.toFixed(4)} shares` : "";
  const price = order.filled_price ? `@ $${order.filled_price.toFixed(2)}` : "";
  const desc = [qty, price].filter(Boolean).join(" ") || (order.notional_usd ? `$${order.notional_usd.toFixed(2)} notional` : "Market order");
  return {
    id: String(order.id),
    type: order.side === "buy" ? "BUY" : "SELL",
    symbol: order.symbol,
    description: `${order.dry_run ? "[DRY RUN] " : ""}${desc}`,
    amount: order.side === "buy" ? -(order.notional_usd ?? (order.quantity ?? 0) * (order.filled_price ?? 0)) : (order.notional_usd ?? (order.quantity ?? 0) * (order.filled_price ?? 0)),
    timestamp,
  };
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const queryClient = useQueryClient();
  const [activePeriod, setActivePeriod] = useState<Period>("1M");
  const [localHoldings, setHoldings] = useLocalStorage<Holding[]>(
    "portfolio_holdings",
    DEFAULT_HOLDINGS
  );
  const [localActivity, setActivity] = useLocalStorage<ActivityEntry[]>(
    "portfolio_activity",
    DEFAULT_ACTIVITY
  );

  // ── Live DB queries ─────────────────────────────────────────────────────
  const { data: dbPositions } = useQuery({
    queryKey: ["live", "positions"],
    queryFn: liveApi.positions,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: dbOrders } = useQuery({
    queryKey: ["live", "orders"],
    queryFn: () => liveApi.orders(50),
    refetchInterval: 30_000,
    retry: false,
  });

  // ── Merge DB + local data ───────────────────────────────────────────────
  // When DB has open positions, use them as the primary source.
  // Manual localStorage holdings are always shown alongside (user may add
  // demo/manual entries for positions held outside this platform).
  const dbHoldings: Holding[] = useMemo(
    () => (dbPositions ?? [])
      .filter((p: any) => p.is_open && p.quantity > 0)
      .map(positionToHolding),
    [dbPositions]
  );

  const dbActivity: ActivityEntry[] = useMemo(
    () => (dbOrders ?? []).slice(0, 20).map(orderToActivity),
    [dbOrders]
  );

  // Show DB holdings when we have any, otherwise fall back to localStorage demo.
  const holdings = dbHoldings.length > 0 ? dbHoldings : localHoldings;
  // Activity: prepend DB orders (most recent first), then any manual local entries.
  const activity = dbActivity.length > 0
    ? [...dbActivity, ...localActivity.filter((a) => !dbActivity.some((d) => d.id === a.id))]
    : localActivity;

  // Modal state
  const [holdingModal, setHoldingModal] = useState<
    { mode: "add" } | { mode: "edit"; holding: Holding } | null
  >(null);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // ── Computed values ────────────────────────────────────────────────────
  const totalMarketValue = holdings.reduce((s, h) => s + computeMarketValue(h), 0);
  const totalUnrealizedPnl = holdings.reduce((s, h) => s + computeUnrealizedPnl(h), 0);
  const totalDayPnl = holdings.reduce((s, h) => s + computeDayPnl(h), 0);
  const totalCost = holdings.reduce((s, h) => s + h.avgCost * h.quantity, 0);
  const totalUnrealizedPnlPct = totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : 0;
  const totalDayPnlPct = totalMarketValue > 0 ? (totalDayPnl / (totalMarketValue - totalDayPnl)) * 100 : 0;

  // Asset allocation by tagColor
  const tagGroups: Record<string, number> = {};
  for (const h of holdings) {
    tagGroups[h.tagColor] = (tagGroups[h.tagColor] ?? 0) + computeMarketValue(h);
  }
  const assetAllocation = buildAllocationSlices([
    { label: "Stocks", value: (tagGroups["primary"] ?? 0) + (tagGroups["energy"] ?? 0) + (tagGroups["consumer"] ?? 0), color: "#44DFA3" },
    { label: "Crypto", value: tagGroups["crypto"] ?? 0, color: "rgba(68,223,163,0.55)" },
  ].filter((g) => g.value > 0));

  // Sector exposure
  const sectorGroups: Record<string, number> = {};
  for (const h of holdings) {
    const s = h.sector;
    sectorGroups[s] = (sectorGroups[s] ?? 0) + computeMarketValue(h);
  }
  const sectorAllocation = buildAllocationSlices(
    Object.entries(sectorGroups).map(([label, value]) => ({
      label,
      value,
      color: SECTOR_COLORS[label] ?? "#3f4857",
    }))
  );

  // ── Holding CRUD ────────────────────────────────────────────────────────

  function saveHolding(form: HoldingFormState) {
    const parsed: Holding = {
      id: holdingModal?.mode === "edit" ? holdingModal.holding.id : uid(),
      symbol: form.symbol.trim(),
      name: form.name.trim() || form.symbol.trim(),
      sector: form.sector,
      tag: form.tag || form.tagColor.toUpperCase(),
      tagColor: form.tagColor,
      quantity: parseFloat(form.quantity) || 0,
      avgCost: parseFloat(form.avgCost) || 0,
      lastPrice: parseFloat(form.lastPrice) || 0,
      dayPnlPct: parseFloat(form.dayPnlPct) || 0,
    };

    if (holdingModal?.mode === "edit") {
      setHoldings((prev) => prev.map((h) => (h.id === parsed.id ? parsed : h)));
    } else {
      setHoldings((prev) => [...prev, parsed]);
    }
    setHoldingModal(null);
  }

  function deleteHolding(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  // ── Activity CRUD ───────────────────────────────────────────────────────

  function saveActivity(form: ActivityFormState) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const entry: ActivityEntry = {
      id: uid(),
      type: form.type,
      symbol: form.symbol.trim(),
      description: form.description.trim(),
      amount: parseFloat(form.amount) || 0,
      timestamp: `Today, ${timeStr}`,
    };
    setActivity((prev) => [entry, ...prev]);
    setShowActivityModal(false);
  }

  function deleteActivity(id: string) {
    setActivity((prev) => prev.filter((a) => a.id !== id));
  }

  // ── Export CSV ──────────────────────────────────────────────────────────

  function exportCsv() {
    const header = "Symbol,Name,Sector,Tag,Quantity,Avg Cost,Last Price,Market Value,Day P&L %,Unrealized P&L,Unrealized P&L %\n";
    const rows = holdings.map((h) => {
      const mv = computeMarketValue(h);
      const upnl = computeUnrealizedPnl(h);
      const cost = h.avgCost * h.quantity;
      const upnlPct = cost > 0 ? (upnl / cost) * 100 : 0;
      return [h.symbol, h.name, h.sector, h.tag, h.quantity, h.avgCost, h.lastPrice, mv.toFixed(2), h.dayPnlPct, upnl.toFixed(2), upnlPct.toFixed(2)].join(",");
    });
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "portfolio_holdings.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Reset to demo data ──────────────────────────────────────────────────

  function resetToDefaults() {
    if (confirm("Reset portfolio to demo data? This will overwrite your current holdings and activity.")) {
      setHoldings(DEFAULT_HOLDINGS);
      setActivity(DEFAULT_ACTIVITY);
    }
  }

  return (
    <AppShell title="Portfolio">
      {/* Modals */}
      {holdingModal && (
        <HoldingModal
          title={holdingModal.mode === "add" ? "Add Holding" : "Edit Holding"}
          initial={holdingModal.mode === "edit" ? holdingToForm(holdingModal.holding) : EMPTY_HOLDING_FORM}
          onSave={saveHolding}
          onClose={() => setHoldingModal(null)}
        />
      )}
      {showActivityModal && (
        <ActivityModal onSave={saveActivity} onClose={() => setShowActivityModal(false)} />
      )}

      <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">

        {/* ── Top Section: Account Value + Equity Curve ─────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Account Value Card */}
          <div className="lg:col-span-5 bg-card rounded-lg p-6 border-l-4 border-primary relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground mb-2">
                Total Account Value
              </p>
              <h2 className="text-2xl sm:text-4xl font-black tabular-nums tracking-tight text-foreground">
                {fmtCurrency(totalMarketValue)}
              </h2>

              <div className="flex flex-wrap items-center gap-6 mt-6">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1">
                    Day&apos;s P&L
                  </span>
                  <span
                    className={[
                      "font-bold text-base tabular-nums",
                      totalDayPnl >= 0 ? "text-primary" : "text-destructive",
                    ].join(" ")}
                  >
                    {fmtSign(totalDayPnl)}{" "}
                    <span className="text-sm font-medium opacity-80">({fmtPct(totalDayPnlPct)})</span>
                  </span>
                </div>

                <div className="w-px h-10 bg-white/10 hidden sm:block" />

                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-widest mb-1">
                    Unrealized P&L
                  </span>
                  <span
                    className={[
                      "font-bold text-base tabular-nums",
                      totalUnrealizedPnl >= 0 ? "text-primary" : "text-destructive",
                    ].join(" ")}
                  >
                    {fmtSign(totalUnrealizedPnl)}{" "}
                    <span className="text-sm font-medium opacity-80">({fmtPct(totalUnrealizedPnlPct)})</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-56 h-56 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          </div>

          {/* Equity Curve */}
          <div className="lg:col-span-7 bg-card rounded-lg p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground">
                Equity Performance
              </p>
              <div className="flex bg-surface-lowest rounded p-0.5 gap-0.5 flex-wrap">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePeriod(p)}
                    className={[
                      "px-2.5 py-1 text-[9px] font-bold uppercase transition-colors",
                      activePeriod === p
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 min-h-[180px]">
              <EquityCurve />
            </div>
          </div>
        </div>

        {/* ── Middle Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Asset Allocation */}
          <div className="bg-card rounded-lg p-5">
            <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground mb-5">
              Asset Allocation
            </p>
            {assetAllocation.length > 0 ? (
              <DonutChart
                slices={assetAllocation}
                centerLabel="Types"
                centerValue={String(assetAllocation.length)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Add holdings to see allocation.</p>
            )}
          </div>

          {/* Sector Exposure */}
          <div className="bg-card rounded-lg p-5">
            <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground mb-5">
              Sector Exposure
            </p>
            {sectorAllocation.length > 0 ? (
              <DonutChart
                slices={sectorAllocation}
                centerLabel="Sectors"
                centerValue={String(sectorAllocation.length)}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Add holdings to see sectors.</p>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-lg p-5 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground">
                  Recent Activity
                </p>
                {dbActivity.length > 0 && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest bg-primary/10 text-primary">
                    Live
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowActivityModal(true)}
                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-primary hover:underline"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                Add
              </button>
            </div>

            {activity.length === 0 && (
              <p className="text-xs text-muted-foreground">No activity entries. Add one above.</p>
            )}

            <div className="space-y-4 flex-1 overflow-y-auto max-h-56">
              {activity.map((entry) => {
                const isBuy = entry.type === "BUY";
                const isSell = entry.type === "SELL";
                const iconBg = isBuy ? "bg-primary/10" : isSell ? "bg-destructive/10" : "bg-surface-high";
                const iconColor = isBuy ? "text-primary" : isSell ? "text-destructive" : "text-muted-foreground";
                const amountColor = entry.amount >= 0 ? "text-primary" : "text-foreground";

                return (
                  <div key={entry.id} className="flex items-center gap-3 group">
                    <div className={["w-8 h-8 rounded flex items-center justify-center shrink-0", iconBg].join(" ")}>
                      <span className={["text-sm", iconColor].join(" ")}>
                        {isBuy ? "+" : isSell ? "−" : "$"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-foreground tracking-tight truncate">
                        {entry.type} {entry.symbol}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-tighter truncate">
                        {entry.description} &middot; {entry.timestamp}
                      </p>
                    </div>
                    <span className={["text-[11px] tabular-nums font-bold shrink-0", amountColor].join(" ")}>
                      {fmtSign(entry.amount)}
                    </span>
                    {!dbActivity.some((d) => d.id === entry.id) && (
                      <button
                        onClick={() => deleteActivity(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/60 hover:text-destructive text-xs ml-1 shrink-0"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Holdings Ledger ─────────────────────────────────────────────── */}
        <div className="bg-card rounded-lg overflow-hidden">

          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/10">
            <div className="flex items-center gap-2">
              <p className="text-2xs uppercase tracking-widest font-bold text-muted-foreground">
                Holdings Ledger
              </p>
              {dbHoldings.length > 0 && (
                <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest bg-primary/10 text-primary">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["live", "positions"] });
                  queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
                }}
                className="flex items-center gap-1.5 text-2xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 8A5 5 0 1 1 8 3" strokeLinecap="round" />
                  <path d="M13 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setHoldingModal({ mode: "add" })}
                className="flex items-center gap-1.5 text-2xs font-bold text-primary hover:underline uppercase tracking-wider"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                Add Holding
              </button>
              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 text-2xs font-bold text-primary hover:underline uppercase tracking-wider"
              >
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M3 4h10M3 12h6" strokeLinecap="round" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center gap-1.5 text-2xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
              >
                Reset Demo
              </button>
            </div>
          </div>

          {holdings.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">No holdings yet.</p>
              <button
                onClick={() => setHoldingModal({ mode: "add" })}
                className="bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded transition-colors"
              >
                + Add Your First Holding
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-lowest text-[9px] uppercase font-black text-muted-foreground tracking-widest">
                    <th className="px-5 py-3">Symbol</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3 tabular-nums">Qty</th>
                    <th className="px-5 py-3 tabular-nums">Avg Cost</th>
                    <th className="px-5 py-3 tabular-nums">Last Price</th>
                    <th className="px-5 py-3 tabular-nums">Market Value</th>
                    <th className="px-5 py-3 tabular-nums">Day&apos;s P&L</th>
                    <th className="px-5 py-3 tabular-nums">Total P&L</th>
                    <th className="px-5 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10 text-xs tabular-nums">
                  {holdings.map((h, idx) => {
                    const mv = computeMarketValue(h);
                    const upnl = computeUnrealizedPnl(h);
                    const dpnl = computeDayPnl(h);
                    const cost = h.avgCost * h.quantity;
                    const upnlPct = cost > 0 ? (upnl / cost) * 100 : 0;
                    const rowBg = idx % 2 === 1 ? "bg-surface-lowest/30" : "";

                    return (
                      <tr
                        key={h.id}
                        className={["transition-colors hover:bg-white/[0.02] h-14 group", rowBg].join(" ")}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primary tracking-tight">{h.symbol}</span>
                            <span className={["text-[8px] px-1 font-black uppercase", tagClass(h.tagColor)].join(" ")}>
                              {h.tag}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 font-medium text-foreground">{h.name}</td>
                        <td className="px-5 py-3 text-foreground">{h.quantity.toLocaleString()}</td>
                        <td className="px-5 py-3 text-foreground">${fmt(h.avgCost)}</td>
                        <td className="px-5 py-3 font-medium text-foreground">${fmt(h.lastPrice)}</td>
                        <td className="px-5 py-3 font-bold text-foreground">${fmt(mv)}</td>
                        <td className={["px-5 py-3", dpnl >= 0 ? "text-primary" : "text-destructive"].join(" ")}>
                          {fmtSign(dpnl)}{" "}
                          <span className="opacity-70">({fmtPct(h.dayPnlPct)})</span>
                        </td>
                        <td className={["px-5 py-3 font-bold", upnl >= 0 ? "text-primary" : "text-destructive"].join(" ")}>
                          {fmtSign(upnl)}
                          <br />
                          <span className="text-[9px] font-normal opacity-80">{fmtPct(upnlPct)}</span>
                        </td>
                        <td className="px-3 py-3">
                          {!dbHoldings.some((d) => d.id === h.id) && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => setHoldingModal({ mode: "edit", holding: h })}
                                className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteHolding(h.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                title="Remove"
                              >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M4 4l1 9h6l1-9" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-5 py-3 bg-surface-lowest flex items-center justify-between border-t border-border/10">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
              {holdings.length} Holding{holdings.length !== 1 ? "s" : ""} &middot; Total {fmtCurrency(totalMarketValue)}
            </span>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
