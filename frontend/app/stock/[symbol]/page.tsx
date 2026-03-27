"use client";

/**
 * /stock/[symbol] — Stock Analysis Detail
 *
 * Sovereign Terminal design system.
 * Shows financial KPIs, balance sheet, analyst consensus,
 * price targets and earnings history for a given symbol.
 * Protected route: requires authentication.
 */

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockData {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  // Financial KPIs
  revenueTtm: string;
  revenueTtmChg: string;
  netIncome: string;
  netIncomeChg: string;
  epsDialuted: string;
  epsChg: string;
  netMargin: string;
  netMarginLabel: string;
  // Key statistics
  open: number;
  high: number;
  low: number;
  marketCap: string;
  peRatio: number;
  divYield: string;
  week52Low: number;
  week52High: number;
  week52Current: number; // 0–100 position as %
  // Balance sheet
  totalAssets: string;
  totalLiabilities: string;
  liabilitiesRatio: number; // 0–100 %
  netEquity: string;
  // Analyst consensus
  analystScore: number;
  analystLabel: string;
  buyCount: number;
  buyPct: number;
  holdCount: number;
  holdPct: number;
  sellCount: number;
  sellPct: number;
  // Price targets
  avgTarget: number;
  targetUpside: string;
  targetLow: number;
  targetHigh: number;
  targetLowPct: number;  // 0–100 left offset
  targetRangePct: number; // 0–100 width
  targetCurrentPct: number; // 0–100 current price dot position
  // Earnings
  earnings: Array<{
    month: string;
    day: number;
    quarter: string;
    beat: string;
    actual: string;
    dim?: boolean;
  }>;
}

// ─── Demo data keyed by symbol ────────────────────────────────────────────────

const DEFAULT_DATA: StockData = {
  symbol: "NVDA",
  name: "NVIDIA Corporation",
  exchange: "NASDAQ",
  price: 902.50,
  change: 18.32,
  changePct: 2.07,
  revenueTtm: "$60.92B",
  revenueTtmChg: "+126% YoY",
  netIncome: "$29.76B",
  netIncomeChg: "+581% YoY",
  epsDialuted: "$11.93",
  epsChg: "+586% YoY",
  netMargin: "48.8%",
  netMarginLabel: "Industry High",
  open: 894.20,
  high: 906.15,
  low: 891.00,
  marketCap: "$2.25T",
  peRatio: 75.65,
  divYield: "0.02%",
  week52Low: 262.25,
  week52High: 974.00,
  week52Current: 88,
  totalAssets: "$65.73B",
  totalLiabilities: "$22.75B",
  liabilitiesRatio: 34,
  netEquity: "$42.98B",
  analystScore: 4.8,
  analystLabel: "Strong Buy",
  buyCount: 45,
  buyPct: 90,
  holdCount: 4,
  holdPct: 8,
  sellCount: 1,
  sellPct: 2,
  avgTarget: 980.00,
  targetUpside: "+8.5% Upside",
  targetLow: 650,
  targetHigh: 1200,
  targetLowPct: 20,
  targetRangePct: 70,
  targetCurrentPct: 55,
  earnings: [
    { month: "Feb", day: 21, quarter: "Q4 2024", beat: "Beat by $0.68", actual: "$5.16" },
    { month: "Nov", day: 21, quarter: "Q3 2024", beat: "Beat by $0.63", actual: "$4.02", dim: true },
  ],
};

const STOCK_OVERRIDES: Record<string, Partial<StockData>> = {
  AAPL: {
    name: "Apple Inc.",
    price: 173.20, change: -0.94, changePct: -0.54,
    revenueTtm: "$383.93B", revenueTtmChg: "+2% YoY",
    netIncome: "$96.99B", netIncomeChg: "+3% YoY",
    epsDialuted: "$6.13", epsChg: "+10% YoY",
    netMargin: "25.3%", netMarginLabel: "Best-in-class",
    open: 174.00, high: 174.89, low: 172.88,
    marketCap: "$2.71T", peRatio: 28.25, divYield: "0.55%",
    week52Low: 164.08, week52High: 199.62, week52Current: 40,
    totalAssets: "$352.58B", totalLiabilities: "$290.44B", liabilitiesRatio: 82, netEquity: "$62.14B",
    analystScore: 4.4, analystLabel: "Buy",
    buyCount: 32, buyPct: 74, holdCount: 9, holdPct: 21, sellCount: 2, sellPct: 5,
    avgTarget: 205.00, targetUpside: "+18.4% Upside",
    targetLow: 155, targetHigh: 240, targetLowPct: 15, targetRangePct: 72, targetCurrentPct: 31,
    earnings: [
      { month: "Feb", day: 1, quarter: "Q1 2024", beat: "Beat by $0.07", actual: "$2.18" },
      { month: "Nov", day: 2, quarter: "Q4 2023", beat: "Beat by $0.06", actual: "$2.18", dim: true },
    ],
  },
  MSFT: {
    name: "Microsoft Corporation",
    price: 422.86, change: 5.35, changePct: 1.28,
    revenueTtm: "$227.58B", revenueTtmChg: "+16% YoY",
    netIncome: "$87.90B", netIncomeChg: "+22% YoY",
    epsDialuted: "$11.80", epsChg: "+23% YoY",
    netMargin: "38.6%", netMarginLabel: "Top Quartile",
    open: 417.50, high: 424.12, low: 416.88,
    marketCap: "$3.14T", peRatio: 35.83, divYield: "0.73%",
    week52Low: 309.45, week52High: 468.35, week52Current: 70,
    totalAssets: "$484.28B", totalLiabilities: "$227.32B", liabilitiesRatio: 47, netEquity: "$256.96B",
    analystScore: 4.9, analystLabel: "Strong Buy",
    buyCount: 51, buyPct: 96, holdCount: 2, holdPct: 4, sellCount: 0, sellPct: 0,
    avgTarget: 500.00, targetUpside: "+18.2% Upside",
    targetLow: 380, targetHigh: 570, targetLowPct: 12, targetRangePct: 75, targetCurrentPct: 48,
    earnings: [
      { month: "Jan", day: 30, quarter: "Q2 FY2024", beat: "Beat by $0.18", actual: "$2.93" },
      { month: "Oct", day: 24, quarter: "Q1 FY2024", beat: "Beat by $0.29", actual: "$3.30", dim: true },
    ],
  },
  TSLA: {
    name: "Tesla, Inc.",
    price: 171.05, change: -3.68, changePct: -2.11,
    revenueTtm: "$97.69B", revenueTtmChg: "+1% YoY",
    netIncome: "$7.09B", netIncomeChg: "-53% YoY",
    epsDialuted: "$2.24", epsChg: "-55% YoY",
    netMargin: "7.3%", netMarginLabel: "Declining",
    open: 174.73, high: 175.22, low: 169.73,
    marketCap: "$544.74B", peRatio: 49.10, divYield: "N/A",
    week52Low: 138.80, week52High: 271.00, week52Current: 24,
    totalAssets: "$106.62B", totalLiabilities: "$43.66B", liabilitiesRatio: 41, netEquity: "$62.96B",
    analystScore: 3.2, analystLabel: "Hold",
    buyCount: 18, buyPct: 44, holdCount: 14, holdPct: 34, sellCount: 9, sellPct: 22,
    avgTarget: 195.00, targetUpside: "+14.0% Upside",
    targetLow: 85, targetHigh: 320, targetLowPct: 10, targetRangePct: 75, targetCurrentPct: 28,
    earnings: [
      { month: "Jan", day: 24, quarter: "Q4 2023", beat: "Missed by $0.08", actual: "$0.71" },
      { month: "Oct", day: 18, quarter: "Q3 2023", beat: "Missed by $0.09", actual: "$0.66", dim: true },
    ],
  },
  AMZN: {
    name: "Amazon.com, Inc.",
    price: 178.22, change: 1.55, changePct: 0.88,
    revenueTtm: "$574.79B", revenueTtmChg: "+12% YoY",
    netIncome: "$30.43B", netIncomeChg: "++>10x",
    epsDialuted: "$2.90", epsChg: "+>10x",
    netMargin: "5.3%", netMarginLabel: "Expanding",
    open: 176.67, high: 179.30, low: 175.83,
    marketCap: "$1.87T", peRatio: 61.45, divYield: "N/A",
    week52Low: 118.35, week52High: 191.70, week52Current: 75,
    totalAssets: "$527.85B", totalLiabilities: "$319.04B", liabilitiesRatio: 60, netEquity: "$208.81B",
    analystScore: 4.7, analystLabel: "Strong Buy",
    buyCount: 43, buyPct: 89, holdCount: 5, holdPct: 10, sellCount: 0, sellPct: 0,
    avgTarget: 220.00, targetUpside: "+23.4% Upside",
    targetLow: 155, targetHigh: 260, targetLowPct: 14, targetRangePct: 72, targetCurrentPct: 53,
    earnings: [
      { month: "Feb", day: 1, quarter: "Q4 2023", beat: "Beat by $0.44", actual: "$1.00" },
      { month: "Oct", day: 26, quarter: "Q3 2023", beat: "Beat by $0.60", actual: "$0.94", dim: true },
    ],
  },
  GOOG: {
    name: "Alphabet Inc.",
    price: 151.77, change: 3.20, changePct: 2.15,
    revenueTtm: "$305.63B", revenueTtmChg: "+13% YoY",
    netIncome: "$73.80B", netIncomeChg: "+23% YoY",
    epsDialuted: "$5.80", epsChg: "+24% YoY",
    netMargin: "24.2%", netMarginLabel: "Expanding",
    open: 148.57, high: 152.69, low: 147.60,
    marketCap: "$1.89T", peRatio: 26.17, divYield: "N/A",
    week52Low: 115.35, week52High: 163.45, week52Current: 76,
    totalAssets: "$402.39B", totalLiabilities: "$119.20B", liabilitiesRatio: 30, netEquity: "$283.19B",
    analystScore: 4.6, analystLabel: "Strong Buy",
    buyCount: 40, buyPct: 85, holdCount: 7, holdPct: 15, sellCount: 0, sellPct: 0,
    avgTarget: 185.00, targetUpside: "+21.9% Upside",
    targetLow: 138, targetHigh: 220, targetLowPct: 13, targetRangePct: 74, targetCurrentPct: 59,
    earnings: [
      { month: "Jan", day: 30, quarter: "Q4 2023", beat: "Beat by $0.26", actual: "$1.64" },
      { month: "Oct", day: 24, quarter: "Q3 2023", beat: "Beat by $0.11", actual: "$1.55", dim: true },
    ],
  },
};

function getStockData(symbol: string): StockData {
  const upper = symbol.toUpperCase();
  const override = STOCK_OVERRIDES[upper];
  if (override) {
    return { ...DEFAULT_DATA, ...override, symbol: upper };
  }
  return { ...DEFAULT_DATA, symbol: upper };
}

// ─── Donut gauge ──────────────────────────────────────────────────────────────

function DonutGauge({ score }: { score: number }) {
  // Circle circumference for r=56: 2π×56 ≈ 351.85
  const circ = 351.85;
  const filled = (score / 5) * circ;
  const dashOffset = circ - filled;

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle
          cx="64" cy="64" r="56"
          fill="transparent"
          stroke="hsl(var(--surface-high))"
          strokeWidth="12"
        />
        <circle
          cx="64" cy="64" r="56"
          fill="transparent"
          stroke="hsl(var(--primary))"
          strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-foreground tabular-nums">{score.toFixed(1)}</span>
        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest leading-tight text-center">
          /5
        </span>
      </div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function RatingBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-1 bg-surface-high rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Balance sheet row ────────────────────────────────────────────────────────

function BalanceRow({
  label,
  value,
  pct,
  barColor,
  bold,
}: {
  label: string;
  value: string;
  pct?: number;
  barColor?: string;
  bold?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className={cn("text-muted-foreground", bold && "font-bold text-foreground")}>{label}</span>
        <span className={cn("font-mono font-bold tabular-nums", bold ? "text-primary text-base" : "text-foreground")}>
          {value}
        </span>
      </div>
      {pct !== undefined && barColor && (
        <div className="w-full h-1.5 bg-surface-high rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full opacity-80", barColor)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

// ─── Key stat row ─────────────────────────────────────────────────────────────

function StatRow({ label, value, valueClass, alt }: { label: string; value: string; valueClass?: string; alt?: boolean }) {
  return (
    <div className={cn("px-5 py-3.5 flex justify-between items-center", alt && "bg-surface-mid/30")}>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={cn("text-sm font-bold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function StockAnalysisPage({ params }: PageProps) {
  const { symbol } = use(params);
  const router = useRouter();
  const data = getStockData(symbol);
  const isPositive = data.changePct >= 0;

  const backAction = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      className="h-7 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground gap-1.5"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Back
    </Button>
  );

  return (
    <AppShell title="Stock Analysis" actions={backAction}>
      <div className="max-w-[1400px] mx-auto p-4 lg:p-6 space-y-6">

        {/* ── Hero Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-center gap-5">
            {/* Symbol icon placeholder */}
            <div className="w-14 h-14 rounded-lg bg-surface-mid border border-border/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-black text-primary tracking-tighter">
                {data.symbol.slice(0, 2)}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-4xl font-black tracking-tighter text-foreground tabular-nums">
                  {data.symbol}
                </h1>
                <span className="px-2 py-0.5 bg-surface-mid text-muted-foreground text-xs rounded-sm font-mono tracking-widest">
                  {data.exchange}
                </span>
              </div>
              <p className="text-muted-foreground font-medium tracking-wide mt-0.5">
                {data.name}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <div className="text-2xl sm:text-4xl font-bold tabular-nums text-foreground tracking-tight">
              ${data.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={cn("flex items-center gap-1.5 mt-1 sm:justify-end", isPositive ? "text-primary" : "text-destructive")}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span className="text-base sm:text-lg font-bold tabular-nums">
                {isPositive ? "+" : ""}{data.change.toFixed(2)} ({isPositive ? "+" : ""}{data.changePct.toFixed(2)}%)
              </span>
              <span className="text-xs text-muted-foreground font-medium uppercase ml-1">After Hours</span>
            </div>
          </div>
        </div>

        {/* ── Main bento grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">

          {/* ── Left column (8/12) ──────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-5">

            {/* Financial KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Revenue (TTM)", value: data.revenueTtm, sub: data.revenueTtmChg },
                { label: "Net Income",    value: data.netIncome,  sub: data.netIncomeChg  },
                { label: "EPS (Diluted)", value: data.epsDialuted, sub: data.epsChg       },
                { label: "Net Margin",    value: data.netMargin,  sub: data.netMarginLabel },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-surface-mid rounded-lg border border-border/10 p-4"
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-bold">
                    {kpi.label}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-foreground">{kpi.value}</div>
                  <div className="text-[10px] text-primary mt-1 font-bold">{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Simplified Balance Sheet */}
            <div className="bg-surface-low rounded-lg border border-border/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/10 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                  Simplified Balance Sheet
                </h3>
                <span className="text-[10px] text-muted-foreground">Values in USD</span>
              </div>
              <div className="p-5 space-y-4">
                <BalanceRow
                  label="Total Assets"
                  value={data.totalAssets}
                  pct={100}
                  barColor="bg-primary"
                />
                <BalanceRow
                  label="Total Liabilities"
                  value={data.totalLiabilities}
                  pct={data.liabilitiesRatio}
                  barColor="bg-destructive"
                />
                <div className="pt-2 border-t border-border/10">
                  <BalanceRow
                    label="Net Equity"
                    value={data.netEquity}
                    bold
                  />
                </div>
              </div>
            </div>

            {/* Analyst + Price Targets row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Analyst Consensus */}
              <div className="bg-surface-low rounded-lg border border-border/10 p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5">
                  Analyst Consensus
                </h3>
                <div className="flex items-center gap-6">
                  <DonutGauge score={data.analystScore} />
                  <div className="flex-1 space-y-3 min-w-0">
                    <div>
                      <div className="text-base font-black text-foreground tracking-tight mb-0.5">
                        {data.analystLabel}
                      </div>
                    </div>
                    {/* Buy */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-primary uppercase">Buy ({data.buyCount})</span>
                        <span className="text-foreground tabular-nums">{data.buyPct}%</span>
                      </div>
                      <RatingBar pct={data.buyPct} color="bg-primary" />
                    </div>
                    {/* Hold */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-muted-foreground uppercase">Hold ({data.holdCount})</span>
                        <span className="text-foreground tabular-nums">{data.holdPct}%</span>
                      </div>
                      <RatingBar pct={data.holdPct} color="bg-muted-foreground" />
                    </div>
                    {/* Sell */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-destructive uppercase">Sell ({data.sellCount})</span>
                        <span className="text-foreground tabular-nums">{data.sellPct}%</span>
                      </div>
                      <RatingBar pct={data.sellPct} color="bg-destructive" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Targets (12M) */}
              <div className="bg-surface-low rounded-lg border border-border/10 p-5">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-5">
                  Price Targets (12M)
                </h3>
                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <div>
                      <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Average</div>
                      <div className="text-3xl font-black text-foreground tracking-tighter tabular-nums">
                        ${data.avgTarget.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">{data.targetUpside}</span>
                    </div>
                  </div>

                  {/* Range bar */}
                  <div className="relative pt-5 pb-6">
                    {/* Track */}
                    <div className="h-1.5 w-full bg-surface-high rounded-full" />
                    {/* Range highlight */}
                    <div
                      className="absolute top-5 h-1.5 bg-primary/20 rounded-full border-x border-primary/40"
                      style={{
                        left: `${data.targetLowPct}%`,
                        width: `${data.targetRangePct}%`,
                      }}
                    />
                    {/* Low label */}
                    <div
                      className="absolute top-0 flex flex-col items-center"
                      style={{ left: `${data.targetLowPct}%`, transform: "translateX(-50%)" }}
                    >
                      <div className="w-px h-4 bg-border/30 mt-1" />
                      <span className="text-[9px] text-muted-foreground mt-1 tabular-nums">
                        ${data.targetLow.toLocaleString()}
                      </span>
                    </div>
                    {/* High label */}
                    <div
                      className="absolute top-0 flex flex-col items-center"
                      style={{
                        left: `${data.targetLowPct + data.targetRangePct}%`,
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="w-px h-4 bg-border/30 mt-1" />
                      <span className="text-[9px] text-muted-foreground mt-1 tabular-nums">
                        ${data.targetHigh.toLocaleString()}
                      </span>
                    </div>
                    {/* Current price dot */}
                    <div
                      className="absolute w-3 h-3 bg-foreground rounded-full shadow-lg ring-4 ring-foreground/20"
                      style={{
                        top: "calc(1.25rem - 0.375rem)",
                        left: `${data.targetCurrentPct}%`,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column (4/12) ─────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Key Statistics */}
            <div className="bg-surface-low rounded-lg border border-border/10 overflow-hidden">
              <div className="px-5 py-4 border-b border-border/10">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                  Key Statistics
                </h3>
              </div>
              <div className="divide-y divide-border/5">
                <StatRow label="Open"       value={`$${data.open.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} />
                <StatRow label="High"       value={`$${data.high.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}  valueClass="text-primary"     alt />
                <StatRow label="Low"        value={`$${data.low.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}   valueClass="text-destructive" />
                <StatRow label="Market Cap" value={data.marketCap} alt />
                <StatRow label="P/E Ratio"  value={data.peRatio.toFixed(2)} />
                <StatRow label="Div Yield"  value={data.divYield}  alt />
                {/* 52-week range */}
                <div className="px-5 py-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground font-medium">52-Week Range</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
                      <span>${data.week52Low.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                      <span>${data.week52High.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="w-full h-1 bg-surface-high rounded-full relative">
                      {/* Range fill from low to current */}
                      <div
                        className="absolute h-full bg-primary/30 rounded-full"
                        style={{ width: `${data.week52Current}%` }}
                      />
                      {/* Current price marker dot */}
                      <div
                        className="absolute w-2.5 h-2.5 bg-foreground rounded-full shadow -top-[3px]"
                        style={{ left: `calc(${data.week52Current}% - 5px)` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Earnings History */}
            <div className="bg-surface-low rounded-lg border border-border/10 p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Earnings History
              </h3>
              <div className="space-y-4">
                {data.earnings.map((e, i) => (
                  <div
                    key={i}
                    className={cn("flex items-center gap-4", e.dim && "opacity-50")}
                  >
                    {/* Date badge */}
                    <div className="flex flex-col items-center justify-center w-12 h-12 bg-surface-mid rounded-lg border border-border/10 shrink-0">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">{e.month}</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">{e.day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground">{e.quarter}</div>
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-tight",
                        e.beat.toLowerCase().startsWith("beat") ? "text-primary" : "text-destructive"
                      )}>
                        {e.beat}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-foreground tabular-nums">{e.actual}</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Actual</div>
                    </div>
                  </div>
                ))}
                <button className="w-full py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors border border-dashed border-border/20 rounded-lg">
                  View Full History
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
