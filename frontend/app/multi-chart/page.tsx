"use client";

/**
 * /multi-chart — Multi-Chart Comparison View
 *
 * Sovereign Terminal design system.
 * 2x3 grid of mini chart cards with right watchlist sidebar.
 * Protected route: requires authentication.
 */

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, MoreVertical, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartStock {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  activeTimeframe: "1D" | "5D" | "1M";
  volumeBars: Array<{ height: string; up: boolean }>;
  candlePath: string;
  trend: "up" | "down";
}

interface WatchlistRow {
  symbol: string;
  last: number;
  chgPct: number;
}

// ─── Static demo data ─────────────────────────────────────────────────────────

const CHART_STOCKS: ChartStock[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    exchange: "NASDAQ",
    price: 872.45,
    change: 34.53,
    changePct: 4.12,
    activeTimeframe: "1D",
    trend: "up",
    volumeBars: [
      { height: "50%", up: true },
      { height: "66%", up: true },
      { height: "33%", up: false },
      { height: "75%", up: true },
      { height: "50%", up: true },
      { height: "25%", up: false },
      { height: "50%", up: true },
    ],
    candlePath: "M10,80 L30,45 L50,60 L70,30 L90,40 L110,20 L130,35 L150,25",
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    price: 173.20,
    change: -0.94,
    changePct: -0.54,
    activeTimeframe: "1D",
    trend: "down",
    volumeBars: [
      { height: "33%", up: false },
      { height: "50%", up: false },
      { height: "50%", up: true },
      { height: "66%", up: false },
      { height: "75%", up: false },
      { height: "50%", up: false },
      { height: "25%", up: true },
    ],
    candlePath: "M10,30 L30,50 L50,40 L70,65 L90,55 L110,70 L130,60 L150,75",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    exchange: "NASDAQ",
    price: 422.86,
    change: 5.35,
    changePct: 1.28,
    activeTimeframe: "1D",
    trend: "up",
    volumeBars: [
      { height: "25%", up: true },
      { height: "50%", up: true },
      { height: "66%", up: true },
      { height: "33%", up: false },
      { height: "75%", up: true },
      { height: "50%", up: true },
      { height: "50%", up: true },
    ],
    candlePath: "M10,70 L30,55 L50,45 L70,35 L90,50 L110,30 L130,40 L150,28",
  },
  {
    symbol: "TSLA",
    name: "Tesla Motors",
    exchange: "NASDAQ",
    price: 171.05,
    change: -3.68,
    changePct: -2.11,
    activeTimeframe: "5D",
    trend: "down",
    volumeBars: [
      { height: "75%", up: false },
      { height: "50%", up: false },
      { height: "25%", up: false },
      { height: "33%", up: true },
      { height: "66%", up: false },
      { height: "50%", up: false },
      { height: "50%", up: false },
    ],
    candlePath: "M10,25 L30,45 L50,60 L70,75 L90,65 L110,80 L130,70 L150,85",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com",
    exchange: "NASDAQ",
    price: 178.22,
    change: 1.55,
    changePct: 0.88,
    activeTimeframe: "1D",
    trend: "up",
    volumeBars: [
      { height: "33%", up: true },
      { height: "25%", up: false },
      { height: "50%", up: true },
      { height: "66%", up: true },
      { height: "50%", up: true },
      { height: "25%", up: false },
      { height: "50%", up: true },
    ],
    candlePath: "M10,60 L30,50 L50,65 L70,45 L90,35 L110,55 L130,40 L150,30",
  },
  {
    symbol: "GOOG",
    name: "Alphabet Inc.",
    exchange: "NASDAQ",
    price: 151.77,
    change: 3.20,
    changePct: 2.15,
    activeTimeframe: "1D",
    trend: "up",
    volumeBars: [
      { height: "50%", up: true },
      { height: "33%", up: true },
      { height: "50%", up: true },
      { height: "66%", up: true },
      { height: "75%", up: true },
      { height: "50%", up: true },
      { height: "50%", up: true },
    ],
    candlePath: "M10,75 L30,65 L50,55 L70,45 L90,35 L110,30 L130,25 L150,20",
  },
];

const WATCHLIST_ROWS: WatchlistRow[] = [
  { symbol: "NVDA",  last: 872.45,  chgPct: 4.12  },
  { symbol: "AMD",   last: 182.30,  chgPct: 2.45  },
  { symbol: "SMCI",  last: 1045.20, chgPct: -1.20 },
  { symbol: "COIN",  last: 241.15,  chgPct: 5.67  },
  { symbol: "MARA",  last: 18.42,   chgPct: -3.44 },
  { symbol: "MSTR",  last: 1652.10, chgPct: 8.92  },
  { symbol: "TSLA",  last: 171.05,  chgPct: -2.11 },
  { symbol: "META",  last: 504.12,  chgPct: 0.44  },
];

// ─── Mini candlestick SVG placeholder ────────────────────────────────────────

function MiniChart({ stock }: { stock: ChartStock }) {
  const isUp = stock.trend === "up";
  const color = isUp ? "hsl(var(--primary))" : "hsl(var(--destructive))";

  return (
    <div className="flex-1 relative bg-black/30 mx-2 mb-2 rounded-sm overflow-hidden">
      {/* Line chart path */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 160 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={`grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Fill area under the line */}
        <path
          d={`${stock.candlePath} L150,100 L10,100 Z`}
          fill={`url(#grad-${stock.symbol})`}
        />
        {/* Line */}
        <path
          d={stock.candlePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      {/* Volume bars at bottom */}
      <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-black/30 to-transparent">
        <div className="flex items-end gap-0.5 px-2 h-full">
          {stock.volumeBars.map((bar, i) => (
            <div
              key={i}
              className={cn(
                "w-1 rounded-sm",
                bar.up ? "bg-primary/40" : "bg-destructive/40"
              )}
              style={{ height: bar.height }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Single chart card ────────────────────────────────────────────────────────

type Timeframe = "1D" | "5D" | "1M";
const TIMEFRAMES: Timeframe[] = ["1D", "5D", "1M"];

function ChartCard({ stock }: { stock: ChartStock }) {
  const [activeTimeframe, setActiveTimeframe] = useState<Timeframe>(stock.activeTimeframe);
  const isPositive = stock.changePct >= 0;

  return (
    <section className="bg-surface-low rounded-sm flex flex-col border border-border/10 min-h-[240px]">
      {/* Header */}
      <div className="p-3 flex justify-between items-start border-b border-border/5">
        <div className="flex items-center gap-2">
          <Link
            href={`/stock/${stock.symbol}`}
            className="text-primary font-bold text-lg tabular-nums tracking-tighter hover:text-primary/80 transition-colors"
          >
            {stock.symbol}
          </Link>
          <span className="text-[10px] px-1.5 py-0.5 bg-surface-mid text-muted-foreground rounded-sm font-mono tracking-widest uppercase">
            {stock.exchange}
          </span>
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider opacity-60 hidden sm:inline">
            {stock.name}
          </span>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded-sm transition-colors",
                activeTimeframe === tf
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground hover:bg-surface-high"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div className="px-3 py-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight">
          {stock.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className={cn("text-xs font-semibold tabular-nums", isPositive ? "text-primary" : "text-destructive")}>
          {isPositive ? "+" : ""}{stock.changePct.toFixed(2)}%
        </span>
        <span className={cn("text-[10px] tabular-nums text-muted-foreground")}>
          {isPositive ? "+" : ""}{stock.change.toFixed(2)}
        </span>
      </div>

      {/* Chart area */}
      <MiniChart stock={stock} />
    </section>
  );
}

// ─── Watchlist sidebar content ────────────────────────────────────────────────

function WatchlistSidebar() {
  const [qty, setQty] = useState("100");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/10 flex justify-between items-center shrink-0">
        <h3 className="font-bold text-[11px] uppercase tracking-widest text-foreground">
          Watchlist 1
        </h3>
        <button className="text-muted-foreground hover:text-foreground transition-colors">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-low border-b border-border/5">
              <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Symbol
              </th>
              <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                Last
              </th>
              <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                Chg%
              </th>
            </tr>
          </thead>
          <tbody className="text-xs tabular-nums">
            {WATCHLIST_ROWS.map((row, i) => {
              const isPos = row.chgPct >= 0;
              return (
                <tr
                  key={row.symbol}
                  className={cn(
                    "hover:bg-surface-high cursor-pointer transition-colors border-b border-border/5",
                    i % 2 === 1 && "bg-surface-low/30"
                  )}
                >
                  <td className="p-3 font-semibold">
                    <Link href={`/stock/${row.symbol}`} className="hover:text-primary transition-colors">
                      {row.symbol}
                    </Link>
                  </td>
                  <td className="p-3 text-right">
                    {row.last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={cn("p-3 text-right font-semibold", isPos ? "text-primary" : "text-destructive")}>
                    {isPos ? "+" : ""}{row.chgPct.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Trade */}
      <div className="p-4 bg-surface-highest/20 border-t border-border/10 shrink-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Quick Trade
          </span>
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
            MKT
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button className="flex-1 bg-primary text-primary-foreground py-2 rounded-sm text-[11px] font-bold tracking-widest uppercase hover:brightness-110 active:scale-95 transition-all">
              BUY
            </button>
            <button className="flex-1 bg-destructive/20 text-destructive border border-destructive/30 py-2 rounded-sm text-[11px] font-bold tracking-widest uppercase hover:bg-destructive/30 active:scale-95 transition-all">
              SELL
            </button>
          </div>
          <div className="bg-surface-low border border-border/20 rounded-sm p-2 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">QTY</span>
            <input
              type="text"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="bg-transparent text-right text-xs font-bold tabular-nums border-none p-0 focus:ring-0 w-20 text-foreground outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MultiChartPage() {
  const actions = (
    <div className="flex items-center gap-2">
      {/* New Layout button */}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-[11px] font-bold uppercase tracking-widest border-border/20 text-muted-foreground hover:text-foreground"
      >
        <LayoutGrid className="h-3 w-3 mr-1.5" />
        New Layout
      </Button>

      {/* Mobile watchlist sheet trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden h-7 text-[11px] font-bold uppercase tracking-widest border-border/20 text-muted-foreground hover:text-foreground"
          >
            Watchlist
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[300px] p-0 bg-surface-lowest border-l border-border/10">
          <WatchlistSidebar />
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <AppShell title="Multi-Chart" actions={actions}>
      <div className="flex h-full overflow-hidden">
        {/* ── Chart grid ── */}
        <div className="flex-1 p-3 overflow-y-auto">
          {/* Section label */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
              Comparison Grid
            </span>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              6 symbols
            </span>
          </div>

          {/* 2×3 grid — stacks to 1-col on mobile, 2-col on md, 3-col on xl */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {CHART_STOCKS.map((stock) => (
              <ChartCard key={stock.symbol} stock={stock} />
            ))}
          </div>
        </div>

        {/* ── Right watchlist sidebar — hidden below xl ── */}
        <aside className="hidden xl:flex w-[260px] flex-col border-l border-border/10 bg-surface-lowest shrink-0">
          <WatchlistSidebar />
        </aside>
      </div>
    </AppShell>
  );
}
