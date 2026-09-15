"use client";

import { ChevronDown,Search,X } from "lucide-react";
import { useEffect,useMemo,useRef,useState } from "react";


import { cn } from "@/lib/utils";
import { type WatchlistItem } from "@/lib/watchlist";


import { POPULAR_SYMBOLS } from "./chart-config";
export function SymbolSearch({
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
