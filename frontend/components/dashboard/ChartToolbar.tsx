"use client";

import type { DrawingMode } from "@/components/charts/PriceChart";
import { Button } from "@/components/ui/button";
import type { ChartPreferences } from "@/lib/chart-preferences";
import { tradingHref,type TradingSelection } from "@/lib/trading-selection";
import type { WatchlistItem } from "@/lib/watchlist";
import Link from "next/link";
import { useState,type Dispatch,type SetStateAction } from "react";
import { SymbolSearch } from "./SymbolSearch";
import { ALL_INTERVALS } from "./chart-config";

const toggles = [
  ["showMACD", "MACD"], ["showRSI", "RSI"], ["showBollinger", "Bollinger bands"],
  ["showFVG", "Automatic fair value gaps"], ["showDrawings", "Saved drawings"],
  ["showNews", "News"], ["showWatchlist", "Watchlist panel"],
] as const;

export function ChartToolbar({ selection, onSelection, items, preferences, onPreferences, drawingMode, onDrawingMode, onClearDrawings, hasDrawings, onWatchlist }: {
  selection: TradingSelection; onSelection: (patch: Partial<TradingSelection>) => unknown;
  items: WatchlistItem[]; preferences: ChartPreferences; onPreferences: Dispatch<SetStateAction<ChartPreferences>>;
  drawingMode: DrawingMode; onDrawingMode: (mode: DrawingMode) => void;
  onClearDrawings: () => void; hasDrawings: boolean; onWatchlist: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  return <div className="shrink-0 border-b border-border bg-surface-low">
    <div className="flex flex-wrap items-center gap-2 p-2">
      <SymbolSearch currentSymbol={selection.symbol} onSelect={symbol => onSelection({ symbol })} watchlistItems={items} />
      <div className="hidden items-center gap-1 lg:flex" aria-label="Common timeframes">
        {(["5m", "1h", "1d", "1wk"] as const).map(timeframe => <Button key={timeframe} size="sm" variant={selection.timeframe === timeframe ? "secondary" : "ghost"}
          aria-pressed={selection.timeframe === timeframe} onClick={() => onSelection({ timeframe })}>{timeframe}</Button>)}
      </div>
      <select aria-label="Chart timeframe" value={selection.timeframe} onChange={e => onSelection({ timeframe: e.target.value as TradingSelection["timeframe"] })}
        className="min-h-11 rounded-md border border-border bg-background px-2 text-sm">
        {ALL_INTERVALS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <Button variant="ghost" aria-pressed={preferences.showMA} onClick={() => onPreferences(previous => ({ ...previous, showMA: !previous.showMA }))}>Moving averages</Button>
      <Button variant="outline" aria-expanded={advanced} aria-controls="chart-tools" onClick={() => setAdvanced(!advanced)}>Chart tools</Button>
      <Button className="md:hidden" variant="ghost" onClick={onWatchlist}>Watchlist</Button>
      <Link href={tradingHref("/trade?view=order", selection)} className="ml-auto inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Prepare order</Link>
    </div>
    {advanced && <div id="chart-tools" className="max-h-64 space-y-4 overflow-y-auto border-t border-border p-3 text-sm">
      <div className="flex flex-wrap gap-x-5 gap-y-3">
        {toggles.map(([key, label]) => <label key={key} className="flex min-h-9 items-center gap-2">
          <input type="checkbox" checked={preferences[key]} onChange={e => onPreferences(previous => ({ ...previous, [key]: e.target.checked }))} />{label}
        </label>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" aria-pressed={drawingMode === "trendline"} onClick={() => onDrawingMode("trendline")}>Draw trend line</Button>
        <Button variant="outline" aria-pressed={drawingMode === "fvg"} onClick={() => onDrawingMode("fvg")}>Draw fair value gap</Button>
        {drawingMode !== "none" && <Button variant="ghost" onClick={() => onDrawingMode("none")}>Cancel drawing</Button>}
        {hasDrawings && <Button variant="ghost" onClick={onClearDrawings}>Clear drawings</Button>}
        <Link className="p-2 underline" href={tradingHref("/research?view=alerts", selection)}>Manage alerts</Link>
      </div>
      <p className="text-muted-foreground">Chart preferences are saved on this device. To draw, select two points on the chart.</p>
    </div>}
    {drawingMode !== "none" && <p role="status" className="px-3 pb-2 text-sm text-primary">Drawing {drawingMode === "fvg" ? "a fair value gap" : "a trend line"}: select two points. Press Escape to cancel.</p>}
  </div>;
}
