"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, RotateCcw, Zap } from "lucide-react";
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Screener Controls
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Universe selector */}
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Market
          </label>
          <div className="flex gap-1">
            {UNIVERSES.map((u) => (
              <Button
                key={u.value}
                variant={universe === u.value ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => onUniverseChange(u.value)}
              >
                {u.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Presets */}
        {universe === "stocks" && presets.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-1">
              {presets.map((p) => (
                <Badge
                  key={p.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs"
                  onClick={() => onPresetSelect(p.key)}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Min Price
            </label>
            <Input
              type="number"
              placeholder="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Max Price
            </label>
            <Input
              type="number"
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Min Volume
            </label>
            <Input
              type="number"
              placeholder="0"
              value={minVolume}
              onChange={(e) => setMinVolume(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Results
            </label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["10", "20", "50"].map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sort */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Sort By
            </label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SORT_OPTIONS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Order
            </label>
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Highest First</SelectItem>
                <SelectItem value="asc">Lowest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Search button */}
        <Button onClick={handleSubmit} disabled={isLoading} className="w-full h-9">
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? "Scanning..." : "Scan Market"}
        </Button>
      </CardContent>
    </Card>
  );
}
