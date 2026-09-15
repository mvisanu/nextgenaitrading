"use client";

import { Check,ChevronDown,ChevronRight,Plus,Trash2,X } from "lucide-react";
import { useEffect,useRef,useState } from "react";


import { cn } from "@/lib/utils";
import { type WatchlistItem } from "@/lib/watchlist";

import type { CandleBar } from "@/types";

import { formatChange,formatPrice } from "./quote-format";
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
      tabIndex={0}
      aria-label={`Chart ${item.symbol}`}
      onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onClick(); } }}
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
          {item.price > 0 ? `${positive ? "+" : ""}${item.changePct.toFixed(2)}%` : "-"}
        </div>
      </td>
    </tr>
  );
}

// ─── Sovereign Terminal Watchlist Section ────────────────────────────────────
// Renders as table rows (tr) so it can be embedded inside a <tbody>.
export function WatchlistSection({
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
export function QuotePanel({ item, lastCandle }: { item: WatchlistItem; lastCandle?: CandleBar }) {
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
          {item.price > 0 ? formatChange(item.change) : "-"}
        </span>
        <span className={cn("text-xs tabular-nums", positive ? "text-primary" : "text-destructive")}>
          {item.price > 0 ? `${positive ? "+" : ""}${item.changePct.toFixed(2)}%` : "-"}
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
