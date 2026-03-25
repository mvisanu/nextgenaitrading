"use client";

/**
 * /opportunities — V3 Watchlist + Buy Zone + Live Scanner
 *
 * Layout: Dashboard watchlist sidebar (right, 300px) + V3 WatchlistTable (main).
 * The sidebar uses the shared useWatchlist hook from lib/watchlist.ts,
 * synced with the dashboard via localStorage events.
 *
 * Protected route: requires authentication.
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Check,
  X,
  Trash2,
  Pencil,
  Star,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { WatchlistTable } from "@/components/opportunities/WatchlistTable";
import { opportunitiesApi } from "@/lib/api";
import {
  useWatchlist,
  type WatchlistItem,
  type WatchlistCategory,
} from "@/lib/watchlist";
import { cn } from "@/lib/utils";

// ─── Watchlist sidebar components (mirroring dashboard) ─────────────────────

function WatchlistRow({
  item,
  isEditing,
  onRemove,
}: {
  item: WatchlistItem;
  isEditing: boolean;
  onRemove: () => void;
}) {
  const positive = item.change >= 0;
  const changeColor = positive ? "#26a69a" : "#ef5350";

  return (
    <div
      className={cn(
        "group flex items-center w-full px-2 text-left transition-colors",
        "hover:bg-secondary/60"
      )}
      style={{ height: 28 }}
    >
      {isEditing ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
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
      <span className="font-mono font-semibold text-[11px] text-foreground w-[52px] truncate shrink-0">
        {item.symbol}
      </span>
      <span className="font-mono text-[11px] text-foreground ml-auto shrink-0 tabular-nums">
        {item.price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
      <span
        className="font-mono text-[11px] ml-1.5 shrink-0 tabular-nums w-[42px] text-right"
        style={{ color: changeColor }}
      >
        {positive ? "+" : ""}
        {item.change.toFixed(2)}
      </span>
      <span
        className="font-mono text-[11px] ml-1.5 shrink-0 tabular-nums w-[44px] text-right"
        style={{ color: changeColor }}
      >
        {positive ? "+" : ""}
        {item.changePct.toFixed(2)}%
      </span>
    </div>
  );
}

function WatchlistSection({
  title,
  items,
  isEditing,
  onRemove,
  onAdd,
}: {
  title: string;
  items: WatchlistItem[];
  isEditing: boolean;
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
          <span className="text-[10px] text-muted-foreground/60 ml-1">
            {items.length}
          </span>
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

      {open && showAddInput && (
        <div className="flex items-center gap-1 px-2 py-1">
          <input
            ref={addInputRef}
            value={addValue}
            onChange={(e) => setAddValue(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddSubmit();
              if (e.key === "Escape") {
                setShowAddInput(false);
                setAddValue("");
              }
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
            onClick={() => {
              setShowAddInput(false);
              setAddValue("");
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {open &&
        items.map((item) => (
          <WatchlistRow
            key={item.symbol}
            item={item}
            isEditing={isEditing}
            onRemove={() => onRemove(item.symbol)}
          />
        ))}
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function OpportunitiesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [isEditingWatchlist, setIsEditingWatchlist] = useState(false);

  const {
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
  } = useWatchlist();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/opportunities");
    }
  }, [authLoading, user, router]);

  const {
    data: opportunities = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["opportunities"],
    queryFn: opportunitiesApi.list,
    enabled: !!user,
    refetchInterval: 5 * 60_000,
  });

  if (authLoading || !user) return null;

  return (
    <AppShell title="Opportunities">
      <h1 data-testid="page-title" className="sr-only">
        Opportunities
      </h1>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Main content: V3 scanner table ─────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-auto p-4">
          <WatchlistTable
            rows={opportunities}
            isLoading={isLoading}
            onRefetch={refetch}
          />
        </div>

        {/* ── Watchlist sidebar (synced with dashboard) ──────────────────── */}
        <div
          className="flex flex-col shrink-0 bg-card border-l border-border overflow-hidden"
          style={{ width: 300 }}
        >
          <div className="flex items-center px-2 h-8 shrink-0 border-b border-border bg-secondary/50">
            <Star className="h-3.5 w-3.5 text-yellow-500 mr-1.5" />
            <span className="text-[11px] font-semibold text-foreground flex-1">
              Watchlist
            </span>
            <button
              onClick={() => setIsEditingWatchlist((v) => !v)}
              className={cn(
                "mr-2 transition-colors",
                isEditingWatchlist
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={isEditingWatchlist ? "Done editing" : "Edit watchlist"}
            >
              {isEditingWatchlist ? (
                <Check className="h-3 w-3" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
            </button>
            <span className="font-mono text-[10px] text-muted-foreground w-[52px] text-right shrink-0">
              Last
            </span>
            <span className="font-mono text-[10px] text-muted-foreground w-[42px] text-right ml-1.5 shrink-0">
              Chg
            </span>
            <span className="font-mono text-[10px] text-muted-foreground w-[44px] text-right ml-1.5 shrink-0">
              Chg%
            </span>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <WatchlistSection
              title="Indices"
              items={watchlist.indices}
              isEditing={isEditingWatchlist}
              onRemove={removeFromWatchlist}
              onAdd={(sym) => addToWatchlist("indices", sym)}
            />
            <WatchlistSection
              title="Stocks"
              items={watchlist.stocks}
              isEditing={isEditingWatchlist}
              onRemove={removeFromWatchlist}
              onAdd={(sym) => addToWatchlist("stocks", sym)}
            />
            <WatchlistSection
              title="Crypto"
              items={watchlist.crypto}
              isEditing={isEditingWatchlist}
              onRemove={removeFromWatchlist}
              onAdd={(sym) => addToWatchlist("crypto", sym)}
            />
            {(watchlist.custom.length > 0 || isEditingWatchlist) && (
              <WatchlistSection
                title="Custom"
                items={watchlist.custom}
                isEditing={isEditingWatchlist}
                onRemove={removeFromWatchlist}
                onAdd={(sym) => addToWatchlist("custom", sym)}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
