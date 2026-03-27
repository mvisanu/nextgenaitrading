"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RotateCcw, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetUniverse, ScreenerPreset } from "@/types";

interface ScreenerControlsProps {
  universe: AssetUniverse;
  onUniverseChange: (u: AssetUniverse) => void;
  onSearch: (params: {
    minPrice?: number;
    maxPrice?: number;
    minVolume?: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    limit?: number;
    preset?: string;
  }) => void;
  onPresetSelect: (preset: string) => void;
  presets: ScreenerPreset[];
  isLoading?: boolean;
}

const UNIVERSES: { value: AssetUniverse; label: string }[] = [
  { value: "stocks", label: "Stocks" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "etf", label: "ETFs" },
];

const SORT_OPTIONS: Record<string, string> = {
  change_pct: "Change %",
  volume: "Volume",
  market_cap: "Market Cap",
  rsi: "RSI",
  close: "Price",
};

export function ScreenerControls({
  universe,
  onUniverseChange,
  onSearch,
  onPresetSelect,
  presets,
  isLoading,
}: ScreenerControlsProps) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [sortBy, setSortBy] = useState("change_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState("20");

  const handleSubmit = () => {
    onSearch({
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      minVolume: minVolume ? parseFloat(minVolume) : undefined,
      sortBy,
      sortOrder,
      limit: parseInt(limit) || 20,
    });
  };

  const handleReset = () => {
    setMinPrice("");
    setMaxPrice("");
    setMinVolume("");
    setSortBy("change_pct");
    setSortOrder("desc");
    setLimit("20");
  };

  return (
    <div className="bg-surface-low border border-white/5 rounded-lg overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-lowest/60">
        <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">
          Filter Controls
        </span>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-3xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Universe tabs */}
        <div className="space-y-1.5">
          <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
            Market
          </label>
          <div className="flex gap-1">
            {UNIVERSES.map((u) => (
              <button
                key={u.value}
                onClick={() => onUniverseChange(u.value)}
                className={cn(
                  "flex-1 py-1.5 text-2xs font-bold uppercase tracking-wider rounded transition-all",
                  universe === u.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-high text-muted-foreground hover:text-foreground hover:bg-surface-highest"
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        {universe === "stocks" && presets.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={() => onPresetSelect(p.key)}
                  className="flex items-center gap-1 px-2 py-1 text-3xs font-bold uppercase tracking-wider bg-surface-high text-muted-foreground hover:bg-primary/20 hover:text-primary border border-white/5 hover:border-primary/30 rounded transition-all"
                >
                  <Zap className="h-2.5 w-2.5" />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price + Volume filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Min Price
            </label>
            <Input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 text-xs bg-surface-high border-white/10 focus:border-primary/50 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Max Price
            </label>
            <Input
              type="number"
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-xs bg-surface-high border-white/10 focus:border-primary/50 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Min Volume
            </label>
            <Input
              type="number"
              placeholder="0"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              className="h-8 text-xs bg-surface-high border-white/10 focus:border-primary/50 focus:ring-0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Results
            </label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="h-8 text-xs bg-surface-high border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["10", "20", "50"].map((n) => (
                  <SelectItem key={n} value={n} className="text-xs">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort controls */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Sort By
            </label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs bg-surface-high border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_OPTIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-3xs font-bold uppercase tracking-widest text-muted-foreground block">
              Order
            </label>
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
            >
              <SelectTrigger className="h-8 text-xs bg-surface-high border-white/10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc" className="text-xs">
                  Highest First
                </SelectItem>
                <SelectItem value="asc" className="text-xs">
                  Lowest First
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Run scanner button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-bold text-2xs uppercase tracking-widest rounded hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Search className="h-3.5 w-3.5" />
          {isLoading ? "Scanning..." : "Run Scanner"}
        </button>
      </div>
    </div>
  );
}
