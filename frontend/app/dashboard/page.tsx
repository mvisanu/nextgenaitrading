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
import { useMarketStream, getSpread } from "@/lib/market-stream";
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

// ─── Animation styles ─────────────────────────────────────────────────────────

const TERMINAL_ANIM_STYLES = `
@keyframes flash-green {
  0%   { background-color: rgba(68,223,163,0.35); }
  60%  { background-color: rgba(68,223,163,0.15); }
  100% { background-color: transparent; }
}
@keyframes flash-red {
  0%   { background-color: rgba(239,68,68,0.35); }
  60%  { background-color: rgba(239,68,68,0.15); }
  100% { background-color: transparent; }
}
@keyframes tick-up {
  0%   { transform: translateY(6px); opacity: 0; }
  100% { transform: translateY(0);   opacity: 1; }
}
@keyframes tick-down {
  0%   { transform: translateY(-6px); opacity: 0; }
  100% { transform: translateY(0);    opacity: 1; }
}
@keyframes arrow-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}
@keyframes refresh-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}
.price-flash-green { animation: flash-green 1.2s ease-out forwards; }
.price-flash-red   { animation: flash-red   1.2s ease-out forwards; }
.price-tick-up     { animation: tick-up   0.25s ease-out forwards; }
.price-tick-down   { animation: tick-down 0.25s ease-out forwards; }
.arrow-pulse       { animation: arrow-pulse 1s ease-in-out 3; }
.refresh-pulse     { animation: refresh-pulse 0.6s ease-in-out infinite; }
`;

// ─── LiveClock ────────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    setTime(new Date());
    const id = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!time) return (
    <span className="font-mono text-[11px] text-primary tabular-nums shrink-0 select-none opacity-0">
      00:00:00
    </span>
  );

  const hh = time.getHours().toString().padStart(2, "0");
  const mm = time.getMinutes().toString().padStart(2, "0");
  const ss = time.getSeconds().toString().padStart(2, "0");

  return (
    <span className="font-mono text-[11px] text-primary tabular-nums shrink-0 select-none">
      {hh}:{mm}:{ss}
    </span>
  );
}

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
  scale,
}: {
  data: CandleBar[];
  theme: "dark" | "light";
  drawingMode?: DrawingMode;
  drawings?: DrawingData[];
  onChartClick?: (point: ChartClickPoint) => void;
  bollingerData?: import("@/types").BollingerOverlayBar[];
  maOverlays?: MAOverlay[];
  scale?: "linear" | "log";
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
        scale={scale}
      />
    </div>
  );
}

// ─── Sovereign Terminal Watchlist Row ────────────────────────────────────────
// Two-column layout: symbol + price on left, change % on right.
// Active row gets green left-border accent per Sovereign Terminal spec.
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
  const prevPriceRef = useRef<number>(item.price);
  const [arrowClass, setArrowClass] = useState<"up" | "down" | null>(null);
  const arrowTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevPriceRef.current;
    if (prev !== item.price) {
      // Clear any running timer
      if (arrowTimerRef.current) window.clearTimeout(arrowTimerRef.current);
      setArrowClass(item.price > prev ? "up" : "down");
      arrowTimerRef.current = window.setTimeout(() => setArrowClass(null), 2000);
      prevPriceRef.current = item.price;
    }
    return () => {
      if (arrowTimerRef.current) window.clearTimeout(arrowTimerRef.current);
    };
  }, [item.price]);

  return (
    <tr
      className={cn(
        "cursor-pointer transition-colors",
        isSelected
          ? "bg-surface-high/40 border-l-2 border-primary"
          : "hover:bg-surface-high/20 border-l-2 border-transparent"
      )}
      onClick={onClick}
    >
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="shrink-0 text-destructive hover:text-destructive/70 transition-colors"
              title="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <div>
            <div className="font-bold text-xs text-foreground tabular-nums">{item.symbol}</div>
            <div className="text-3xs text-muted-foreground uppercase tracking-widest truncate max-w-[80px]">{item.name}</div>
          </div>
        </div>
      </td>
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {arrowClass && (
            <span
              className={cn(
                "text-[10px] leading-none arrow-pulse",
                arrowClass === "up" ? "text-primary" : "text-destructive"
              )}
            >
              {arrowClass === "up" ? "↑" : "↓"}
            </span>
          )}
          <span className="text-xs tabular-nums text-foreground font-medium">{formatPrice(item.price, item.symbol)}</span>
        </div>
        <div className={cn("text-3xs tabular-nums font-medium", positive ? "text-primary" : "text-destructive")}>
          {positive ? "+" : ""}{item.changePct.toFixed(2)}%
        </div>
      </td>
    </tr>
  );
}

// ─── Sovereign Terminal Watchlist Section ────────────────────────────────────
// Renders as table rows (tr) so it can be embedded inside a <tbody>.
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
    <>
      {/* Section header row */}
      <tr className="bg-surface-lowest/60">
        <td colSpan={2} className="px-2 py-1.5">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center flex-1 gap-1"
            >
              {open ? (
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                {title}
              </span>
              <span className="text-3xs text-muted-foreground/50 ml-1">{items.length}</span>
            </button>
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
        </td>
      </tr>

      {/* Add input row */}
      {open && showAddInput && (
        <tr className="bg-surface-lowest">
          <td colSpan={2} className="px-2 py-1">
            <div className="flex items-center gap-1">
              <input
                ref={addInputRef}
                value={addValue}
                onChange={(e) => setAddValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddSubmit();
                  if (e.key === "Escape") { setShowAddInput(false); setAddValue(""); }
                }}
                placeholder="AAPL, BTC-USD..."
                className="flex-1 bg-surface-mid border border-border/10 px-1.5 py-0.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50 rounded-sm"
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
          </td>
        </tr>
      )}

      {/* Item rows */}
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
    </>
  );
}

// ─── Sovereign Terminal Quote Panel ──────────────────────────────────────────
// Shows the selected instrument's large price + OHLCV statistics.
function QuotePanel({ item, lastCandle }: { item: WatchlistItem; lastCandle?: CandleBar }) {
  const positive = item.change >= 0;

  return (
    <div className="border-b border-border/10 px-4 py-3 shrink-0 bg-surface-lowest">
      {/* Symbol + name */}
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="font-bold text-sm text-foreground tracking-tight">{item.symbol}</span>
        <span className="text-3xs text-muted-foreground uppercase tracking-widest truncate">{item.name}</span>
      </div>

      {/* Large price */}
      <div className={cn("font-bold text-2xl tabular-nums leading-tight", positive ? "text-primary" : "text-destructive")}>
        {formatPrice(item.price, item.symbol)}
      </div>

      {/* Change + pct */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className={cn("text-xs tabular-nums font-semibold", positive ? "text-primary" : "text-destructive")}>
          {formatChange(item.change)}
        </span>
        <span className={cn("text-xs tabular-nums", positive ? "text-primary" : "text-destructive")}>
          {positive ? "+" : ""}{item.changePct.toFixed(2)}%
        </span>
      </div>

      {/* Key Statistics */}
      {lastCandle && (
        <div className="mt-3 pt-2 border-t border-border/10">
          <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">Statistics</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-3xs text-muted-foreground uppercase tracking-widest">Open</span>
              <span className="text-2xs text-foreground tabular-nums font-medium">{lastCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-3xs text-muted-foreground uppercase tracking-widest">High</span>
              <span className="text-2xs text-foreground tabular-nums font-medium">{lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-3xs text-muted-foreground uppercase tracking-widest">Low</span>
              <span className="text-2xs text-foreground tabular-nums font-medium">{lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-3xs text-muted-foreground uppercase tracking-widest">Close</span>
              <span className="text-2xs text-foreground tabular-nums font-medium">{lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            {lastCandle.volume !== undefined && (
              <div className="flex justify-between col-span-2">
                <span className="text-3xs text-muted-foreground uppercase tracking-widest">Volume</span>
                <span className="text-2xs text-foreground tabular-nums font-medium">{lastCandle.volume.toLocaleString()}</span>
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
          "flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium transition-colors rounded-sm",
          isOpen
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
        )}
      >
        <ChevronDown className="h-3 w-3" />
        {selected.shortLabel}
      </button>

      {isOpen && (
        <div className="absolute top-8 left-0 z-50 w-[180px] max-h-[380px] overflow-y-auto rounded-sm border border-border/15 bg-surface-highest shadow-lg">
          {INTERVAL_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 py-1.5 border-b border-border/10">
                <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
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
                    "flex items-center w-full px-3 py-1.5 text-left text-xs hover:bg-surface-high transition-colors",
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

  const filtered = useMemo(() => {
    const allSymbols = [
      ...new Set([
        ...POPULAR_SYMBOLS,
        ...watchlistItems.map((i) => i.symbol),
      ]),
    ];
    if (!query.trim()) return POPULAR_SYMBOLS.slice(0, 12);
    const q = query.trim().toUpperCase();
    const matches = allSymbols.filter((s) =>
      s.toUpperCase().includes(q)
    );
    matches.sort((a, b) => {
      const au = a.toUpperCase(), bu = b.toUpperCase();
      if (au === q) return -1;
      if (bu === q) return 1;
      const aStarts = au.startsWith(q);
      const bStarts = bu.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.length - b.length;
    });
    if (q.length >= 1 && !matches.some((s) => s.toUpperCase() === q)) {
      matches.unshift(q);
    }
    return matches.slice(0, 12);
  }, [query, watchlistItems]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        <div className="flex items-center gap-1 bg-surface-lowest border border-primary/40 rounded-sm px-1.5 py-0.5">
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
            className="bg-transparent text-xs font-mono text-foreground outline-none w-[180px] placeholder:text-primary/40"
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
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-surface-low border border-border/10 text-xs font-mono font-bold text-foreground hover:border-primary/30 transition-colors"
        >
          <Search className="h-3 w-3 text-muted-foreground" />
          {currentSymbol}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-8 left-0 z-50 w-[240px] max-h-[320px] overflow-y-auto rounded-sm border border-border/15 bg-surface-highest shadow-lg">
          <div className="px-3 py-1.5 border-b border-border/10">
            <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
              {query.trim() ? "Search Results" : "Popular Symbols"}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-2xs text-muted-foreground mb-2">
                No matches — press Enter to load &quot;{query.toUpperCase()}&quot;
              </p>
              <button
                onClick={() => handleSubmit()}
                className="text-2xs text-primary hover:underline"
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
                    "flex items-center w-full px-3 py-1.5 text-left hover:bg-surface-high transition-colors",
                    sym === currentSymbol && "bg-primary/5"
                  )}
                >
                  <span className="font-mono font-bold text-xs text-foreground w-[70px]">
                    {sym}
                  </span>
                  {watchItem && (
                    <span className="text-3xs text-muted-foreground uppercase tracking-widest truncate">
                      {watchItem.name}
                    </span>
                  )}
                </button>
              );
            })
          )}
          <div className="px-3 py-2 border-t border-border/10">
            <p className="text-3xs text-muted-foreground uppercase tracking-widest">
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
    staleTime: 300_000,  // 5 minutes — strategy run counts don't need frequent refresh
  });

  const totalRuns = runs.length;
  const lastRun = runs[0];
  const winningRuns = runs.filter(
    (r) => r.current_signal === "BUY"
  ).length;

  return (
    <div className="shrink-0 border-b border-border/10 bg-surface-low">
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
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Runs</span>
            <span className="text-xs font-semibold text-foreground tabular-nums">{totalRuns}</span>
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Buy</span>
            <span className="text-xs font-semibold text-primary tabular-nums">{winningRuns}</span>
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          <div className="flex items-center gap-1.5 shrink-0" data-testid="kpi-card">
            <span className="text-3xs text-muted-foreground uppercase tracking-widest">Last</span>
            <span className="text-xs font-semibold text-foreground font-mono tabular-nums">{lastRun?.symbol ?? "\u2014"}</span>
            {lastRun?.current_signal && (
              <span className={cn("text-xs font-semibold", lastRun.current_signal === "BUY" ? "text-primary" : lastRun.current_signal === "SELL" ? "text-destructive" : "text-muted-foreground")}>
                {lastRun.current_signal}
              </span>
            )}
          </div>
          <div className="w-px h-3 bg-border/10 shrink-0" />
          {/* Quick links — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-1 shrink-0" data-testid="kpi-card">
            <Link href="/strategies" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <TrendingUp className="h-3 w-3" />
              Strategies
            </Link>
            <Link href="/screener" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <BarChart4 className="h-3 w-3" />
              Screener
            </Link>
            <Link href="/opportunities" className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-primary hover:bg-surface-mid transition-colors">
              <Crosshair className="h-3 w-3" />
              Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* Expandable recent runs table */}
      {expanded && (
        <div className="px-3 pb-2" data-testid="recent-runs">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Recent Strategy Runs</h2>
          {runs.length === 0 ? (
            <p className="text-2xs text-muted-foreground">No strategy runs yet. <Link href="/strategies" className="text-primary hover:underline">Run a strategy</Link> to see results here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/10">
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Symbol</th>
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Mode</th>
                    <th className="text-left pb-0.5 pr-3 text-3xs uppercase tracking-widest font-bold">Timeframe</th>
                    <th className="text-left pb-0.5 text-3xs uppercase tracking-widest font-bold">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.slice(0, 5).map((r) => (
                    <tr key={r.id} className="hover:bg-surface-high/30 transition-colors">
                      <td className="pr-3 py-0.5 font-mono font-bold text-foreground">{r.symbol}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.mode_name}</td>
                      <td className="pr-3 py-0.5 text-muted-foreground">{r.timeframe}</td>
                      <td className="py-0.5">
                        <span className={r.current_signal === "BUY" ? "text-primary" : r.current_signal === "SELL" ? "text-destructive" : "text-muted-foreground"}>
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
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const initialTicker = searchParams.get("ticker")?.toUpperCase().trim() || "BTC-USD";
  const [symbol, setSymbol] = useState(initialTicker);
  const [interval, setInterval] = useState<IntervalOption>(DEFAULT_INTERVAL);

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
  const [activePeriod, setActivePeriod] = useState<string | null>(null);
  const [chartScale, setChartScale] = useState<"linear" | "log">("linear");

  const DRAWING_STORAGE_KEY = "ngs-drawings";

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAWING_STORAGE_KEY);
      if (raw) setDrawings(JSON.parse(raw));
    } catch {}
  }, []);

  const saveDrawings = useCallback((d: DrawingData[]) => {
    setDrawings(d);
    try { localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(d)); } catch {}
  }, []);

  const handleChartClick = useCallback((point: ChartClickPoint) => {
    if (drawingMode === "trendline") {
      if (!pendingPoint) {
        setPendingPoint({ time: point.time, price: point.price });
      } else {
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

  const handlePeriodSelect = useCallback((period: PeriodRange) => {
    setActivePeriod(period.label);
    const opt = ALL_INTERVALS.find((i) => i.value === period.interval);
    if (opt) setInterval(opt);
  }, []);

  const handleIntervalSelect = useCallback((opt: IntervalOption) => {
    setActivePeriod(null);
    setInterval(opt);
  }, []);

  const chartSymbol = symbol;

  const { data: chartPayload } = useQuery({
    queryKey: ["live", "chart-data", chartSymbol, interval.value, showBollinger],
    queryFn: () => liveApi.chartData(chartSymbol, interval.value, showBollinger),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: !!user,
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

  const autoFVGs = useMemo(() => {
    if (!showFVG || candles.length < 3) return [];
    return detectFVGs(candles);
  }, [showFVG, candles]);

  const allDrawings = useMemo(() => {
    if (!showDrawings) return autoFVGs;
    return [...drawings, ...autoFVGs];
  }, [drawings, autoFVGs, showDrawings]);

  const closesForIndicators = useMemo(
    () => candles.map((c) => ({ time: c.time, close: c.close })),
    [candles]
  );

  const maOverlays = useMemo((): MAOverlay[] => {
    if (!showMA || candles.length < 5) return [];
    const MA_CONFIG: { period: number; color: string }[] = [
      { period: 5, color: "#00BCD4" },
      { period: 10, color: "#FFEB3B" },
      { period: 20, color: "#E040FB" },
      { period: 50, color: "#66BB6A" },
      { period: 200, color: "#42A5F5" },
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

  // ── Live watchlist price polling (30s interval, same cycle as chart) ────
  const watchlistSymbols = useMemo(
    () => flattenWatchlist(watchlist).map((i) => i.symbol),
    [watchlist]
  );

  const { data: liveWatchlistPrices } = useQuery({
    queryKey: ["watchlist-live-prices", watchlistSymbols],
    queryFn: async () => {
      // Single batch call instead of N concurrent chart-data fetches.
      const raw = await liveApi.watchlistPrices(watchlistSymbols);
      const prices: Record<string, { close: number; change: number; changePct: number }> = {};
      for (const [sym, data] of Object.entries(raw)) {
        prices[sym] = {
          close: data.price,
          change: data.change,
          changePct: data.changePercent,
        };
      }
      return prices;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: watchlistSymbols.length > 0 && !!user,
  });

  // ── Real-time quote streaming (Alpaca WebSocket → SSE) ──────────────────
  // Only subscribes to plain US equity/ETF symbols (Alpaca-supported).
  // Falls back silently to the 30s polling data when stream is unavailable.
  const streamSymbols = useMemo(
    () => watchlistSymbols.filter((s) => /^[A-Z]{1,5}$/.test(s)).slice(0, 10),
    [watchlistSymbols]
  );
  const { quotes: streamQuotes, status: streamStatus } = useMarketStream(
    user ? streamSymbols : []
  );

  // Merge live prices into watchlist items for display (does not touch localStorage)
  // Stream data (bid/ask/last) takes priority over REST polling close price.
  const allItems = useMemo(() => {
    const base = flattenWatchlist(watchlist);
    if (!liveWatchlistPrices && !Object.keys(streamQuotes).length) return base;
    return base.map((item) => {
      const stream = streamQuotes[item.symbol];
      const poll = liveWatchlistPrices?.[item.symbol];
      // Prefer streaming last price, fall back to polling close
      const price = stream?.last ?? poll?.close ?? item.price;
      const change = poll?.change ?? item.change;
      const changePct = poll?.changePct ?? item.changePct;
      if (!stream && !poll) return item;
      return {
        ...item,
        price,
        change,
        changePct,
        color: (change ?? 0) >= 0 ? "#26a69a" : "#ef5350",
      };
    });
  }, [watchlist, liveWatchlistPrices, streamQuotes]);

  const selectedItem = allItems.find((i) => i.symbol === symbol) ?? allItems[0];

  const handleSelectSymbol = useCallback((s: string) => {
    setSymbol(s);
  }, []);

  // ── Price flash ─────────────────────────────────────────────────────────
  const prevPriceRef = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"green" | "red" | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  // Key to force CSS animation restart on each data refresh
  const [priceTickKey, setPriceTickKey] = useState(0);

  useEffect(() => {
    if (!lastCandle) return;
    const current = lastCandle.close;
    const prev = prevPriceRef.current;
    if (prev !== null && prev !== current) {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      setPriceFlash(current > prev ? "green" : "red");
      setPriceTickKey((k) => k + 1);
      flashTimerRef.current = window.setTimeout(() => setPriceFlash(null), 1400);
    }
    prevPriceRef.current = current;
    return () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, [lastCandle]);

  // ── Countdown to next chart refresh ─────────────────────────────────────
  const [countdown, setCountdown] = useState(30);
  const countdownStartRef = useRef<number>(Date.now());

  useEffect(() => {
    // Reset countdown each time chart data arrives
    countdownStartRef.current = Date.now();
    setCountdown(30);
  }, [chartPayload]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - countdownStartRef.current) / 1000);
      const remaining = Math.max(0, 30 - elapsed);
      setCountdown(remaining);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // ─── JSX ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-surface-lowest">
      {/* Terminal animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: TERMINAL_ANIM_STYLES }} />

      {/* Page title — 1px visible for Playwright */}
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

      {/* ── Main content area ───────────────────────────────────────────── */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden transition-[padding] duration-200 ${sidebarPinned ? "lg:pl-[200px]" : "lg:pl-12"}`}>

        {/* ── Top toolbar (40px) — Sovereign Terminal header ────────────── */}
        <header className="flex h-10 shrink-0 items-center border-b border-border/10 bg-surface-low px-2 gap-1 z-20 overflow-x-auto">
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
          <div className="w-px h-5 bg-border/10 mx-0.5 shrink-0" />

          {/* Inline interval buttons */}
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
                    "px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                    opt.value === interval.value && !activePeriod
                      ? "text-primary font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
            <IntervalDropdown selected={interval} onSelect={handleIntervalSelect} />
          </div>
          {/* Mobile: just the dropdown */}
          <div className="sm:hidden">
            <IntervalDropdown selected={interval} onSelect={handleIntervalSelect} />
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-border/10 mx-0.5 shrink-0" />

          {/* Indicator toggles */}
          <button
            onClick={() => setShowMA((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
              showMA ? "bg-cyan-500/15 text-cyan-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
            )}
          >
            MA
          </button>
          <button
            onClick={() => setShowMACD((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
              showMACD ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
            )}
          >
            MACD
          </button>
          <button
            onClick={() => setShowRSI((v) => !v)}
            className={cn(
              "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
              showRSI ? "bg-purple-500/15 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
            )}
          >
            RSI
          </button>
          <button
            onClick={() => { setShowNews((v) => !v); setNewsMaximized(false); }}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
              showNews ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
            )}
          >
            News
          </button>

          {/* Alert button */}
          <button className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-sm text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-mid transition-colors shrink-0">
            <Bell className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alert</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-border/10 mx-0.5 shrink-0" />

          {/* Drawing tools toggle */}
          <button
            onClick={() => setShowDrawingTools((v) => !v)}
            title="Drawing tools"
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
              showDrawingTools || drawingMode !== "none"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
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
                  "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
                  drawingMode === "trendline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Trend Line</span>
              </button>

              <button
                onClick={() => toggleDrawingMode("fvg")}
                title="Draw Fair Value Gap zone (click two corners)"
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
                  drawingMode === "fvg"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                )}
              >
                <SquareDashed className="h-3.5 w-3.5" />
                <span>FVG</span>
              </button>

              <button
                onClick={() => setShowFVG((v) => !v)}
                title={showFVG ? "Hide auto-detected FVGs" : "Show auto-detected FVGs"}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
                  showFVG
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                )}
              >
                <SquareDashed className="h-3.5 w-3.5" />
                <span>Auto FVG</span>
              </button>

              <button
                onClick={() => setShowBollinger((v) => !v)}
                title={showBollinger ? "Hide Bollinger Bands" : "Show Bollinger Band Squeeze"}
                className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-medium transition-colors shrink-0",
                  showBollinger
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
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
                      "flex items-center justify-center h-7 w-7 rounded-sm transition-colors shrink-0",
                      showDrawings
                        ? "text-primary hover:bg-surface-mid"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                    )}
                  >
                    {showDrawings ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={clearAllDrawings}
                    title="Clear all drawings"
                    className="flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-destructive hover:bg-surface-mid transition-colors shrink-0"
                  >
                    <Eraser className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </>
          )}

          {/* Drawing mode status */}
          {drawingMode !== "none" && (
            <span className="text-3xs text-primary font-bold uppercase tracking-widest animate-pulse shrink-0">
              {pendingPoint ? "Click 2nd point" : "Click 1st point"}
            </span>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Live clock */}
          <LiveClock />

          {/* Divider */}
          <div className="w-px h-5 bg-border/10 mx-0.5 shrink-0" />

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-mid transition-colors shrink-0"
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
            className="hidden md:flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-mid transition-colors shrink-0"
          >
            {showWatchlist ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>

          {/* Watchlist toggle — mobile */}
          <button
            onClick={() => setMobileWatchlistOpen(true)}
            title="Watchlist"
            className="md:hidden flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-mid transition-colors shrink-0"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>

          {/* Settings */}
          <button
            title="Settings"
            className="flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-mid transition-colors shrink-0"
          >
            <Settings className="h-4 w-4" />
          </button>
        </header>

        {/* ── KPI cards + recent runs ───────────────────────────────────── */}
        <KpiCardsPanel />

        {/* ── Main content (chart + watchlist) ─────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Chart panel ───────────────────────────────────────────── */}
          <div className="relative flex flex-col flex-1 min-w-0 border-r border-border/10">

            {/* Price ticker + OHLCV header bar */}
            <div
              className={cn(
                "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 h-8 shrink-0 border-b border-border/10 bg-surface-low text-[11px] font-mono overflow-x-auto",
                priceFlash === "green" && "price-flash-green",
                priceFlash === "red"   && "price-flash-red"
              )}
            >
              {/* Blinking LIVE indicator */}
              <span className="flex items-center gap-1 shrink-0">
                <span className="text-primary animate-pulse text-[10px] leading-none">●</span>
                <span className="text-3xs text-primary/70 font-bold uppercase tracking-widest">LIVE</span>
              </span>

              <span className="text-primary font-bold text-sm sm:text-[13px] shrink-0 tracking-tight">
                {chartSymbol}
              </span>
              {lastCandle && (
                <span
                  key={priceTickKey}
                  className={cn(
                    "font-bold text-base sm:text-[13px] tabular-nums shrink-0",
                    priceFlash === "green" ? "price-tick-up" : priceFlash === "red" ? "price-tick-down" : ""
                  )}
                  style={{ color: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                >
                  {formatPrice(lastCandle.close, chartSymbol)}
                </span>
              )}
              {priceChange !== null && pricePct !== null && (
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ color: isPositive ? "hsl(var(--primary))" : "hsl(var(--destructive))" }}
                >
                  {isPositive ? "+" : ""}{pricePct.toFixed(2)}%
                </span>
              )}
              {/* OHLC values — hidden on mobile */}
              {lastCandle && (
                <span className="hidden sm:contents text-3xs">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    O&nbsp;<span className="text-foreground tabular-nums">{lastCandle.open.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    H&nbsp;<span className="text-foreground tabular-nums">{lastCandle.high.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    L&nbsp;<span className="text-foreground tabular-nums">{lastCandle.low.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    C&nbsp;<span className="text-foreground tabular-nums">{lastCandle.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                </span>
              )}
              {/* Bid / Ask from stream (Alpaca supported symbols only) */}
              {streamStatus === "live" && streamQuotes[chartSymbol] && (
                <span className="hidden sm:contents text-3xs">
                  <span className="text-muted-foreground uppercase tracking-widest">
                    B&nbsp;<span className="text-[#26a69a] tabular-nums">
                      {streamQuotes[chartSymbol]?.bid?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground uppercase tracking-widest">
                    A&nbsp;<span className="text-[#ef5350] tabular-nums">
                      {streamQuotes[chartSymbol]?.ask?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                  {(() => {
                    const spread = getSpread(streamQuotes[chartSymbol]);
                    return spread != null ? (
                      <span className="text-muted-foreground uppercase tracking-widest">
                        Spd&nbsp;<span className="text-foreground/70 tabular-nums">{spread.toFixed(2)}</span>
                      </span>
                    ) : null;
                  })()}
                </span>
              )}
              {candles.length === 0 && (
                <span className="text-3xs text-muted-foreground uppercase tracking-widest">Loading...</span>
              )}
            </div>

            {/* MA overlay labels */}
            {showMA && maOverlays.length > 0 && (
              <div className="flex items-center gap-3 px-3 h-5 shrink-0 bg-surface-lowest/80 text-3xs font-mono overflow-x-auto">
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

            {/* Chart fills remaining height */}
            <div className="flex-1 min-h-0 bg-surface-lowest" style={{ minHeight: 200 }}>
              {candles.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <span className="text-3xs text-muted-foreground uppercase tracking-widest animate-pulse">Loading chart data...</span>
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
                  scale={chartScale}
                />
              )}
            </div>

            {/* ── Bottom timeline bar (period range + chart options) ─── */}
            <div className="flex items-center h-8 shrink-0 border-t border-border/10 bg-surface-low px-1.5 sm:px-3 gap-0 sm:gap-1">
              {/* Period range buttons */}
              <div className="flex items-center gap-0">
                {PERIOD_RANGES.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => handlePeriodSelect(p)}
                    className={cn(
                      "px-1.5 sm:px-2 py-0.5 text-[11px] font-medium transition-colors",
                      activePeriod === p.label
                        ? "text-primary font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Right chart options */}
              <div className="hidden sm:flex items-center gap-0 text-[11px]">
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Adj</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Night</span>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Ext</span>
                <button
                  onClick={() => setChartScale((s) => s === "linear" ? "log" : "linear")}
                  className="px-1.5 py-0.5 text-3xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                >
                  {chartScale === "linear" ? "Linear" : "Log"} ▾
                </button>
                <span className="px-1.5 py-0.5 text-muted-foreground/40 cursor-default text-3xs uppercase tracking-widest">Auto</span>
              </div>
            </div>

            {/* ── Terminal refresh status bar ────────────────────────── */}
            <div className="shrink-0 bg-surface-lowest border-t border-border/5">
              {/* Label row */}
              <div className="flex items-center justify-between px-3 pt-1 pb-0.5">
                <span className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">
                  NEXT REFRESH
                </span>
                <span
                  className={cn(
                    "text-sm font-black font-mono tabular-nums leading-none",
                    countdown <= 3 ? "text-amber-400 refresh-pulse" : "text-primary"
                  )}
                >
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                </span>
              </div>
              {/* Animated progress bar */}
              <div className="h-[3px] w-full bg-surface-mid relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full"
                  style={{
                    width: `${(countdown / 30) * 100}%`,
                    backgroundColor: countdown <= 3 ? "#f59e0b" : "#44DFA3",
                    boxShadow: countdown <= 3
                      ? "0 0 8px #f59e0baa"
                      : "0 0 8px #44DFA3aa",
                    transition: "width 1s linear, background-color 0.3s ease, box-shadow 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* MACD sub-chart */}
            {showMACD && macdData.length > 0 && candles.length > 0 && (
              <MACDChart data={macdData} height={100} theme={theme} />
            )}

            {/* RSI sub-chart */}
            {showRSI && rsiData.length > 0 && candles.length > 0 && (
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

          {/* ── Watchlist panel (320px desktop) ──────────────────────── */}
          {showWatchlist && (
            <div
              className="hidden md:flex flex-col shrink-0 bg-surface-low overflow-hidden border-l border-border/10"
              style={{ width: 320 }}
            >
              {/* Quote panel — selected symbol large price */}
              {selectedItem && <QuotePanel item={selectedItem} lastCandle={lastCandle} />}

              {/* Watchlist header */}
              <div className="flex items-center px-3 h-8 shrink-0 border-b border-border/10 bg-surface-lowest/60">
                <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex-1">Watchlist</span>
                {/* Stream connection status badge */}
                <span
                  title={`Stream: ${streamStatus}`}
                  className={cn(
                    "text-[9px] font-bold uppercase tracking-widest mr-2 px-1.5 py-0.5 rounded-sm",
                    streamStatus === "live"
                      ? "text-[#44DFA3] bg-[#44DFA3]/10"
                      : streamStatus === "yfinance_fallback"
                      ? "text-orange-400 bg-orange-400/10"
                      : streamStatus === "connecting" || streamStatus === "reconnecting"
                      ? "text-yellow-400 bg-yellow-400/10 animate-pulse"
                      : streamStatus === "unconfigured"
                      ? "hidden"
                      : "text-muted-foreground bg-surface-mid"
                  )}
                >
                  {streamStatus === "live"
                    ? "● LIVE"
                    : streamStatus === "yfinance_fallback"
                    ? "◐ yfinance"
                    : streamStatus === "connecting"
                    ? "○ connecting"
                    : streamStatus === "reconnecting"
                    ? "○ reconnecting"
                    : streamStatus === "error"
                    ? "○ error"
                    : null}
                </span>
                <button
                  onClick={() => setIsEditingWatchlist((v) => !v)}
                  className={cn(
                    "transition-colors px-2 py-0.5 rounded-sm text-3xs uppercase tracking-widest font-bold",
                    isEditingWatchlist
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-mid"
                  )}
                  title={isEditingWatchlist ? "Done editing" : "Edit watchlist"}
                >
                  {isEditingWatchlist ? "Done" : "Edit"}
                </button>
              </div>

              {/* Scrollable watchlist — rendered as a table for alignment */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-lowest/40">
                      <th className="px-2 py-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground">Symbol</th>
                      <th className="px-2 py-1.5 text-3xs font-bold uppercase tracking-widest text-muted-foreground text-right">Price / Chg%</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
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
                  </tbody>
                </table>
              </div>

              {/* Add Symbol shortcut */}
              <div className="shrink-0 border-t border-border/10 p-2 bg-surface-lowest/60">
                <button
                  onClick={() => setIsEditingWatchlist(true)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-sm text-3xs text-muted-foreground uppercase tracking-widest hover:text-foreground hover:bg-surface-mid transition-colors"
                >
                  <Search className="h-3 w-3" />
                  Add Symbol
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom status bar — Sovereign Terminal footer ─────────────── */}
        <div className="hidden lg:flex shrink-0 items-center h-6 px-3 border-t border-border/10 bg-surface-lowest text-3xs text-muted-foreground uppercase tracking-widest gap-3 z-10">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 bg-primary shadow-[0_0_6px_theme(colors.primary.DEFAULT)]" />
            Market Open
          </span>
          <span className="text-border/20">|</span>
          <span>NextGenStock v1.0</span>
          <div className="flex-1" />
          <DashboardUserStatus />
        </div>
      </div>

      {/* ── Mobile watchlist sheet ──────────────────────────────────────── */}
      <Sheet open={mobileWatchlistOpen} onOpenChange={setMobileWatchlistOpen}>
        <SheetContent side="right" className="w-[300px] p-0 md:hidden">
          <div className="flex flex-col h-full bg-surface-low">
            <div className="flex items-center px-3 h-8 shrink-0 border-b border-border/10 bg-surface-lowest/60">
              <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex-1">Watchlist</span>
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
              <table className="w-full text-left border-collapse tabular-nums">
                <tbody>
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
                </tbody>
              </table>
            </div>
            {selectedItem && <QuotePanel item={selectedItem} lastCandle={lastCandle} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Mobile drawing tools FAB + panel ──────────────────────────── */}
      <div className="lg:hidden fixed right-3 bottom-[72px] z-50 flex flex-col items-end gap-2">
        {/* Expanded drawing tools panel */}
        {mobileDrawingOpen && (
          <div className="bg-surface-highest border border-border/15 rounded-sm shadow-lg p-3 w-48 animate-in slide-in-from-bottom-2 fade-in duration-200">
            <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-2">Drawing Tools</div>
            <div className="flex flex-col gap-0.5">
              <button
                onClick={() => { toggleDrawingMode("trendline"); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  drawingMode === "trendline"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Trend Line
              </button>
              <button
                onClick={() => { toggleDrawingMode("fvg"); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  drawingMode === "fvg"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <SquareDashed className="h-4 w-4" />
                FVG Zone
              </button>
              <button
                onClick={() => { setShowFVG((v) => !v); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  showFVG
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <SquareDashed className="h-4 w-4" />
                Auto FVG {showFVG && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowBollinger((v) => !v); setMobileDrawingOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  showBollinger
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <Activity className="h-4 w-4" />
                BB Squeeze {showBollinger && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <div className="border-t border-border/10 my-1" />
              <div className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-1 px-3">Indicators</div>
              <button
                onClick={() => { setShowMA((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  showMA ? "bg-cyan-500/15 text-cyan-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <BarChart4 className="h-4 w-4" />
                MA Lines {showMA && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowMACD((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  showMACD ? "bg-blue-500/15 text-blue-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <Activity className="h-4 w-4" />
                MACD {showMACD && <Check className="h-3 w-3 ml-auto" />}
              </button>
              <button
                onClick={() => { setShowRSI((v) => !v); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-colors",
                  showRSI ? "bg-purple-500/15 text-purple-400" : "text-muted-foreground hover:text-foreground hover:bg-surface-high"
                )}
              >
                <Activity className="h-4 w-4" />
                RSI {showRSI && <Check className="h-3 w-3 ml-auto" />}
              </button>
              {drawings.length > 0 && (
                <>
                  <div className="border-t border-border/10 my-1" />
                  <button
                    onClick={() => { setShowDrawings((v) => !v); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-high transition-colors"
                  >
                    {showDrawings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showDrawings ? "Hide Drawings" : "Show Drawings"}
                  </button>
                  <button
                    onClick={() => { clearAllDrawings(); setMobileDrawingOpen(false); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
            "flex items-center justify-center h-12 w-12 shadow-lg transition-all",
            mobileDrawingOpen || drawingMode !== "none"
              ? "bg-primary text-primary-foreground shadow-primary/25"
              : "bg-surface-high border border-border/10 text-muted-foreground hover:text-foreground"
          )}
        >
          <TrendingUp className="h-5 w-5" />
        </button>
      </div>

      {/* Drawing mode indicator on mobile */}
      {drawingMode !== "none" && (
        <div className="lg:hidden fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground text-3xs font-bold uppercase tracking-widest px-3 py-1.5 shadow-lg animate-pulse">
          {pendingPoint ? "Tap second point..." : "Tap first point..."}
        </div>
      )}

      {/* ── Mobile bottom navigation ──────────────────────────────────── */}
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
