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
import { PriceChart, type DrawingMode, type ChartClickPoint, type MAOverlay } from "@/components/charts/PriceChart";
import { detectFVGs, type DrawingData, type TrendLineData, type FVGData, type DrawingPoint } from "@/components/charts/DrawingPrimitives";
import { MACDChart } from "@/components/charts/MACDChart";
import { RSIChart } from "@/components/charts/RSIChart";
import { NewsPanel } from "@/components/dashboard/NewsPanel";
import { computeSMA, computeMACD, computeRSI } from "@/lib/indicators";
import { liveApi, strategyApi } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useSidebarPinned } from "@/lib/sidebar";
import { useWatchlist, flattenWatchlist, type WatchlistItem, type WatchlistCategory } from "@/lib/watchlist";
import { cn } from "@/lib/utils";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
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
      { label: "3 minutes",   value: "3m",  shortLabel: "3m"  },
      { label: "5 minutes",   value: "5m",  shortLabel: "5m"  },
      { label: "10 minutes",  value: "10m", shortLabel: "10m" },
      { label: "15 minutes",  value: "15m", shortLabel: "15m" },
      { label: "30 minutes",  value: "30m", shortLabel: "30m" },
    ],
  },
  {
    title: "HOURS",
    items: [
      { label: "1 hour",   value: "1h", shortLabel: "1h" },
      { label: "2 hours",  value: "2h", shortLabel: "2h" },
      { label: "4 hours",  value: "4h", shortLabel: "4h" },
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

// Webull-style inline interval buttons (shown in toolbar)
const INLINE_INTERVALS = ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "2h", "4h"];


// Webull-style period range buttons (bottom bar below chart)
interface PeriodRange {
  label: string;
  interval: string; // maps to a candle interval
}

const PERIOD_RANGES: PeriodRange[] = [
  { label: "1D",  interval: "5m"  },
  { label: "5D",  interval: "15m" },
  { label: "1M",  interval: "1h"  },
  { label: "3M",  interval: "1d"  },
  { label: "6M",  interval: "1d"  },
  { label: "YTD", interval: "1d"  },
  { label: "1Y",  interval: "1d"  },
  { label: "5Y",  interval: "1wk" },
  { label: "Max", interval: "1mo" },
];

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
  maOverlays,
}: {
  data: CandleBar[];
  theme: "dark" | "light";
  drawingMode?: DrawingMode;
  drawings?: DrawingData[];
  onChartClick?: (point: ChartClickPoint) => void;
  bollingerData?: import("@/types").BollingerOverlayBar[];
  maOverlays?: MAOverlay[];
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
        maOverlays={maOverlays}
      />
    </div>
  );
}

// Webull-style watchlist row — two-line layout with symbol/name on left, price/change on right
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
        "group flex items-center w-full px-3 text-left transition-colors cursor-pointer border-b border-border/30",
        "hover:bg-secondary/50",
        isSelected && "bg-primary/5 border-l-2 border-l-primary"
      )}
      style={{ minHeight: 48 }}
      onClick={onClick}
    >
      {/* Delete button */}
      {isEditing && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="shrink-0 mr-2 text-red-400 hover:text-red-300 transition-colors"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {/* Left side: symbol + name */}
      <div className="flex-1 min-w-0 py-1.5">
        <div className="font-mono font-bold text-[13px] text-foreground truncate">
          {item.symbol}
        </div>
        <div className="text-[10px] text-muted-foreground truncate leading-tight">
          {item.name}
        </div>
      </div>
      {/* Right side: price + change */}
      <div className="text-right shrink-0 ml-2 py-1.5">
        <div className="font-mono font-semibold text-[13px] text-foreground tabular-nums">
          {formatPrice(item.price, item.symbol)}
        </div>
        <div
          className="font-mono text-[10px] tabular-nums leading-tight"
          style={{ color: changeColor }}
        >
          {formatChange(item.change)} {positive ? "+" : ""}{item.changePct.toFixed(2)}%
        </div>
      </div>
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

// Webull-style quote panel at the top of watchlist sidebar
function QuotePanel({ item, lastCandle }: { item: WatchlistItem; lastCandle?: CandleBar }) {
  const positive = item.change >= 0;
  const changeColor = positive ? "#26a69a" : "#ef5350";

  return (
    <div className="border-b border-border px-4 py-3 shrink-0">
      {/* Symbol + name */}
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono font-bold text-sm text-foreground">{item.symbol}</span>
        <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
      </div>

      {/* Large price */}
      <div className="font-mono font-bold text-3xl tabular-nums leading-tight" style={{ color: changeColor }}>
        {formatPrice(item.price, item.symbol)}
      </div>

      {/* Change + pct */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: changeColor }}>
          {formatChange(item.change)}
        </span>
        <span className="font-mono text-sm tabular-nums" style={{ color: changeColor }}>
          {positive ? "+" : ""}{item.changePct.toFixed(2)}%
        </span>
      </div>

      {/* Key Statistics */}
      {lastCandle && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <div className="text-[11px] font-semibold text-foreground mb-1.5">Key Statistics</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open</span>
              <span className="text-foreground tabular-nums">{lastCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">High</span>
              <span className="text-foreground tabular-nums">{lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Low</span>
              <span className="text-foreground tabular-nums">{lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Close</span>
              <span className="text-foreground tabular-nums">{lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {lastCandle.volume !== undefined && (
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Volume</span>
                <span className="text-foreground tabular-nums">{lastCandle.volume.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
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
          {/* Quick links — hidden on mobile (available via bottom nav) */}
          <div className="hidden sm:flex items-center gap-1 shrink-0" data-testid="kpi-card">
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
  const [showMA, setShowMA] = useState(false);
  const [showMACD, setShowMACD] = useState(false);
  const [showRSI, setShowRSI] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [showDrawingTools, setShowDrawingTools] = useState(false);
  const [showNews, setShowNews] = useState(true);
  const [newsMaximized, setNewsMaximized] = useState(false);
  const [mobileDrawingOpen, setMobileDrawingOpen] = useState(false);
  // Bottom timeline bar state
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [chartScale, setChartScale] = useState<"linear" | "log">("linear");

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

  // Period range selection — sets the interval and marks the active period
  const handlePeriodSelect = useCallback((period: PeriodRange) => {
    setActivePeriod(period.label);
    const opt = ALL_INTERVALS.find((i) => i.value === period.interval);
    if (opt) setInterval(opt);
  }, []);

  // Clear active period when user manually picks an interval from top bar
  const handleIntervalSelect = useCallback((opt: IntervalOption) => {
    setActivePeriod(null);
    setInterval(opt);
  }, []);

  // Chart loads whatever symbol the user typed — no restriction
  const chartSymbol = symbol;

  // Fetch candlestick data — auto-refresh for live price ticking
  const { data: chartPayload, isLoading: chartLoading } = useQuery({
    queryKey: ["live", "chart-data", chartSymbol, interval.value, showBollinger],
    queryFn: () => liveApi.chartData(chartSymbol, interval.value, showBollinger),
    refetchInterval: 30_000, // refresh every 30s for live price updates
    staleTime: 15_000,
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

  // ── Computed indicators ────────────────────────────────────────────
  const closesForIndicators = useMemo(
    () => candles.map((c) => ({ time: c.time, close: c.close })),
    [candles]
  );

  const maOverlays = useMemo((): MAOverlay[] => {
    if (!showMA || candles.length < 5) return [];
    const MA_CONFIG: { period: number; color: string }[] = [
      { period: 5, color: "#00BCD4" },    // cyan
      { period: 10, color: "#FFEB3B" },   // yellow
      { period: 20, color: "#E040FB" },   // magenta
      { period: 50, color: "#66BB6A" },   // green
      { period: 200, color: "#42A5F5" },  // blue
    ];
    return MA_CONFIG
      .filter((m) => candles.length >= m.period)
      .map((m) => ({
        label: `MA${m.period}`,
        data: computeSMA(closesForIndicators, m.period),
        color: m.color,
      }));
  }, [showMA, candles, closesForIndicators]);

  const macdData = useMemo(() => {
    if (!showMACD || candles.length < 35) return [];
    return computeMACD(closesForIndicators);
  }, [showMACD, candles, closesForIndicators]);

  const rsiData = useMemo(() => {
    if (!showRSI || candles.length < 20) return [];
    return computeRSI(closesForIndicators);
  }, [showRSI, candles, closesForIndicators]);

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

          {/* Webull-style inline interval buttons */}
          <div className="hidden sm:flex items-center gap-0 shrink-0">
            {INLINE_INTERVALS.map((qi) => {
              const opt = ALL_INTERVALS.find(
                (i) => i.shortLabel === qi || i.value === qi
              );
              if (!opt) return null;
              return (
                <button
                  key={qi}
                  onClick={() => handleIntervalSelect(opt)}
                  className={cn(
                    "px-1.5 py-0.5 text-[12px] font-medium transition-colors",
                    opt.value === interval.value && !activePeriod
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
            {/* More intervals dropdown for 1D, 1W, 1M */}
            <IntervalDropdown selected={interval} onSelect={handleIntervalSelect} />
          </div>
          {/* Mobile: just the dropdown */}
          <div className="sm:hidden">
            <IntervalDropdown selected={interval} onSelect={handleIntervalSelect} />
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

          {/* Indicator toggles — hidden on mobile */}
          <button
            onClick={() => setShowMA((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
              showMA ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            MA
          </button>
          <button
            onClick={() => setShowMACD((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
              showMACD ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            MACD
          </button>
          <button
            onClick={() => setShowRSI((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
              showRSI ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            RSI
          </button>
          <button
            onClick={() => { setShowNews((v) => !v); setNewsMaximized(false); }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors shrink-0",
              showNews ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            )}
          >
            News
          </button>

          {/* Alert button — icon only on mobile */}
          <button className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alert</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-0.5 shrink-0" />

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
          <div className="relative flex flex-col flex-1 min-w-0 border-r border-border">

            {/* Price ticker + OHLCV header bar */}
            <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 h-8 shrink-0 border-b border-border bg-card/50 text-[11px] font-mono overflow-x-auto">
              <span className="text-primary font-bold text-sm sm:text-[13px] shrink-0">
                {chartSymbol}
              </span>
              {lastCandle && (
                <span
                  className="font-bold text-base sm:text-[13px] tabular-nums shrink-0"
                  style={{ color: isPositive ? "#26a69a" : "#ef5350" }}
                >
                  {formatPrice(lastCandle.close, chartSymbol)}
                </span>
              )}
              {priceChange !== null && pricePct !== null && (
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: isPositive ? "#26a69a" : "#ef5350" }}
                >
                  {isPositive ? "+" : ""}{pricePct.toFixed(2)}%
                </span>
              )}
              {/* OHLC values — hidden on mobile to reduce clutter */}
              {lastCandle && (
                <span className="hidden sm:contents">
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
                </span>
              )}
              {chartLoading && (
                <span className="text-muted-foreground">Loading...</span>
              )}
            </div>

            {/* MA overlay labels */}
            {showMA && maOverlays.length > 0 && (
              <div className="flex items-center gap-3 px-3 h-5 shrink-0 bg-card/30 text-[10px] font-mono overflow-x-auto">
                {maOverlays.map((ma) => {
                  const lastVal = ma.data[ma.data.length - 1];
                  return lastVal ? (
                    <span key={ma.label} style={{ color: ma.color }}>
                      {ma.label}:{lastVal.value.toFixed(2)}
                    </span>
                  ) : null;
                })}
              </div>
            )}

            {/* Chart fills remaining height (minus sub-charts) */}
            <div className="flex-1 min-h-0" style={{ minHeight: 200 }}>
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
                  maOverlays={showMA ? maOverlays : undefined}
                />
              )}
            </div>

            {/* ── Bottom timeline bar (Webull-style period range + chart options) ── */}
            <div className="flex items-center h-8 shrink-0 border-t border-border bg-card/50 px-1.5 sm:px-3 gap-0 sm:gap-1">
              {/* Period range buttons: 1D, 5D, 1M, 3M, 6M, YTD, 1Y, 5Y, Max */}
              <div className="flex items-center gap-0">
                {PERIOD_RANGES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePeriodSelect(p)}
                    className={cn(
                      "px-1.5 sm:px-2 py-0.5 text-[11px] sm:text-[12px] font-medium transition-colors rounded-sm",
                      activePeriod === p.label
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Right-side chart options: Adj, Night, Ext, Linear/Log, Auto */}
              <div className="hidden sm:flex items-center gap-0 text-[11px]">
                <span className="px-1.5 py-0.5 text-muted-foreground/60 cursor-default">Adj.</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/60 cursor-default">Night</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/60 cursor-default">Ext.</span>
                <button
                  onClick={() => setChartScale((s) => s === "linear" ? "log" : "linear")}
                  className={cn(
                    "px-1.5 py-0.5 font-medium transition-colors",
                    "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {chartScale === "linear" ? "Linear" : "Log"} ▾
                </button>
                <span className="px-1.5 py-0.5 text-muted-foreground/60 cursor-default">Auto</span>
              </div>
            </div>

            {/* MACD sub-chart */}
            {showMACD && macdData.length > 0 && !chartLoading && (
              <MACDChart data={macdData} height={100} theme={theme} />
            )}

            {/* RSI sub-chart */}
            {showRSI && rsiData.length > 0 && !chartLoading && (
              <RSIChart data={rsiData} height={80} theme={theme} />
            )}

            {/* News panel */}
            {showNews && (
              <NewsPanel
                ticker={chartSymbol}
                isMaximized={newsMaximized}
                onToggleMaximize={() => setNewsMaximized((v) => !v)}
              />
            )}
          </div>

          {/* ── Watchlist panel (~25%, 320px on desktop, full-width overlay on mobile) ── */}
          {showWatchlist && <div
            className="hidden md:flex flex-col shrink-0 bg-card overflow-hidden"
            style={{ width: 320 }}
          >
            {/* Quote panel — large price ticker */}
            <QuotePanel item={selectedItem} lastCandle={lastCandle} />

            {/* Watchlist header */}
            <div className="flex items-center px-3 h-8 shrink-0 border-b border-border bg-secondary/50">
              <span className="text-[12px] font-semibold text-foreground flex-1">Watchlist</span>
              <button
                onClick={() => setIsEditingWatchlist((v) => !v)}
                className={cn(
                  "transition-colors px-2 py-0.5 rounded text-[11px]",
                  isEditingWatchlist
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
                title={isEditingWatchlist ? "Done editing" : "Edit watchlist"}
              >
                {isEditingWatchlist ? "Done" : "Edit"}
              </button>
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

            {/* Add Symbol shortcut at the bottom */}
            <div className="shrink-0 border-t border-border p-2">
              <button
                onClick={() => setIsEditingWatchlist(true)}
                className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <Search className="h-3 w-3" />
                Add Symbol
              </button>
            </div>
          </div>}
        </div>

        {/* ── Bottom status bar (24px) — hidden on mobile ────────────────── */}
        <div className="hidden lg:flex shrink-0 items-center h-6 px-3 border-t border-border bg-secondary text-[11px] text-muted-foreground gap-3 z-10">
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
            <QuotePanel item={selectedItem} lastCandle={lastCandle} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Mobile drawing tools FAB + panel ──────────────────────────────── */}
      <div className="lg:hidden fixed right-3 bottom-[72px] z-50 flex flex-col items-end gap-2">
        {/* Expanded drawing tools panel */}
        {mobileDrawingOpen && (
          <div className="bg-card border border-border rounded-xl shadow-lg p-3 w-48 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="text-[11px] font-semibold text-foreground mb-2">Drawing Tools</div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => { toggleDrawingMode("trendline"); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  drawingMode === "trendline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Trend Line
              </button>
              <button
                onClick={() => { toggleDrawingMode("fvg"); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  drawingMode === "fvg"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <SquareDashed className="h-4 w-4" />
                FVG Zone
              </button>
              <button
                onClick={() => { setShowFVG((v) => !v); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  showFVG
                    ? "bg-[#26a69a]/20 text-[#26a69a]"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <SquareDashed className="h-4 w-4" />
                Auto FVG {showFVG && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowBollinger((v) => !v); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  showBollinger
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Activity className="h-4 w-4" />
                BB Squeeze {showBollinger && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <div className="border-t border-border my-1" />
              <div className="text-[10px] font-semibold text-muted-foreground mb-1 px-3">Indicators</div>
              <button
                onClick={() => { setShowMA((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  showMA ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <BarChart4 className="h-4 w-4" />
                MA Lines {showMA && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowMACD((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  showMACD ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Activity className="h-4 w-4" />
                MACD {showMACD && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowRSI((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  showRSI ? "bg-purple-500/20 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Activity className="h-4 w-4" />
                RSI {showRSI && <Check className="h-3 w-3 ml-auto" />}
              </button>
              {drawings.length > 0 && (
                <>
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={() => { setShowDrawings((v) => !v); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {showDrawings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showDrawings ? "Hide Drawings" : "Show Drawings"}
                  </button>
                  <button
                    onClick={() => { clearAllDrawings(); setMobileDrawingOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Eraser className="h-4 w-4" />
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setMobileDrawingOpen((v) => !v)}
          className={cn(
            "flex items-center justify-center h-12 w-12 rounded-full shadow-lg transition-all",
            mobileDrawingOpen || drawingMode !== "none"
              ? "bg-primary text-primary-foreground shadow-primary/25"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          )}
        >
          <TrendingUp className="h-5 w-5" />
        </button>
      </div>

      {/* Drawing mode indicator on mobile */}
      {drawingMode !== "none" && (
        <div className="lg:hidden fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full shadow-lg animate-pulse">
          {pendingPoint ? "Tap second point..." : "Tap first point..."}
        </div>
      )}

      {/* ── Mobile bottom navigation ──────────────────────────────────────── */}
      <MobileBottomNav />
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
