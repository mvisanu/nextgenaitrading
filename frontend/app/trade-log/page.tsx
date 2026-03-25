"use client";

/**
 * /trade-log — Master Trade Log
 *
 * Refactored for clarity and visual appeal:
 *   - KPI summary cards at top (win rate, total PnL, avg R, trade count)
 *   - Source badges distinguish manual / live-trading / auto-buy entries
 *   - Cleaner table with alternating row tints and outcome color coding
 *   - Collapsible detail notes inline
 *   - CSV export, outcome filters, and inline editing preserved
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Download,
  CheckSquare,
  MinusSquare,
  XSquare,
  ClipboardList,
  StickyNote,
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  Zap,
  Bot,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TradeLogEntry } from "@/lib/tradeLog";

// ─── Types ─────────────────────────────────────────────────────────────────────

// Re-use the shared type but keep backward compat with older entries missing new fields
type Trade = TradeLogEntry;

type OutcomeFilter = "all" | "win" | "breakeven" | "loss";

const STORAGE_KEY = "ngs-trade-log";

const TRADE_TYPES = ["SMOG", "Scalp", "Swing", "Day Trade", "Position", "Breakout", "Reversal", "Live Order", "Dry Run", "Auto-Buy", "Auto-Buy Dry Run"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return isNaN(d.getTime()) ? "" : DAYS[d.getDay()];
}

function newTrade(): Trade {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: crypto.randomUUID(),
    date: today,
    pair: "",
    type: "",
    timeframe: "1d",
    position: "Long",
    outcome: "",
    netPnl: null,
    totalFees: null,
    rFactor: null,
    riskPct: null,
    confidence: null,
    rangePct: null,
    limit: null,
    duration: "",
    preNotes: "",
    source: "manual",
  };
}

function formatPnl(v: number): string {
  const abs = Math.abs(v);
  return `${v >= 0 ? "+" : "-"}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Inline editable cell ──────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  type = "text",
  placeholder,
  className,
  align = "left",
  mono = false,
}: {
  value: string | number | null;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(value?.toString() ?? "");
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onChange(localVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            onChange(localVal);
          }
          if (e.key === "Escape") {
            setEditing(false);
            setLocalVal(value?.toString() ?? "");
          }
        }}
        placeholder={placeholder}
        className={cn(
          "h-7 px-1.5 text-xs border-primary/50 bg-transparent rounded-sm",
          type === "number" && "text-right",
          mono && "font-mono",
          className
        )}
      />
    );
  }

  const display = value?.toString() ?? "";

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "w-full h-7 px-1.5 text-xs rounded-sm transition-colors text-left",
        "hover:bg-secondary/60 cursor-text",
        align === "right" && "text-right",
        align === "center" && "text-center",
        mono && "font-mono",
        !display && "text-muted-foreground/40",
        className
      )}
    >
      {display || placeholder || "\u2014"}
    </button>
  );
}

// ─── Outcome checkbox group ────────────────────────────────────────────────────

function OutcomeCell({
  outcome,
  onChange,
}: {
  outcome: Trade["outcome"];
  onChange: (v: Trade["outcome"]) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(outcome === "win" ? "" : "win")}
        className={cn(
          "h-5 w-5 rounded-sm border transition-colors flex items-center justify-center",
          outcome === "win"
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
            : "border-border/60 text-transparent hover:border-muted-foreground/40"
        )}
        title="Win"
      >
        <CheckSquare className="h-3 w-3" />
      </button>
      <button
        onClick={() => onChange(outcome === "breakeven" ? "" : "breakeven")}
        className={cn(
          "h-5 w-5 rounded-sm border transition-colors flex items-center justify-center",
          outcome === "breakeven"
            ? "bg-blue-500/20 border-blue-500 text-blue-400"
            : "border-border/60 text-transparent hover:border-muted-foreground/40"
        )}
        title="Break Even"
      >
        <MinusSquare className="h-3 w-3" />
      </button>
      <button
        onClick={() => onChange(outcome === "loss" ? "" : "loss")}
        className={cn(
          "h-5 w-5 rounded-sm border transition-colors flex items-center justify-center",
          outcome === "loss"
            ? "bg-red-500/20 border-red-500 text-red-400"
            : "border-border/60 text-transparent hover:border-muted-foreground/40"
        )}
        title="Loss"
      >
        <XSquare className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Notes dialog ──────────────────────────────────────────────────────────────

function NotesCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <>
      <button
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className={cn(
          "flex items-center gap-1 h-7 px-1.5 text-xs rounded-sm transition-colors hover:bg-secondary/60 max-w-[140px] truncate",
          value ? "text-foreground" : "text-muted-foreground/40"
        )}
        title={value || "Add notes"}
      >
        <StickyNote className="h-3 w-3 shrink-0" />
        <span className="truncate">{value || "Notes"}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Trade Notes</DialogTitle>
            <DialogDescription>
              Record your setup reasoning, market conditions, and trade thesis.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Why did you take this trade? What was the setup?"
            className="w-full h-32 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Source badge ───────────────────────────────────────────────────────────────

function SourceBadge({ source, dryRun }: { source?: string; dryRun?: boolean }) {
  if (source === "live-trading") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-[9px] gap-0.5 py-0 px-1.5",
          dryRun
            ? "text-blue-400 border-blue-400/30"
            : "text-amber-400 border-amber-400/30"
        )}
      >
        <Zap className="h-2.5 w-2.5" />
        {dryRun ? "Sim" : "Live"}
      </Badge>
    );
  }
  if (source === "auto-buy") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "text-[9px] gap-0.5 py-0 px-1.5",
          dryRun
            ? "text-purple-400 border-purple-400/30"
            : "text-amber-400 border-amber-400/30"
        )}
      >
        <Bot className="h-2.5 w-2.5" />
        {dryRun ? "Sim" : "Auto"}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[9px] gap-0.5 py-0 px-1.5 text-muted-foreground border-border">
      <User className="h-2.5 w-2.5" />
      Manual
    </Badge>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Activity;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 min-w-[140px]">
      <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-bold font-mono leading-tight">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function TradeLogPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [filter, setFilter] = useState<OutcomeFilter>("all");
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setTrades(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  // Listen for cross-component storage events (from live-trading / auto-buy)
  useEffect(() => {
    function onStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setTrades(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    }
  }, [trades, loaded]);

  const updateTrade = useCallback(
    (id: string, patch: Partial<Trade>) => {
      setTrades((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    []
  );

  const deleteTrade = useCallback((id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addTrade = useCallback(() => {
    setTrades((prev) => [...prev, newTrade()]);
  }, []);

  const exportCSV = useCallback(() => {
    const headers = [
      "#","Date","Day","Pair","Type","Source","TF","Position","Outcome",
      "Net PnL","Fees","R-Factor","Risk %","Confidence","Amount","Duration","Notes",
    ];
    const rows = trades.map((t, i) => [
      i + 1,
      t.date,
      getDay(t.date),
      t.pair,
      t.type,
      t.source ?? "manual",
      t.timeframe,
      t.position,
      t.outcome || "",
      t.netPnl ?? "",
      t.totalFees ?? "",
      t.rFactor ?? "",
      t.riskPct ?? "",
      t.confidence ?? "",
      t.amountUsd ?? t.limit ?? "",
      t.duration,
      `"${t.preNotes.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-log-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [trades]);

  // Filtered trades
  const filtered = filter === "all" ? trades : trades.filter((t) => t.outcome === filter);

  // ─── Summary stats ───────────────────────────────────────────────────────────
  const total = filtered.length;
  const wins = filtered.filter((t) => t.outcome === "win").length;
  const losses = filtered.filter((t) => t.outcome === "loss").length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const sumPnl = filtered.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const avgPnl = total > 0 ? sumPnl / total : 0;
  const rFactors = filtered.filter((t) => t.rFactor !== null).map((t) => t.rFactor!);
  const avgR = rFactors.length > 0 ? rFactors.reduce((a, b) => a + b, 0) / rFactors.length : 0;
  const longs = filtered.filter((t) => t.position === "Long").length;
  const shorts = filtered.filter((t) => t.position === "Short").length;

  if (!loaded) {
    return (
      <AppShell title="Trade Log">
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Trade Log"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={addTrade} className="text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Trade
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-8">
        {/* ── KPI Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            label="Win Rate"
            value={total > 0 ? `${winRate.toFixed(1)}%` : "\u2014"}
            sub={`${wins}W / ${losses}L of ${total}`}
            icon={Target}
            color={winRate >= 50 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}
          />
          <KpiCard
            label="Total PnL"
            value={total > 0 ? formatPnl(sumPnl) : "\u2014"}
            sub={total > 0 ? `Avg ${formatPnl(avgPnl)}` : undefined}
            icon={sumPnl >= 0 ? TrendingUp : TrendingDown}
            color={sumPnl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}
          />
          <KpiCard
            label="Avg R-Factor"
            value={rFactors.length > 0 ? avgR.toFixed(2) : "\u2014"}
            sub={rFactors.length > 0 ? `${rFactors.length} trades with R` : undefined}
            icon={Activity}
            color="bg-primary/15 text-primary"
          />
          <KpiCard
            label="Trades"
            value={String(total)}
            sub={`${longs}L / ${shorts}S`}
            icon={ClipboardList}
            color="bg-muted text-muted-foreground"
          />
        </div>

        {/* ── Win rate bar ──────────────────────────────────────── */}
        {total > 0 && (
          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-emerald-400"
                style={{ width: `${Math.min(winRate, 100)}%` }}
              />
            </div>
            <span className={cn(
              "text-xs font-mono font-bold min-w-[45px] text-right",
              winRate >= 50 ? "text-emerald-400" : "text-red-400"
            )}>
              {winRate.toFixed(1)}%
            </span>
          </div>
        )}

        {/* ── Filter bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 w-fit">
          {(["all", "win", "breakeven", "loss"] as OutcomeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                filter === f
                  ? f === "win"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : f === "loss"
                      ? "bg-red-500/15 text-red-400"
                      : f === "breakeven"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              {f === "breakeven" ? "BE" : f}
              {f !== "all" && (
                <span className="ml-1 font-mono text-[10px] opacity-60">
                  {f === "win" ? wins : f === "loss" ? losses : filtered.filter((t) => t.outcome === "breakeven").length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Trade Table ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20 hover:bg-muted/20">
                  <TableHead className="w-8 text-center text-[10px] px-2">#</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[90px]">Date</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[80px]">Pair</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[80px]">Type</TableHead>
                  <TableHead className="text-[10px] px-2 w-[55px]">Source</TableHead>
                  <TableHead className="text-[10px] px-2 w-[45px]">TF</TableHead>
                  <TableHead className="text-[10px] px-2 w-[55px]">Side</TableHead>
                  <TableHead className="text-[10px] px-2 w-[80px]">Outcome</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[90px] text-right">Net PnL</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[65px] text-right">Amount</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[55px] text-right">R</TableHead>
                  <TableHead className="text-[10px] px-2 min-w-[100px]">Notes</TableHead>
                  <TableHead className="w-7 px-1" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-16 text-muted-foreground">
                      {trades.length === 0 ? (
                        <div className="space-y-3">
                          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/20" />
                          <p className="text-sm font-medium">No trades logged yet</p>
                          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
                            Trades are automatically logged when you execute orders from Live Trading
                            or Auto-Buy. You can also add manual entries.
                          </p>
                          <Button size="sm" variant="outline" onClick={addTrade} className="text-xs gap-1.5 mt-2">
                            <Plus className="h-3.5 w-3.5" />
                            Log your first trade
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm">No trades match the current filter</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((trade, idx) => (
                    <TableRow
                      key={trade.id}
                      className={cn(
                        "group transition-colors",
                        trade.outcome === "win" && "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]",
                        trade.outcome === "loss" && "bg-red-500/[0.03] hover:bg-red-500/[0.06]",
                        trade.outcome === "breakeven" && "bg-blue-500/[0.02] hover:bg-blue-500/[0.04]",
                        !trade.outcome && "hover:bg-muted/30"
                      )}
                    >
                      {/* # */}
                      <TableCell className="text-center text-[10px] text-muted-foreground/50 px-2 py-1.5 font-mono">
                        {idx + 1}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="px-2 py-1.5">
                        <div className="flex flex-col">
                          <EditableCell
                            value={trade.date}
                            type="date"
                            onChange={(v) => updateTrade(trade.id, { date: v })}
                            mono
                          />
                          <span className="text-[10px] text-muted-foreground/50 px-1.5 -mt-0.5">
                            {getDay(trade.date)}
                          </span>
                        </div>
                      </TableCell>

                      {/* Pair */}
                      <TableCell className="px-2 py-1.5">
                        <EditableCell
                          value={trade.pair}
                          onChange={(v) => updateTrade(trade.id, { pair: v.toUpperCase() })}
                          placeholder="AAPL"
                          className={cn(trade.pair && "text-primary font-semibold")}
                          mono
                        />
                      </TableCell>

                      {/* Type */}
                      <TableCell className="px-2 py-1.5">
                        <Select
                          value={trade.type}
                          onValueChange={(v) => updateTrade(trade.id, { type: v })}
                        >
                          <SelectTrigger className="h-7 text-[11px] border-none bg-transparent shadow-none px-1.5 hover:bg-secondary/60">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {TRADE_TYPES.map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="px-2 py-1.5">
                        <SourceBadge source={trade.source} dryRun={trade.dryRun} />
                      </TableCell>

                      {/* TF */}
                      <TableCell className="px-2 py-1.5">
                        <Select
                          value={trade.timeframe}
                          onValueChange={(v) => updateTrade(trade.id, { timeframe: v })}
                        >
                          <SelectTrigger className="h-7 text-[11px] border-none bg-transparent shadow-none px-1.5 hover:bg-secondary/60 font-mono">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIMEFRAMES.map((tf) => (
                              <SelectItem key={tf} value={tf} className="text-xs font-mono">
                                {tf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Side */}
                      <TableCell className="px-2 py-1.5">
                        <button
                          onClick={() =>
                            updateTrade(trade.id, {
                              position: trade.position === "Long" ? "Short" : "Long",
                            })
                          }
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-semibold transition-colors",
                            trade.position === "Long"
                              ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                              : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                          )}
                        >
                          {trade.position}
                        </button>
                      </TableCell>

                      {/* Outcome */}
                      <TableCell className="px-2 py-1.5">
                        <OutcomeCell
                          outcome={trade.outcome}
                          onChange={(v) => updateTrade(trade.id, { outcome: v })}
                        />
                      </TableCell>

                      {/* Net PnL */}
                      <TableCell className="px-2 py-1.5">
                        <EditableCell
                          value={trade.netPnl}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { netPnl: v ? parseFloat(v) : null })
                          }
                          placeholder="0.00"
                          align="right"
                          mono
                          className={cn(
                            trade.netPnl !== null &&
                              (trade.netPnl > 0
                                ? "text-emerald-400"
                                : trade.netPnl < 0
                                  ? "text-red-400"
                                  : "")
                          )}
                        />
                      </TableCell>

                      {/* Amount (USD) */}
                      <TableCell className="px-2 py-1.5">
                        <EditableCell
                          value={trade.amountUsd ?? trade.limit}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { amountUsd: v ? parseFloat(v) : null, limit: v ? parseFloat(v) : null })
                          }
                          placeholder="\u2014"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* R-Factor */}
                      <TableCell className="px-2 py-1.5">
                        <EditableCell
                          value={trade.rFactor}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { rFactor: v ? parseFloat(v) : null })
                          }
                          placeholder="\u2014"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="px-2 py-1.5">
                        <NotesCell
                          value={trade.preNotes}
                          onChange={(v) => updateTrade(trade.id, { preNotes: v })}
                        />
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="px-1 py-1.5">
                        <button
                          onClick={() => deleteTrade(trade.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                          title="Delete trade"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Bottom add button ──────────────────────────────────── */}
        {trades.length > 0 && (
          <button
            onClick={addTrade}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 hover:bg-secondary/40 rounded-md"
          >
            <Plus className="h-3.5 w-3.5" />
            Add trade
          </button>
        )}
      </div>
    </AppShell>
  );
}
