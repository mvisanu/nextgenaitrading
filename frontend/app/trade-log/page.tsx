"use client";

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
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Trash2,
  Filter,
  Download,
  CheckSquare,
  MinusSquare,
  XSquare,
  ClipboardList,
  ChevronDown,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Trade {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  pair: string;
  type: string;
  timeframe: string;
  position: "Long" | "Short";
  outcome: "win" | "breakeven" | "loss" | "";
  netPnl: number | null;
  totalFees: number | null;
  rFactor: number | null;
  riskPct: number | null;
  confidence: number | null;
  rangePct: number | null;
  limit: number | null;
  duration: string;
  preNotes: string;
}

type OutcomeFilter = "all" | "win" | "breakeven" | "loss";

const STORAGE_KEY = "ngs-trade-log";

const TRADE_TYPES = ["SMOG", "Scalp", "Swing", "Day Trade", "Position", "Breakout", "Reversal"];
const TIMEFRAMES = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    timeframe: "1m",
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
  };
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
      {display || placeholder || "—"}
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
          "h-4.5 w-4.5 rounded-sm border transition-colors flex items-center justify-center",
          outcome === "win"
            ? "bg-green-500/20 border-green-500 text-green-400"
            : "border-border/60 text-transparent hover:border-muted-foreground/40"
        )}
        title="Win"
      >
        <CheckSquare className="h-3 w-3" />
      </button>
      <button
        onClick={() => onChange(outcome === "breakeven" ? "" : "breakeven")}
        className={cn(
          "h-4.5 w-4.5 rounded-sm border transition-colors flex items-center justify-center",
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
          "h-4.5 w-4.5 rounded-sm border transition-colors flex items-center justify-center",
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
          "flex items-center gap-1 h-7 px-1.5 text-xs rounded-sm transition-colors hover:bg-secondary/60 max-w-[120px] truncate",
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
            <DialogTitle>Pre-Trade Notes</DialogTitle>
            <DialogDescription>
              Record your setup reasoning, market conditions, and trade thesis.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Why are you taking this trade? What's the setup? What could go wrong?"
            className="w-full h-32 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
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
      "#","Date","Day","Pair","Type","TF","Position","Win","BE","Loss",
      "Net PnL","Fees","R-Factor","Risk %","Confidence","Range %","Limit","Duration","Notes",
    ];
    const rows = trades.map((t, i) => [
      i + 1,
      t.date,
      getDay(t.date),
      t.pair,
      t.type,
      t.timeframe,
      t.position,
      t.outcome === "win" ? "Y" : "",
      t.outcome === "breakeven" ? "Y" : "",
      t.outcome === "loss" ? "Y" : "",
      t.netPnl ?? "",
      t.totalFees ?? "",
      t.rFactor ?? "",
      t.riskPct ?? "",
      t.confidence ?? "",
      t.rangePct ?? "",
      t.limit ?? "",
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
  const bes = filtered.filter((t) => t.outcome === "breakeven").length;
  const winRate = total > 0 ? ((wins / total) * 100) : 0;
  const sumPnl = filtered.reduce((s, t) => s + (t.netPnl ?? 0), 0);
  const avgPnl = total > 0 ? sumPnl / total : 0;
  const rFactors = filtered.filter((t) => t.rFactor !== null).map((t) => t.rFactor!);
  const avgR = rFactors.length > 0 ? rFactors.reduce((a, b) => a + b, 0) / rFactors.length : 0;
  const longs = filtered.filter((t) => t.position === "Long").length;
  const shorts = filtered.filter((t) => t.position === "Short").length;

  if (!loaded) {
    return (
      <AppShell title="Master Trade Log">
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Master Trade Log">
      <div className="space-y-4 pb-8">
        {/* ── Header Bar ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">Master Trade Log</h1>
            <Badge variant="secondary" className="text-xs font-mono">
              {trades.length} {trades.length === 1 ? "trade" : "trades"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter */}
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground ml-2" />
              {(["all", "win", "breakeven", "loss"] as OutcomeFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-sm text-xs font-medium transition-colors capitalize",
                    filter === f
                      ? f === "win"
                        ? "bg-green-500/15 text-green-400"
                        : f === "loss"
                          ? "bg-red-500/15 text-red-400"
                          : f === "breakeven"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  {f === "breakeven" ? "BE" : f}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button size="sm" onClick={addTrade} className="text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Trade
            </Button>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-10 text-center text-xs px-2">#</TableHead>
                  <TableHead className="text-xs px-2 min-w-[110px]">Date</TableHead>
                  <TableHead className="text-xs px-2 min-w-[75px]">Day</TableHead>
                  <TableHead className="text-xs px-2 min-w-[90px]">Pair</TableHead>
                  <TableHead className="text-xs px-2 min-w-[80px]">Type</TableHead>
                  <TableHead className="text-xs px-2 w-[55px]">TF</TableHead>
                  <TableHead className="text-xs px-2 w-[65px]">Position</TableHead>
                  <TableHead className="text-xs px-2 w-[90px]">
                    <div className="flex items-center gap-1">
                      <span className="text-green-400">W</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-blue-400">B</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-400">L</span>
                    </div>
                  </TableHead>
                  <TableHead className="text-xs px-2 min-w-[95px] text-right">Net PnL $</TableHead>
                  <TableHead className="text-xs px-2 min-w-[75px] text-right">Fees</TableHead>
                  <TableHead className="text-xs px-2 min-w-[70px] text-right">R-Factor</TableHead>
                  <TableHead className="text-xs px-2 w-[55px] text-right">Risk%</TableHead>
                  <TableHead className="text-xs px-2 w-[40px] text-center" title="Confidence 1-5">
                    <ChevronDown className="h-3 w-3 inline" />
                  </TableHead>
                  <TableHead className="text-xs px-2 w-[55px] text-right">Range%</TableHead>
                  <TableHead className="text-xs px-2 w-[55px] text-right">Limit</TableHead>
                  <TableHead className="text-xs px-2 min-w-[70px]">Duration</TableHead>
                  <TableHead className="text-xs px-2 min-w-[90px]">Notes</TableHead>
                  <TableHead className="w-8 px-1" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-12 text-muted-foreground">
                      {trades.length === 0 ? (
                        <div className="space-y-2">
                          <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground/40" />
                          <p className="text-sm">No trades logged yet</p>
                          <Button size="sm" variant="outline" onClick={addTrade} className="text-xs gap-1.5">
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
                        "group",
                        trade.outcome === "win" && "bg-green-500/[0.02]",
                        trade.outcome === "loss" && "bg-red-500/[0.02]"
                      )}
                    >
                      {/* # */}
                      <TableCell className="text-center text-xs text-muted-foreground px-2 py-1 font-mono">
                        {idx + 1}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.date}
                          type="date"
                          onChange={(v) => updateTrade(trade.id, { date: v })}
                          mono
                        />
                      </TableCell>

                      {/* Day */}
                      <TableCell className="px-2 py-1">
                        <span className="text-xs text-muted-foreground px-1.5">
                          {getDay(trade.date)}
                        </span>
                      </TableCell>

                      {/* Pair */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.pair}
                          onChange={(v) => updateTrade(trade.id, { pair: v.toUpperCase() })}
                          placeholder="AAPL"
                          className={cn(trade.pair && "text-primary font-semibold")}
                          mono
                        />
                      </TableCell>

                      {/* Type */}
                      <TableCell className="px-2 py-1">
                        <Select
                          value={trade.type}
                          onValueChange={(v) => updateTrade(trade.id, { type: v })}
                        >
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none px-1.5 hover:bg-secondary/60">
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

                      {/* TF */}
                      <TableCell className="px-2 py-1">
                        <Select
                          value={trade.timeframe}
                          onValueChange={(v) => updateTrade(trade.id, { timeframe: v })}
                        >
                          <SelectTrigger className="h-7 text-xs border-none bg-transparent shadow-none px-1.5 hover:bg-secondary/60 font-mono">
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

                      {/* Position */}
                      <TableCell className="px-2 py-1">
                        <button
                          onClick={() =>
                            updateTrade(trade.id, {
                              position: trade.position === "Long" ? "Short" : "Long",
                            })
                          }
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-semibold transition-colors",
                            trade.position === "Long"
                              ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                              : "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                          )}
                        >
                          {trade.position}
                        </button>
                      </TableCell>

                      {/* Win / BE / Loss */}
                      <TableCell className="px-2 py-1">
                        <OutcomeCell
                          outcome={trade.outcome}
                          onChange={(v) => updateTrade(trade.id, { outcome: v })}
                        />
                      </TableCell>

                      {/* Net PnL */}
                      <TableCell className="px-2 py-1">
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
                                ? "text-green-400"
                                : trade.netPnl < 0
                                  ? "text-red-400"
                                  : "")
                          )}
                        />
                      </TableCell>

                      {/* Fees */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.totalFees}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { totalFees: v ? parseFloat(v) : null })
                          }
                          placeholder="0.00"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* R-Factor */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.rFactor}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { rFactor: v ? parseFloat(v) : null })
                          }
                          placeholder="—"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* Risk % */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.riskPct}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { riskPct: v ? parseFloat(v) : null })
                          }
                          placeholder="1"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* Confidence */}
                      <TableCell className="px-2 py-1 text-center">
                        <Select
                          value={trade.confidence?.toString() ?? ""}
                          onValueChange={(v) =>
                            updateTrade(trade.id, { confidence: v ? parseInt(v) : null })
                          }
                        >
                          <SelectTrigger className="h-7 w-10 text-xs border-none bg-transparent shadow-none px-1 mx-auto hover:bg-secondary/60 font-mono">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((n) => (
                              <SelectItem key={n} value={n.toString()} className="text-xs font-mono">
                                {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      {/* Range % */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.rangePct}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { rangePct: v ? parseFloat(v) : null })
                          }
                          placeholder="—"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* Limit */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.limit}
                          type="number"
                          onChange={(v) =>
                            updateTrade(trade.id, { limit: v ? parseFloat(v) : null })
                          }
                          placeholder="—"
                          align="right"
                          mono
                        />
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="px-2 py-1">
                        <EditableCell
                          value={trade.duration}
                          onChange={(v) => updateTrade(trade.id, { duration: v })}
                          placeholder="2h 30m"
                        />
                      </TableCell>

                      {/* Notes */}
                      <TableCell className="px-2 py-1">
                        <NotesCell
                          value={trade.preNotes}
                          onChange={(v) => updateTrade(trade.id, { preNotes: v })}
                        />
                      </TableCell>

                      {/* Delete */}
                      <TableCell className="px-1 py-1">
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

              {/* ── Summary Footer ───────────────────────────────────── */}
              {filtered.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-muted/20 hover:bg-muted/20 border-t-2 border-border">
                    <TableCell className="px-2 py-2.5 text-xs font-semibold text-muted-foreground text-center">
                      {total}
                    </TableCell>
                    <TableCell colSpan={2} className="px-2 py-2.5 text-xs text-muted-foreground">
                      <span className="font-mono text-muted-foreground/60">COUNT {total}</span>
                    </TableCell>
                    <TableCell colSpan={2} className="px-2 py-2.5 text-xs text-muted-foreground">
                      <span className="font-mono text-muted-foreground/60">
                        L:{longs} S:{shorts}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-mono">{wins}W</span>
                        <span className="text-blue-400 font-mono">{bes}B</span>
                        <span className="text-red-400 font-mono">{losses}L</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2.5 text-right">
                      <div className="space-y-0.5">
                        <p className={cn(
                          "text-xs font-bold font-mono",
                          sumPnl > 0 ? "text-green-400" : sumPnl < 0 ? "text-red-400" : "text-muted-foreground"
                        )}>
                          {sumPnl >= 0 ? "+" : ""}${sumPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono">
                          AVG ${avgPnl.toFixed(2)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5 text-right">
                      <p className="text-xs font-mono text-muted-foreground">
                        AVG {avgR.toFixed(3)}
                      </p>
                    </TableCell>
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                    <TableCell className="px-2 py-2.5" />
                  </TableRow>

                  {/* Win rate bar */}
                  <TableRow className="bg-transparent hover:bg-transparent border-0">
                    <TableCell colSpan={18} className="px-2 py-3">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Win Rate</span>
                          <span className={cn(
                            "font-mono font-bold text-sm",
                            winRate >= 50 ? "text-green-400" : "text-red-400"
                          )}>
                            {winRate.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden max-w-xs">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-green-400"
                            style={{ width: `${Math.min(winRate, 100)}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>SUM <span className={cn("font-mono font-semibold", sumPnl >= 0 ? "text-green-400" : "text-red-400")}>${sumPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
                          <span>AVG <span className="font-mono font-semibold text-foreground">${avgPnl.toFixed(2)}</span></span>
                          <span>AVG R <span className="font-mono font-semibold text-foreground">{avgR.toFixed(2)}</span></span>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </div>

        {/* ── Bottom add button ──────────────────────────────────── */}
        <button
          onClick={addTrade}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 hover:bg-secondary/40 rounded-md"
        >
          <Plus className="h-3.5 w-3.5" />
          New trade
        </button>
      </div>
    </AppShell>
  );
}
