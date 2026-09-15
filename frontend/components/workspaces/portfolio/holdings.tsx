"use client";
import { LIVE_REFRESH_MS,tradingKeys } from "@/lib/trading-queries";

import { WorkspaceSection as AppShell } from "@/components/layout/WorkspaceSection";
import { useAccountStorage } from "@/lib/account-storage";
import { liveApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { activitySchema,holdingSchema,type ActivityEntry,type Holding } from "@/lib/manual-ledger";
import { useQuery,useQueryClient } from "@tanstack/react-query";
import { useMemo,useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

const DEFAULT_HOLDINGS: Holding[] = [];
const DEFAULT_ACTIVITY: ActivityEntry[] = [];

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
  return crypto.randomUUID();
}

// ─── Inline SVG Donut Chart ──────────────────────────────────────────────────

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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
                className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
              className="w-full bg-surface-lowest border border-border/20 rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/65 focus:outline-none focus:border-primary/40"
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
  position_side?: string;
  avg_entry_price: number | null;
  mark_price: number | null;
  strategy_mode: string | null;
}): Holding {
  const isCrypto = pos.symbol.includes("-") || ["BTC", "ETH", "SOL", "DOGE", "ADA"].includes(pos.symbol);
  return {
    id: String(pos.id),
    symbol: pos.symbol,
    name: pos.symbol,
    sector: isCrypto ? "Crypto" : "Unknown",
    tag: isCrypto ? "CRYPTO" : "TECH",
    tagColor: isCrypto ? "crypto" : "primary",
    quantity: pos.position_side === "short" ? -Math.abs(pos.quantity) : pos.quantity,
    avgCost: pos.avg_entry_price ?? 0,
    lastPrice: pos.mark_price ?? 0,
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
    description: `${order.dry_run ? "[DRY RUN] " : ""}${order.status ?? "Status unknown"} ? ${desc}`,
    amount: order.side === "buy" ? -(order.notional_usd ?? (order.quantity ?? 0) * (order.filled_price ?? 0)) : (order.notional_usd ?? (order.quantity ?? 0) * (order.filled_price ?? 0)),
    timestamp,
  };
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<"recorded" | "manual">("recorded");
  const [localHoldings, setHoldings] = useAccountStorage(user?.id, "portfolio_holdings", holdingSchema,
    DEFAULT_HOLDINGS
  );
  const [localActivity, setActivity] = useAccountStorage(user?.id, "portfolio_activity", activitySchema,
    DEFAULT_ACTIVITY
  );

  // ── Live DB queries ─────────────────────────────────────────────────────
  const { data: dbPositions, isPending: positionsLoading, error: positionsError } = useQuery({
    queryKey: tradingKeys.positions(user?.id),
    queryFn: liveApi.positions,
    refetchInterval: LIVE_REFRESH_MS,
    enabled: !!user,
    retry: false,
  });

  const { data: dbOrders, error: ordersError } = useQuery({
    queryKey: tradingKeys.orders(user?.id),
    queryFn: () => liveApi.orders(50),
    refetchInterval: LIVE_REFRESH_MS,
    enabled: !!user,
    retry: false,
  });

  // ── Merge DB + local data ───────────────────────────────────────────────
  // When DB has open positions, use them as the primary source.
  // Manual localStorage holdings are always shown alongside (user may add
  // demo/manual entries for positions held outside this platform).
  const dbHoldings: Holding[] = useMemo(
    () => (dbPositions ?? [])
      .filter((p) => p.is_open && p.quantity !== 0)
      .map(positionToHolding),
    [dbPositions]
  );

  const dbActivity: ActivityEntry[] = useMemo(
    () => (dbOrders ?? []).slice(0, 20).map(orderToActivity),
    [dbOrders]
  );

  // Show DB holdings when we have any, otherwise fall back to localStorage demo.
  const holdings = source === "recorded" ? dbHoldings : localHoldings;
  // Activity: prepend DB orders (most recent first), then any manual local entries.
  const activity = source === "recorded" ? dbActivity : localActivity;

  // Modal state
  const [holdingModal, setHoldingModal] = useState<
    { mode: "add" } | { mode: "edit"; holding: Holding } | null
  >(null);
  const [showActivityModal, setShowActivityModal] = useState(false);

  // ── Computed values ────────────────────────────────────────────────────
  const markedHoldings = holdings.filter((h) => h.lastPrice > 0);
  const totalMarketValue = markedHoldings.reduce((sum, h) => sum + Math.abs(computeMarketValue(h)), 0);
  const totalUnrealizedPnl = markedHoldings.reduce((s, h) => s + computeUnrealizedPnl(h), 0);
  const totalDayPnl = holdings.reduce((s, h) => s + computeDayPnl(h), 0);
  const totalCost = holdings.reduce((s, h) => s + h.avgCost * h.quantity, 0);
  const totalUnrealizedPnlPct = totalCost > 0 ? (totalUnrealizedPnl / totalCost) * 100 : 0;
  const totalDayPnlPct = totalMarketValue > 0 ? (totalDayPnl / (totalMarketValue - totalDayPnl)) * 100 : 0;

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

  return (
    <AppShell title="Holdings">
      {holdingModal && <HoldingModal title={holdingModal.mode === "add" ? "Add manual holding" : "Edit manual holding"} initial={holdingModal.mode === "edit" ? holdingToForm(holdingModal.holding) : EMPTY_HOLDING_FORM} onSave={saveHolding} onClose={() => setHoldingModal(null)} />}
      {showActivityModal && <ActivityModal onSave={saveActivity} onClose={() => setShowActivityModal(false)} />}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 text-sm">Data source
            <select value={source} onChange={(e) => setSource(e.target.value as "recorded" | "manual")} className="min-h-11 rounded-md border border-border bg-background px-3">
              <option value="recorded">Recorded positions</option><option value="manual">Manual ledger</option>
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded-md border border-border px-3 text-sm" onClick={() => { void queryClient.invalidateQueries({ queryKey: tradingKeys.live(user?.id) }); }}>Refresh</button>
            {source === "manual" && <button className="min-h-11 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" onClick={() => setHoldingModal({ mode: "add" })}>Add manual holding</button>}
            <button disabled={!holdings.length} className="min-h-11 rounded-md border border-border px-3 text-sm disabled:opacity-50" onClick={exportCsv}>Export CSV</button>
          </div>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{source === "recorded" ? "Positions recorded by the trading service. Values use available mark prices and exclude cash; they are not your broker account balance." : "Manually entered holdings stored in this browser. Prices and activity are unverified and kept separate from recorded positions."}</p>
        {source === "recorded" && positionsError ? <p role="alert">Positions could not be loaded. Use Refresh to try again.</p> : source === "recorded" && positionsLoading ? <p role="status">Loading positions...</p> : <>
          {holdings.length > 0 && <div className="flex flex-wrap gap-x-12 gap-y-4 border-y border-border py-5">
            <div><p className="text-sm text-muted-foreground">Marked exposure</p><p className="mt-1 text-2xl font-semibold tabular-nums">{markedHoldings.length ? fmtCurrency(totalMarketValue) : "Unavailable"}</p></div>
            <div><p className="text-sm text-muted-foreground">Unrealized P&L</p><p className="mt-1 text-2xl font-semibold tabular-nums">{markedHoldings.length ? fmtSign(totalUnrealizedPnl) : "Unavailable"}</p></div>
          </div>}
          {markedHoldings.length < holdings.length && <p className="text-sm text-muted-foreground">Some positions have no mark price and are excluded from these totals.</p>}
          {holdings.length === 0 ? <div className="py-12"><h2 className="text-lg font-semibold">No {source === "manual" ? "manual holdings" : "recorded positions"}</h2><p className="mt-2 text-sm text-muted-foreground">{source === "manual" ? "Add a holding to track it here." : "Connect a broker in Settings and review your orders in Trade."}</p></div> : <div className="overflow-x-auto">
            <table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr>
              {["Symbol", "Quantity", "Average cost", "Mark price", "Market value", "Unrealized P&L", ...(source === "manual" ? ["Actions"] : [])].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}
            </tr></thead><tbody>{holdings.map((h) => <tr key={h.id} className="border-b border-border">
              <td className="px-3 py-4 font-semibold">{h.symbol}</td><td className="px-3 py-4 tabular-nums">{fmt(h.quantity, 4)}</td><td className="px-3 py-4 tabular-nums">{fmtCurrency(h.avgCost)}</td><td className="px-3 py-4 tabular-nums">{h.lastPrice > 0 ? fmtCurrency(h.lastPrice) : "Unavailable"}</td><td className="px-3 py-4 tabular-nums">{h.lastPrice > 0 ? fmtSign(computeMarketValue(h)) : "Unavailable"}</td><td className="px-3 py-4 tabular-nums">{h.lastPrice > 0 ? fmtSign(computeUnrealizedPnl(h)) : "Unavailable"}</td>
              {source === "manual" && <td className="px-3 py-4"><div className="flex gap-3"><button className="min-h-11 text-primary underline" onClick={() => setHoldingModal({ mode: "edit", holding: h })} aria-label={`Edit ${h.symbol}`}>Edit</button><button className="min-h-11 text-destructive underline" onClick={() => deleteHolding(h.id)} aria-label={`Remove ${h.symbol}`}>Remove</button></div></td>}
            </tr>)}</tbody></table>
          </div>}
        </>}
        <section aria-label="Recent activity" className="border-t border-border pt-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Recent {source === "manual" ? "manual activity" : "orders"}</h2>{source === "manual" && <button className="min-h-11 text-sm text-primary underline" onClick={() => setShowActivityModal(true)}>Add activity</button>}</div>
          {source === "recorded" && ordersError ? <p role="alert">Orders could not be loaded.</p> : activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity to display.</p> : <ul className="divide-y divide-border">{activity.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><div><p className="font-medium">{entry.type} {entry.symbol}</p><p className="text-muted-foreground">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.timestamp}</p></div><div className="flex items-center gap-4"><span className="tabular-nums">{fmtSign(entry.amount)}</span>{source === "manual" && <button className="min-h-11 text-destructive" onClick={() => deleteActivity(entry.id)} aria-label={`Remove ${entry.symbol} activity`}>Remove</button>}</div></li>)}</ul>}
        </section>
      </div>
    </AppShell>
  );
}
