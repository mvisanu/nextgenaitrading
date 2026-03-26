"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sun, Moon, Settings, Bell, ChevronDown, ChevronRight, Search, X, Plus, Trash2, Pencil, Check, TrendingUp, SquareDashed, Eraser, Eye, EyeOff, PanelRightClose, PanelRightOpen, ChevronUp, Crosshair, Lightbulb, BarChart4, Activity, Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/layout/AppShell";
import { PriceChart, type DrawingMode, type ChartClickPoint } from "@/components/charts/PriceChart";
import { detectFVGs, type DrawingData, type TrendLineData, type FVGData, type DrawingPoint } from "@/components/charts/DrawingPrimitives";
import { liveApi, strategyApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useSidebarPinned } from "@/lib/sidebar";
import { useWatchlist, flattenWatchlist, type WatchlistItem, type WatchlistCategory } from "@/lib/watchlist";
import { cn } from "@/lib/utils";
import type { CandleBar } from "@/types";

// Watchlist data now comes from shared hook (lib/watchlist.ts)

// ─── Interval config ──────────────────────────────────────────────────────────

interface IntervalOption {
  label: string;
  value: string;
  shortLabel: string;
}

interface IntervalGroup {
  title: string;
  items: IntervalOption[];
}

const INTERVAL_GROUPS: IntervalGroup[] = [
  {
    title: "MINUTES",
    items: [
      { label: "1 minute",    value: "1m",  shortLabel: "1m"  },
      { label: "2 minutes",   value: "2m",  shortLabel: "2m"  },
      { label: "5 minutes",   value: "5m",  shortLabel: "5m"  },
      { label: "15 minutes",  value: "15m", shortLabel: "15m" },
      { label: "30 minutes",  value: "30m", shortLabel: "30m" },
    ],
  },
  {
    title: "HOURS",
    items: [
      { label: "1 hour",   value: "1h", shortLabel: "1H" },
      { label: "2 hours",  value: "2h", shortLabel: "2H" },
      { label: "3 hours",  value: "3h", shortLabel: "3H" },
      { label: "4 hours",  value: "4h", shortLabel: "4H" },
    ],
  },
  {
    title: "DAYS",
    items: [
      { label: "1 day",   value: "1d",  shortLabel: "1D" },
      { label: "1 week",  value: "1wk", shortLabel: "1W" },
      { label: "1 month", value: "1mo", shortLabel: "1M" },
    ],
  },
];

const ALL_INTERVALS = INTERVAL_GROUPS.flatMap((g) => g.items);
const DEFAULT_INTERVAL = ALL_INTERVALS.find((i) => i.value === "1d")!;

// Quick-access interval buttons shown in the toolbar
const QUICK_INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D", "1W"];


// Common yfinance symbol suggestions for search autocomplete
const POPULAR_SYMBOLS = [
  "BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOGE-USD", "XRP-USD",
  "AAPL", "TSLA", "NFLX", "GOOGL", "AMZN", "MSFT", "NVDA", "META", "AMD",
  "SPY", "QQQ", "DIA", "IWM", "GLD", "SLV",
  "JPM", "BAC", "GS", "V", "MA", "PYPL",
  "COIN", "MSTR", "RIOT", "MARA", "HOOD",
  "^GSPC", "^IXIC", "^DJI", "^VIX",
];

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, symbol: string): string {
  if (price < 1) return price.toFixed(4);
  if (price > 10000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(val: number): string {
  const sign = val >= 0 ? "+" : "";
  if (Math.abs(val) < 1) return `${sign}${val.toFixed(4)}`;
  return `${sign}${val.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Fills parent height using ResizeObserver, then passes pixel height to PriceChart
function PriceChartFill({
  data,
  theme,
  drawingMode,
  drawings,
  onChartClick,
  bollingerData,
}: {
  data: CandleBar[];
  theme: "dark" | "light";
  drawingMode?: DrawingMode;
  drawings?: DrawingData[];
  onChartClick?: (point: ChartClickPoint) => void;
  bollingerData?: import("@/types").BollingerOverlayBar[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height);
    });
    ro.observe(wrapRef.current);
    setHeight(wrapRef.current.clientHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <PriceChart
        data={data}
        height={height}
        theme={theme}
        drawingMode={drawingMode}
        drawings={drawings}
        onChartClick={onChartClick}
        bollingerData={bollingerData}
      />
    </div>
  );
}

// Single watchlist row
function WatchlistRow({
  item,
  isSelected,
  isEditing,
  onClick,
  onRemove,
}: {
  item: WatchlistItem;
  isSelected: boolean;
  isEditing: boolean;
  onClick: () => void;
  onRemove: () => void;
}) {
  const positive = item.change >= 0;
  const changeColor = positive ? "#26a69a" : "#ef5350";

  return (
    <div
      className={cn(
        "group flex items-center w-full px-2 text-left transition-colors cursor-pointer",
        "hover:bg-secondary/60",
        isSelected && "bg-secondary"
      )}
      style={{ height: 28 }}
      onClick={onClick}
    >
      {/* Delete button (visible in edit mode or on hover) */}
      {isEditing ? (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 mr-1 text-red-400 hover:text-red-300 transition-colors"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : (
        <span
          className="shrink-0 rounded-full mr-1.5"
          style={{ width: 8, height: 8, background: item.color }}
        />
      )}
      {/* Symbol */}
      <span className="font-mono font-semibold text-[11px] text-foreground w-[52px] truncate shrink-0">
        {item.symbol}
      </span>
      {/* Price */}
      <span className="font-mono text-[11px] text-foreground ml-auto shrink-0 tabular-nums">
        {formatPrice(item.price, item.symbol)}
      </span>
      {/* Change */}
      <span
        className="font-mono text-[11px] ml-1.5 shrink-0 tabular-nums w-[42px] text-right"
        style={{ color: changeColor }}
      >
        {formatChange(item.change)}
      </span>
      {/* Change % */}
      <span
        className="font-mono text-[11px] ml-1.5 shrink-0 tabular-nums w-[44px] text-right"
        style={{ color: changeColor }}
      >
        {positive ? "+" : ""}{item.changePct.toFixed(2)}%
      </span>
    </div>
  );
}

// Collapsible watchlist section with add/remove
function WatchlistSection({
  title,
  items,
  selectedSymbol,
  isEditing,
  onSelect,
  onRemove,
  onAdd,
}: {
  title: string;
  items: WatchlistItem[];
  selectedSymbol: string;
  isEditing: boolean;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onAdd: (symbol: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [showAddInput, setShowAddInput] = useState(false);
  const [addValue, setAddValue] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddInput && addInputRef.current) addInputRef.current.focus();
  }, [showAddInput]);

  function handleAddSubmit() {
    const sym = addValue.trim().toUpperCase();
    if (sym) {
      onAdd(sym);
      setAddValue("");
      setShowAddInput(false);
    }
  }

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center w-full px-2 py-1 hover:bg-secondary/40 transition-colors">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center flex-1"
        >
          {open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground mr-1 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground mr-1 shrink-0" />
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-[10px] text-muted-foreground/60 ml-1">{items.length}</span>
        </button>
        {/* Add button */}
        {open && (
          <button
            onClick={() => setShowAddInput((v) => !v)}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
            title="Add symbol"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Add input */}
      {open && showAddInput && (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            ref={addInputRef}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubmit();
              if (e.key === "Escape") { setShowAddInput(false); setAddValue(""); }
            }}
            placeholder="AAPL, BTC-USD..."
            className="flex-1 bg-background border border-border rounded px-1.5 py-0.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleAddSubmit}
            disabled={!addValue.trim()}
            className="text-primary hover:text-primary/80 disabled:text-muted-foreground transition-colors"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={() => { setShowAddInput(false); setAddValue(""); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Rows */}
      {open &&
        items.map((item) => (
          <WatchlistRow
            key={item.symbol}
            item={item}
            isSelected={item.symbol === selectedSymbol}
            isEditing={isEditing}
            onClick={() => onSelect(item.symbol)}
            onRemove={() => onRemove(item.symbol)}
          />
        ))}
    </div>
  );
}

// Symbol detail panel at the bottom of the watchlist
function SymbolDetail({ item }: { item: WatchlistItem }) {
  const positive = item.change >= 0;
  const changeColor = positive ? "#26a69a" : "#ef5350";

  return (
    <div className="border-t border-border p-3 shrink-0">
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="inline-block rounded-full mr-1"
          style={{ width: 10, height: 10, background: item.color, flexShrink: 0 }}
        />
        <span className="font-mono font-bold text-sm text-foreground">{item.symbol}</span>
        <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
      </div>

      <div className="font-mono font-bold text-xl text-foreground tabular-nums">
        {formatPrice(item.price, item.symbol)}{" "}
        <span className="text-xs font-normal text-muted-foreground">USD</span>
      </div>

      <div className="flex items-center gap-2 mt-0.5">
        <span className="font-mono text-xs tabular-nums" style={{ color: changeColor }}>
          {formatChange(item.change)} ({positive ? "+" : ""}{item.changePct.toFixed(2)}%)
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#26a69a] shrink-0" />
        <span className="text-[11px] text-muted-foreground">Market open</span>
      </div>
    </div>
  );
}

// ─── Interval Dropdown Component ─────────────────────────────────────────────

function IntervalDropdown({
  selected,
  onSelect,
}: {
  selected: IntervalOption;
  onSelect: (interval: IntervalOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
          isOpen
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        )}
      >
        <ChevronDown className="h-3 w-3" />
        {selected.shortLabel}
      </button>

      {isOpen && (
        <div className="absolute top-8 left-0 z-50 w-[180px] max-h-[380px] overflow-y-auto rounded border border-border bg-card shadow-lg">
          {INTERVAL_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 py-1.5 border-b border-border flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {group.title}
                </span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    onSelect(item);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center w-full px-3 py-1.5 text-left text-[12px] hover:bg-secondary/60 transition-colors",
                    item.value === selected.value
                      ? "text-primary font-semibold bg-primary/5"
                      : "text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Symbol Search Component ─────────────────────────────────────────────────

function SymbolSearch({
  currentSymbol,
  onSelect,
  watchlistItems = [],
}: {
  currentSymbol: string;
  onSelect: (symbol: string) => void;
  watchlistItems?: WatchlistItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // All known symbols: popular + watchlist
  const allSymbols = [
    ...new Set([
      ...POPULAR_SYMBOLS,
      ...watchlistItems.map((i) => i.symbol),
    ]),
  ];

  const filtered = query.trim()
    ? allSymbols.filter((s) =>
        s.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 12)
    : POPULAR_SYMBOLS.slice(0, 12);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  function handleSubmit(sym?: string) {
    const target = (sym ?? query).trim().toUpperCase();
    if (target) {
      onSelect(target);
      setQuery("");
      setIsOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      {isOpen ? (
        <div className="flex items-center gap-1 bg-card border border-primary rounded px-1.5 py-0.5">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
              if (e.key === "Escape") { setIsOpen(false); setQuery(""); }
            }}
            placeholder="Symbol (e.g. AAPL, BTC-USD)"
            className="bg-transparent text-[12px] font-mono text-foreground outline-none w-[180px] placeholder:text-muted-foreground"
          />
          <button
            onClick={() => { setIsOpen(false); setQuery(""); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-card border border-border text-[12px] font-mono font-bold text-foreground hover:border-primary transition-colors"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
          {currentSymbol}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-8 left-0 z-50 w-[240px] max-h-[320px] overflow-y-auto rounded border border-border bg-card shadow-lg">
          <div className="px-2 py-1.5 border-b border-border">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {query.trim() ? "Search results" : "Popular symbols"}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-[11px] text-muted-foreground mb-2">
                No matches — press Enter to load &quot;{query.toUpperCase()}&quot;
              </p>
              <button
                onClick={() => handleSubmit()}
                className="text-[11px] text-primary hover:underline"
              >
                Load {query.toUpperCase()}
              </button>
            </div>
          ) : (
            filtered.map((sym) => {
              const watchItem = watchlistItems.find((i) => i.symbol === sym);
              return (
                <button
                  key={sym}
                  onClick={() => handleSubmit(sym)}
                  className={cn(
                    "flex items-center w-full px-3 py-1.5 text-left hover:bg-secondary/60 transition-colors",
                    sym === currentSymbol && "bg-primary/10"
                  )}
                >
                  <span className="font-mono font-semibold text-[11px] text-foreground w-[70px]">
                    {sym}
                  </span>
                  {watchItem && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {watchItem.name}
                    </span>
                  )}
                </button>
              );
            })
          )}
          <div className="px-3 py-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              Type any yfinance ticker and press Enter
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard User Status ────────────────────────────────────────────────────

function DashboardUserStatus() {
  const { user } = useAuth();
  return <span>{user?.email ?? ""}</span>;
}

// ─── KPI Cards panel ─────────────────────────────────────────────────────────

function KpiCardsPanel() {
  const [expanded, setExpanded] = useState(false);
  const { data: runs = [] } = useQuery({
    queryKey: ["strategies", "runs"],
    queryFn: () => strategyApi.listRuns(10),
  });

  const totalRuns = runs.length;
  const lastRun = runs[0];
  const winningRuns = runs.filter(
    (r) => r.current_signal === "BUY"
  ).length;

  return (
    <div className="shrink-0 border-b border-border bg-card/50">
      {/* Compact KPI strip — always visible */}
      <div className="flex items-center px-3 h-8 gap-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title={expanded ? "Collapse" : "Show recent runs"}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Runs</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">{totalRuns}</span>
          </div>
          <div className="w-px h-3 bg-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">BUY</span>
            <span className="text-xs font-semibold text-[#26a69a] tabular-nums">{winningRuns}</span>
          </div>
          <div className="w-px h-3 bg-border shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Last</span>
            <span className="text-xs font-semibold text-foreground font-mono">{lastRun?.symbol ?? "\u2014"}</span>
            {lastRun?.current_signal && (
              <span className={cn("text-xs font-semibold", lastRun.current_signal === "BUY" ? "text-[#26a69a]" : lastRun.current_signal === "SELL" ? "text-[#ef5350]" : "text-muted-foreground")}>
                {lastRun.current_signal}
              </span>
            )}
          </div>
          <div className="w-px h-3 bg-border shrink-0" />
          {/* Quick links */}
          <div className="flex items-center gap-1 shrink-0" data-testid="kpi-card">
            <Link href="/strategies" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors">
              <TrendingUp className="h-3 w-3" />
              Strategies
            </Link>
            <Link href="/screener" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors">
              <BarChart4 className="h-3 w-3" />
              Screener
            </Link>
            <Link href="/opportunities" className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors">
              <Crosshair className="h-3 w-3" />
              Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* Expandable recent runs table */}
      {expanded && (
        <div className="px-3 pb-2" data-testid="recent-runs">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recent Strategy Runs</h2>
          {runs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">No strategy runs yet. <Link href="/strategies" className="text-primary hover:underline">Run a strategy</Link> to see results here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left pb-0.5 pr-3">Symbol</th>
                    <th className="text-left pb-0.5 pr-3">Mode</th>
                    <th className="text-left pb-0.5 pr-3">Timeframe</th>
                    <th className="text-left pb-0.5">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 5).map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="pr-3 py-0.5 font-mono font-semibold text-foreground">{r.symbol}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.mode_name}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.timeframe}</td>
                      <td className="py-0.5">
                        <span className={r.current_signal === "BUY" ? "text-[#26a69a]" : r.current_signal === "SELL" ? "text-[#ef5350]" : "text-muted-foreground"}>
                          {r.current_signal ?? "\u2014"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardContent() {
  const { theme, toggle } = useTheme();
  const { pinned: sidebarPinned } = useSidebarPinned();
  const searchParams = useSearchParams();

  // Active symbol and interval — use ?ticker= query param if present
  const initialTicker = searchParams.get("ticker")?.toUpperCase().trim() || "BTC-USD";
  const [symbol, setSymbol] = useState(initialTicker);
  const [interval, setInterval] = useState<IntervalOption>(DEFAULT_INTERVAL);

  // Shared watchlist (syncs with opportunities page via localStorage events)
  const { watchlist, allItems: _allWatchlistItems, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const [isEditingWatchlist, setIsEditingWatchlist] = useState(false);

  // ── Panel & drawing tools state ─────────────────────────────────────────
  const [showWatchlist, setShowWatchlist] = useState(true);
  const [mobileWatchlistOpen, setMobileWatchlistOpen] = useState(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("none");
  const [drawings, setDrawings] = useState<DrawingData[]>([]);
  const [pendingPoint, setPendingPoint] = useState<DrawingPoint | null>(null);
  const [showFVG, setShowFVG] = useState(false);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [showDrawingTools, setShowDrawingTools] = useState(false);

  const DRAWING_STORAGE_KEY = "ngs-drawings";

  // Cancel drawing on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && drawingMode !== "none") {
        setDrawingMode("none");
        setPendingPoint(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingMode]);

  // Load drawings from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAWING_STORAGE_KEY);
      if (raw) setDrawings(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist drawings
  const saveDrawings = useCallback((d: DrawingData[]) => {
    setDrawings(d);
    try { localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(d)); } catch {}
  }, []);

  // Handle chart clicks for drawing
  const handleChartClick = useCallback((point: ChartClickPoint) => {
    if (drawingMode === "trendline") {
      if (!pendingPoint) {
        // First click — set start point
        setPendingPoint({ time: point.time, price: point.price });
      } else {
        // Second click — complete the trend line
        const newLine: TrendLineData = {
          id: crypto.randomUUID(),
          type: "trendline",
          p1: pendingPoint,
          p2: { time: point.time, price: point.price },
          color: "#2962ff",
          lineWidth: 2,
        };
        const next = [...drawings, newLine];
        saveDrawings(next);
        setPendingPoint(null);
        setDrawingMode("none");
      }
    } else if (drawingMode === "fvg") {
      if (!pendingPoint) {
        setPendingPoint({ time: point.time, price: point.price });
      } else {
        const newFVG: FVGData = {
          id: crypto.randomUUID(),
          type: "fvg",
          startTime: pendingPoint.time,
          endTime: point.time,
          highPrice: Math.max(pendingPoint.price, point.price),
          lowPrice: Math.min(pendingPoint.price, point.price),
          direction: point.price > pendingPoint.price ? "bullish" : "bearish",
        };
        const next = [...drawings, newFVG];
        saveDrawings(next);
        setPendingPoint(null);
        setDrawingMode("none");
      }
    }
  }, [drawingMode, pendingPoint, drawings, saveDrawings]);

  const clearAllDrawings = useCallback(() => {
    saveDrawings([]);
    setPendingPoint(null);
    setDrawingMode("none");
  }, [saveDrawings]);

  const toggleDrawingMode = useCallback((mode: DrawingMode) => {
    setDrawingMode((prev) => {
      setPendingPoint(null);
      return prev === mode ? "none" : mode;
    });
  }, []);

  // Chart loads whatever symbol the user typed — no restriction
  const chartSymbol = symbol;

  // Fetch candlestick data
  const { data: chartPayload, isLoading: chartLoading } = useQuery({
    queryKey: ["live", "chart-data", chartSymbol, interval.value, showBollinger],
    queryFn: () => liveApi.chartData(chartSymbol, interval.value, showBollinger),
  });

  const candles = useMemo(() => chartPayload?.candles ?? [], [chartPayload]);
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const priceChange =
    lastCandle && prevCandle ? lastCandle.close - prevCandle.close : null;
  const pricePct =
    priceChange !== null && prevCandle
      ? (priceChange / prevCandle.close) * 100
      : null;
  const isPositive = priceChange !== null && priceChange >= 0;

  // Auto-detected FVGs from candle data
  const autoFVGs = useMemo(() => {
    if (!showFVG || candles.length < 3) return [];
    return detectFVGs(candles);
  }, [showFVG, candles]);

  // Combined drawings for the chart
  const allDrawings = useMemo(() => {
    if (!showDrawings) return autoFVGs;
    return [...drawings, ...autoFVGs];
  }, [drawings, autoFVGs, showDrawings]);

  // Flatten for lookups
  const allItems = flattenWatchlist(watchlist);

  // Selected watchlist item details
  const selectedItem = allItems.find((i) => i.symbol === symbol) ?? allItems[0];

  // Handle symbol selection
  const handleSelectSymbol = useCallback((s: string) => {
    setSymbol(s);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Page title — 1px visible element so Playwright toBeVisible() returns true.
          opacity-0 was used but Playwright v1.44 treats opacity:0 as not-visible. */}
      <h1
        data-testid="page-title"
        className="absolute top-0 left-0 w-px h-px overflow-hidden pointer-events-none"
      >
        Dashboard
      </h1>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-40">
        <Sidebar />
      </div>

      {/* ── Main content area (offset by sidebar width) ─────────── */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-[padding] duration-200 ${sidebarPinned ? "lg:pl-[200px]" : "lg:pl-12"}`}>

        {/* ── Top toolbar (40px) ────────────────────────────────────────── */}
        <header className="flex h-10 shrink-0 items-center border-b border-border bg-secondary px-2 gap-1 z-20 overflow-x-auto">
          {/* Mobile menu hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7 shrink-0">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[200px] p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>

          {/* Symbol search */}
          <SymbolSearch currentSymbol={symbol} onSelect={handleSelectSymbol} watchlistItems={allItems} />

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

          {/* Interval dropdown */}
          <IntervalDropdown selected={interval} onSelect={setInterval} />

          {/* Quick-access interval buttons */}
          <div className="hidden sm:flex items-center gap-0.5 shrink-0">
            {QUICK_INTERVALS.map((qi) => {
              const opt = ALL_INTERVALS.find(
                (i) => i.shortLabel === qi || i.value === qi
              );
              if (!opt) return null;
              return (
                <button
                  key={qi}
                  onClick={() => setInterval(opt)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
                    opt.value === interval.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                  )}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

          {/* Indicators button — hidden on mobile */}
          <button className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0">
            <span>Indicators</span>
          </button>

          {/* Alert button — hidden on mobile */}
          <button className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0">
            <Bell className="h-3.5 w-3.5" />
            <span>Alert</span>
          </button>

          {/* Divider — hidden on mobile */}
          <div className="hidden sm:block w-px h-5 bg-border mx-0.5 shrink-0" />

          {/* Drawing tools toggle */}
          <button
            onClick={() => setShowDrawingTools((v) => !v)}
            title="Drawing tools"
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
              showDrawingTools || drawingMode !== "none"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Draw</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Drawing tools expanded */}
          {showDrawingTools && (
            <>
              <button
                onClick={() => toggleDrawingMode("trendline")}
                title="Draw trend line (click two points)"
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
                  drawingMode === "trendline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Trend Line</span>
              </button>

              <button
                onClick={() => toggleDrawingMode("fvg")}
                title="Draw Fair Value Gap zone (click two corners)"
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
                  drawingMode === "fvg"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                <SquareDashed className="h-3.5 w-3.5" />
                <span>FVG</span>
              </button>

              <button
                onClick={() => setShowFVG((v) => !v)}
                title={showFVG ? "Hide auto-detected FVGs" : "Show auto-detected FVGs"}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
                  showFVG
                    ? "bg-[#26a69a]/20 text-[#26a69a]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                <SquareDashed className="h-3.5 w-3.5" />
                <span>Auto FVG</span>
              </button>

              <button
                onClick={() => setShowBollinger((v) => !v)}
                title={showBollinger ? "Hide Bollinger Bands" : "Show Bollinger Band Squeeze"}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
                  showBollinger
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>BB Squeeze</span>
              </button>

              {drawings.length > 0 && (
                <>
                  <button
                    onClick={() => setShowDrawings((v) => !v)}
                    title={showDrawings ? "Hide drawings" : "Show drawings"}
                    className={cn(
                      "flex items-center justify-center h-7 w-7 rounded transition-colors shrink-0",
                      showDrawings
                        ? "text-primary hover:bg-secondary/80"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                    )}
                  >
                    {showDrawings ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={clearAllDrawings}
                    title="Clear all drawings"
                    className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-red-400 hover:bg-secondary/80 transition-colors shrink-0"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </>
          )}

          {/* Drawing mode status */}
          {drawingMode !== "none" && (
            <span className="text-[10px] text-primary font-medium animate-pulse shrink-0">
              {pendingPoint ? "Click second point..." : "Click first point..."}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Watchlist panel toggle — desktop */}
          <button
            onClick={() => setShowWatchlist((v) => !v)}
            title={showWatchlist ? "Hide watchlist" : "Show watchlist"}
            className="hidden md:flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
          >
            {showWatchlist ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          {/* Watchlist toggle — mobile (opens as bottom sheet) */}
          <button
            onClick={() => setMobileWatchlistOpen(true)}
            title="Watchlist"
            className="md:hidden flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>

          {/* Settings icon */}
          <button
            title="Settings"
            className="flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
          >
            <Settings className="h-4 w-4" />
          </button>
        </header>

        {/* ── KPI cards + recent runs ───────────────────────────────────── */}
        <KpiCardsPanel />

        {/* ── Main content (chart + watchlist) ─────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Chart panel (~75%) ───────────────────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border">

            {/* OHLCV header bar */}
            <div className="flex items-center gap-3 px-3 h-8 shrink-0 border-b border-border bg-card/50 text-[11px] font-mono overflow-x-auto">
              <span className="text-foreground font-semibold">
                {chartSymbol} · {interval.shortLabel} · CRYPTOCAP
              </span>
              {lastCandle && (
                <>
                  <span className="text-muted-foreground">
                    O:{" "}
                    <span className="text-foreground">
                      {lastCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    H:{" "}
                    <span className="text-foreground">
                      {lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    L:{" "}
                    <span className="text-foreground">
                      {lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    C:{" "}
                    <span className="text-foreground">
                      {lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </span>
                  {priceChange !== null && pricePct !== null && (
                    <span style={{ color: isPositive ? "#26a69a" : "#ef5350" }}>
                      {isPositive ? "+" : ""}
                      {priceChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {" "}({isPositive ? "+" : ""}{pricePct.toFixed(2)}%)
                    </span>
                  )}
                </>
              )}
              {chartLoading && (
                <span className="text-muted-foreground">Loading...</span>
              )}
            </div>

            {/* Chart fills remaining height */}
            <div className="flex-1 min-h-0">
              {chartLoading ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Loading chart data...
                </div>
              ) : (
                <PriceChartFill
                  data={candles}
                  theme={theme}
                  drawingMode={drawingMode}
                  drawings={allDrawings}
                  onChartClick={handleChartClick}
                  bollingerData={showBollinger ? (chartPayload?.bollinger ?? undefined) : undefined}
                />
              )}
            </div>
          </div>

          {/* ── Watchlist panel (~25%, 320px on desktop, full-width overlay on mobile) ── */}
          {showWatchlist && <div
            className="hidden md:flex flex-col shrink-0 bg-card overflow-hidden"
            style={{ width: 320 }}
          >
            {/* Panel header with column labels + edit toggle */}
            <div className="flex items-center px-2 h-8 shrink-0 border-b border-border bg-secondary/50">
              <span className="text-[11px] font-semibold text-foreground flex-1">Watchlist</span>
              <button
                onClick={() => setIsEditingWatchlist((v) => !v)}
                className={cn(
                  "mr-2 transition-colors",
                  isEditingWatchlist ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
                title={isEditingWatchlist ? "Done editing" : "Edit watchlist"}
              >
                {isEditingWatchlist ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              </button>
              {/* Column headers */}
              <span className="font-mono text-[10px] text-muted-foreground w-[52px] text-right shrink-0">Last</span>
              <span className="font-mono text-[10px] text-muted-foreground w-[42px] text-right ml-1.5 shrink-0">Chg</span>
              <span className="font-mono text-[10px] text-muted-foreground w-[44px] text-right ml-1.5 shrink-0">Chg%</span>
            </div>

            {/* Scrollable watchlist sections */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <WatchlistSection
                title="Indices"
                items={watchlist.indices}
                selectedSymbol={symbol}
                isEditing={isEditingWatchlist}
                onSelect={handleSelectSymbol}
                onRemove={removeFromWatchlist}
                onAdd={(sym) => addToWatchlist("indices", sym)}
              />
              <WatchlistSection
                title="Stocks"
                items={watchlist.stocks}
                selectedSymbol={symbol}
                isEditing={isEditingWatchlist}
                onSelect={handleSelectSymbol}
                onRemove={removeFromWatchlist}
                onAdd={(sym) => addToWatchlist("stocks", sym)}
              />
              <WatchlistSection
                title="Crypto"
                items={watchlist.crypto}
                selectedSymbol={symbol}
                isEditing={isEditingWatchlist}
                onSelect={handleSelectSymbol}
                onRemove={removeFromWatchlist}
                onAdd={(sym) => addToWatchlist("crypto", sym)}
              />
              {(watchlist.custom.length > 0 || isEditingWatchlist) && (
                <WatchlistSection
                  title="Custom"
                  items={watchlist.custom}
                  selectedSymbol={symbol}
                  isEditing={isEditingWatchlist}
                  onSelect={handleSelectSymbol}
                  onRemove={removeFromWatchlist}
                  onAdd={(sym) => addToWatchlist("custom", sym)}
                />
              )}
            </div>

            {/* Symbol detail panel */}
            <SymbolDetail item={selectedItem} />
          </div>}
        </div>

        {/* ── Bottom status bar (24px) ──────────────────────────────────── */}
        <div className="shrink-0 flex items-center h-6 px-3 border-t border-border bg-secondary text-[11px] text-muted-foreground gap-3 z-10">
          <span>NextGenStock v1.0</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#26a69a]" />
            Connected
          </span>
          <div className="flex-1" />
          <DashboardUserStatus />
        </div>
      </div>

      {/* ── Mobile watchlist sheet ──────────────────────────────────────── */}
      <Sheet open={mobileWatchlistOpen} onOpenChange={setMobileWatchlistOpen}>
        <SheetContent side="right" className="w-[300px] p-0 md:hidden">
          <div className="flex flex-col h-full">
            <div className="flex items-center px-2 h-8 shrink-0 border-b border-border bg-secondary/50">
              <span className="text-[11px] font-semibold text-foreground flex-1">Watchlist</span>
              <button
                onClick={() => setIsEditingWatchlist((v) => !v)}
                className={cn(
                  "mr-2 transition-colors",
                  isEditingWatchlist ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isEditingWatchlist ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <WatchlistSection
                title="Indices" items={watchlist.indices} selectedSymbol={symbol}
                isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("indices", sym)}
              />
              <WatchlistSection
                title="Stocks" items={watchlist.stocks} selectedSymbol={symbol}
                isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("stocks", sym)}
              />
              <WatchlistSection
                title="Crypto" items={watchlist.crypto} selectedSymbol={symbol}
                isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("crypto", sym)}
              />
              {(watchlist.custom.length > 0 || isEditingWatchlist) && (
                <WatchlistSection
                  title="Custom" items={watchlist.custom} selectedSymbol={symbol}
                  isEditing={isEditingWatchlist} onSelect={(s) => { handleSelectSymbol(s); setMobileWatchlistOpen(false); }}
                  onRemove={removeFromWatchlist} onAdd={(sym) => addToWatchlist("custom", sym)}
                />
              )}
            </div>
            <SymbolDetail item={selectedItem} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
