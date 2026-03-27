"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  Brain,
  ShieldAlert,
  Layers,
  Eye,
  Zap,
  Scale,
  RefreshCcw,
  ArrowUpDown,
  Clock,
  MonitorSmartphone,
  Languages,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Lang } from "./translations";

// ─── SVG Candle Component ─────────────────────────────────────────────────────

function Candle({
  x,
  open,
  close,
  high,
  low,
  width = 20,
  scaleY,
  baseY,
  label,
  showLabels,
}: {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  width?: number;
  scaleY: (price: number) => number;
  baseY: number;
  label?: string;
  showLabels?: boolean;
}) {
  const isBull = close > open;
  const bodyTop = scaleY(Math.max(open, close));
  const bodyBottom = scaleY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
  const color = isBull ? "#26a69a" : "#ef5350";
  const wickX = x + width / 2;

  return (
    <g>
      {/* Upper wick */}
      <line x1={wickX} y1={scaleY(high)} x2={wickX} y2={bodyTop} stroke={color} strokeWidth={1.2} />
      {/* Lower wick */}
      <line x1={wickX} y1={bodyBottom} x2={wickX} y2={scaleY(low)} stroke={color} strokeWidth={1.2} />
      {/* Body */}
      <rect
        x={x}
        y={bodyTop}
        width={width}
        height={bodyHeight}
        fill={isBull ? color : color}
        stroke={color}
        strokeWidth={0.5}
        rx={1}
      />
      {showLabels && (
        <>
          {/* High label */}
          <text x={wickX} y={scaleY(high) - 6} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
            H: ${high}
          </text>
          {/* Low label */}
          <text x={wickX} y={scaleY(low) + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>
            L: ${low}
          </text>
          {/* Open label */}
          <text
            x={x - 4}
            y={scaleY(open) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={9}
          >
            O: ${open}
          </text>
          {/* Close label */}
          <text
            x={x + width + 4}
            y={scaleY(close) + 3}
            textAnchor="start"
            className="fill-muted-foreground"
            fontSize={9}
          >
            C: ${close}
          </text>
        </>
      )}
      {label && (
        <text x={wickX} y={baseY + 14} textAnchor="middle" className="fill-foreground" fontSize={10} fontWeight={600}>
          {label}
        </text>
      )}
    </g>
  );
}

// ─── Anatomy Diagram ──────────────────────────────────────────────────────────

function CandleAnatomy() {
  const w = 320;
  const h = 280;
  const scaleY = (p: number) => 240 - (p - 95) * 3;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-xs">
        {/* Bullish candle */}
        <Candle x={60} open={100} close={115} high={120} low={96} width={30} scaleY={scaleY} baseY={250} label="Bullish" showLabels />
        {/* Bearish candle */}
        <Candle x={200} open={118} close={102} high={122} low={98} width={30} scaleY={scaleY} baseY={250} label="Bearish" showLabels />
        {/* Annotations */}
        <line x1={45} y1={scaleY(120)} x2={45} y2={scaleY(115)} stroke="#2962ff" strokeWidth={1} strokeDasharray="3,2" />
        <text x={42} y={scaleY(117.5)} textAnchor="end" fill="#2962ff" fontSize={8}>Upper Wick</text>
        <line x1={45} y1={scaleY(100)} x2={45} y2={scaleY(96)} stroke="#2962ff" strokeWidth={1} strokeDasharray="3,2" />
        <text x={42} y={scaleY(98)} textAnchor="end" fill="#2962ff" fontSize={8}>Lower Wick</text>
        {/* Body annotation */}
        <line x1={48} y1={scaleY(115)} x2={48} y2={scaleY(100)} stroke="#2962ff" strokeWidth={1} strokeDasharray="3,2" />
        <text x={45} y={scaleY(107.5)} textAnchor="end" fill="#2962ff" fontSize={8}>Body</text>
      </svg>
    </div>
  );
}

// ─── Pattern Examples ─────────────────────────────────────────────────────────

function PatternDiagram({ pattern }: { pattern: string }) {
  const w = 280;
  const h = 160;
  const scaleY = (p: number) => 130 - (p - 95) * 2.5;

  const patterns: Record<string, { candles: { o: number; c: number; h: number; l: number }[]; desc: string }> = {
    doji: {
      candles: [
        { o: 108, c: 110, h: 113, l: 105 },
        { o: 112, c: 114, h: 117, l: 109 },
        { o: 110, c: 110.2, h: 116, l: 104 },
      ],
      desc: "Doji — indecision. Open = Close. Watch for reversal.",
    },
    hammer: {
      candles: [
        { o: 115, c: 112, h: 116, l: 110 },
        { o: 112, c: 108, h: 113, l: 106 },
        { o: 105, c: 109, h: 110, l: 97 },
      ],
      desc: "Hammer — bullish reversal. Long lower wick, small body at top.",
    },
    engulfing: {
      candles: [
        { o: 112, c: 114, h: 115, l: 111 },
        { o: 114, c: 110, h: 115, l: 109 },
        { o: 109, c: 117, h: 118, l: 108 },
      ],
      desc: "Bullish Engulfing — strong reversal. Green body fully covers prior red.",
    },
    "shooting-star": {
      candles: [
        { o: 102, c: 106, h: 107, l: 101 },
        { o: 107, c: 110, h: 111, l: 106 },
        { o: 112, c: 109, h: 119, l: 108 },
      ],
      desc: "Shooting Star — bearish reversal. Long upper wick, small body at bottom.",
    },
    "three-soldiers": {
      candles: [
        { o: 100, c: 105, h: 106, l: 99 },
        { o: 105, c: 111, h: 112, l: 104 },
        { o: 111, c: 117, h: 118, l: 110 },
      ],
      desc: "Three White Soldiers — strong bullish continuation.",
    },
    "evening-star": {
      candles: [
        { o: 102, c: 110, h: 111, l: 101 },
        { o: 112, c: 113, h: 116, l: 111 },
        { o: 112, c: 104, h: 113, l: 103 },
      ],
      desc: "Evening Star — bearish reversal at top of uptrend.",
    },
  };

  const p = patterns[pattern];
  if (!p) return null;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[280px]">
        {p.candles.map((c, i) => (
          <Candle
            key={i}
            x={40 + i * 70}
            open={c.o}
            close={c.c}
            high={c.h}
            low={c.l}
            width={24}
            scaleY={scaleY}
            baseY={140}
          />
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
    </div>
  );
}

// ─── Support/Resistance Diagram ───────────────────────────────────────────────

function SupportResistanceDiagram() {
  const w = 400;
  const h = 200;
  const scaleY = (p: number) => 180 - (p - 90) * 3.5;
  const candles = [
    { o: 98, c: 103, h: 105, l: 97 },
    { o: 103, c: 108, h: 110, l: 102 },
    { o: 108, c: 112, h: 115, l: 107 },
    { o: 112, c: 109, h: 114, l: 108 },
    { o: 109, c: 105, h: 110, l: 104 },
    { o: 105, c: 100, h: 106, l: 99 },
    { o: 100, c: 104, h: 106, l: 98 },
    { o: 104, c: 109, h: 111, l: 103 },
    { o: 109, c: 113, h: 116, l: 108 },
    { o: 113, c: 110, h: 114, l: 109 },
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* Resistance line */}
      <line x1={20} y1={scaleY(115)} x2={380} y2={scaleY(115)} stroke="#ef5350" strokeWidth={1.5} strokeDasharray="6,3" />
      <text x={385} y={scaleY(115) + 4} fill="#ef5350" fontSize={10} fontWeight={600}>Resistance</text>
      {/* Support line */}
      <line x1={20} y1={scaleY(98)} x2={380} y2={scaleY(98)} stroke="#26a69a" strokeWidth={1.5} strokeDasharray="6,3" />
      <text x={385} y={scaleY(98) + 4} fill="#26a69a" fontSize={10} fontWeight={600}>Support</text>
      {/* Candles */}
      {candles.map((c, i) => (
        <Candle key={i} x={25 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={scaleY} baseY={190} />
      ))}
    </svg>
  );
}

// ─── Trend Diagram ────────────────────────────────────────────────────────────

function TrendDiagram() {
  const w = 400;
  const h = 200;
  const scaleY = (p: number) => 180 - (p - 90) * 3;
  const uptrend = [
    { o: 95, c: 99, h: 100, l: 94 },
    { o: 99, c: 97, h: 100, l: 96 },
    { o: 97, c: 103, h: 104, l: 96 },
    { o: 103, c: 101, h: 104, l: 100 },
    { o: 101, c: 107, h: 108, l: 100 },
    { o: 107, c: 105, h: 108, l: 104 },
    { o: 105, c: 112, h: 113, l: 104 },
    { o: 112, c: 110, h: 113, l: 109 },
    { o: 110, c: 116, h: 118, l: 109 },
  ];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* Trendline */}
      <line x1={30} y1={scaleY(94)} x2={350} y2={scaleY(109)} stroke="#2962ff" strokeWidth={1.5} strokeDasharray="6,3" />
      {/* HH / HL labels */}
      <text x={90} y={scaleY(104) - 8} fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
      <text x={60} y={scaleY(96) + 14} fill="#2962ff" fontSize={9} fontWeight={600}>HL</text>
      <text x={200} y={scaleY(108) - 8} fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
      <text x={160} y={scaleY(100) + 14} fill="#2962ff" fontSize={9} fontWeight={600}>HL</text>
      <text x={310} y={scaleY(118) - 8} fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
      <text x={270} y={scaleY(109) + 14} fill="#2962ff" fontSize={9} fontWeight={600}>HL</text>
      {/* Candles */}
      {uptrend.map((c, i) => (
        <Candle key={i} x={25 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={scaleY} baseY={190} />
      ))}
      <text x={200} y={16} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={700}>
        Uptrend: Higher Highs + Higher Lows
      </text>
    </svg>
  );
}

// ─── Multi-timeframe Diagram ──────────────────────────────────────────────────

function MultiTimeframeDiagram() {
  const scaleY = (p: number) => 100 - (p - 95) * 2.5;

  const daily = [
    { o: 100, c: 108, h: 110, l: 99 },
    { o: 108, c: 104, h: 109, l: 103 },
    { o: 104, c: 112, h: 114, l: 103 },
  ];
  const hourly = [
    { o: 100, c: 102, h: 103, l: 99 },
    { o: 102, c: 105, h: 106, l: 101 },
    { o: 105, c: 103, h: 106, l: 102 },
    { o: 103, c: 107, h: 108, l: 102 },
    { o: 107, c: 108, h: 110, l: 106 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">Daily (Direction)</p>
        <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
          {daily.map((c, i) => (
            <Candle key={i} x={20 + i * 55} open={c.o} close={c.c} high={c.h} low={c.l} width={28} scaleY={scaleY} baseY={110} />
          ))}
          <line x1={10} y1={scaleY(99)} x2={190} y2={scaleY(103)} stroke="#2962ff" strokeWidth={1} strokeDasharray="4,2" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">1H (Entry Timing)</p>
        <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
          {hourly.map((c, i) => (
            <Candle key={i} x={10 + i * 38} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={scaleY} baseY={110} />
          ))}
          {/* Entry arrow */}
          <polygon points="86,75 92,85 80,85" fill="#26a69a" />
          <text x={86} y={95} textAnchor="middle" fill="#26a69a" fontSize={8} fontWeight={600}>ENTRY</text>
        </svg>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("bg-surface-low border rounded-sm transition-all", open ? "border-primary/20" : "border-border/10")}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 w-full p-4 sm:px-5 text-left hover:bg-surface-high/30 transition-colors"
      >
        <Icon className={cn("h-4 w-4 shrink-0", open ? "text-primary" : "text-muted-foreground")} />
        <span className="flex-1 text-sm font-bold text-foreground">{title}</span>
        {badge && (
          <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm">
            {badge}
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="pt-0 px-4 sm:px-5 pb-5 space-y-4 border-t border-border/10">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Concept Card ─────────────────────────────────────────────────────────────

function ConceptCard({
  title,
  children,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "tip" | "warning" | "rule";
}) {
  const styles = {
    default: "border-border/10 bg-surface-mid",
    tip: "border-primary/20 bg-primary/5",
    warning: "border-destructive/20 bg-destructive/5",
    rule: "border-border/20 bg-surface-highest",
  };
  return (
    <div className={cn("rounded-sm border p-4 space-y-2", styles[variant])}>
      <h4 className={cn("text-xs font-bold", variant === "tip" ? "text-primary" : variant === "warning" ? "text-destructive" : "text-foreground")}>{title}</h4>
      <div className="text-sm text-muted-foreground space-y-1.5">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [lang, setLang] = useState<Lang>("en");

  // Persist language choice
  useEffect(() => {
    const saved = localStorage.getItem("ngs-learn-lang") as Lang | null;
    if (saved === "en" || saved === "th") setLang(saved);
  }, []);

  function toggleLang() {
    const next: Lang = lang === "en" ? "th" : "en";
    setLang(next);
    localStorage.setItem("ngs-learn-lang", next);
  }

  return (
    <AppShell title={lang === "en" ? "Learn to Trade" : "เรียนรู้การเทรด"}>
      <div className="max-w-4xl mx-auto space-y-4 pb-12">
        {/* Header + Language Toggle */}
        <div className="space-y-2 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              {t("pageTitle", lang)}
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="shrink-0 gap-2 text-xs border-border/20 hover:bg-surface-high/50"
            >
              <Languages className="h-3.5 w-3.5" />
              {lang === "en" ? "🇹🇭 ไทย" : "🇺🇸 English"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("pageSubtitle", lang)}
          </p>
        </div>

        {/* ── 1. Market Mechanics ──────────────────────────────────── */}
        <Section title={t("marketMechanics", lang)} icon={Zap} defaultOpen={true} badge={t("foundation", lang)}>
          <p className="text-sm text-muted-foreground">{t("mm_intro", lang)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConceptCard title={t("howPriceMoves", lang)}>
              <p>{t("mm_buyers", lang)}</p>
              <p>{t("mm_sellers", lang)}</p>
              <p>{t("mm_equal", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("orderFlow", lang)}>
              <p>{t("mm_market_orders", lang)}</p>
              <p>{t("mm_limit_orders", lang)}</p>
              <p>{t("mm_volume", lang)}</p>
            </ConceptCard>
          </div>
          <ConceptCard title={t("bidAskSpread", lang)} variant="tip">
            <p>{t("mm_spread", lang)}</p>
          </ConceptCard>
        </Section>

        {/* ── 2. Definition of Trading ─────────────────────────────── */}
        <Section title={t("definitionOfTrading", lang)} icon={Target}>
          <ConceptCard title={t("tradingNotGambling", lang)}>
            <p>{t("dt_probability", lang)}</p>
          </ConceptCard>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-sm border border-border/10 bg-surface-mid p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t("yourJob", lang)}</p>
              <p className="text-sm font-semibold">{t("identifyOutcomes", lang)}</p>
            </div>
            <div className="rounded-sm border border-border/10 bg-surface-mid p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t("yourEdge", lang)}</p>
              <p className="text-sm font-semibold">{t("useProbability", lang)}</p>
            </div>
            <div className="rounded-sm border border-border/10 bg-surface-mid p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{t("yourMeasure", lang)}</p>
              <p className="text-sm font-semibold">{t("evaluateExpectancy", lang)}</p>
            </div>
          </div>
          <ConceptCard title={t("expectancyFormula", lang)} variant="rule">
            <p className="font-mono text-xs">
              Expectancy = (Win% x Avg Win) - (Loss% x Avg Loss)
            </p>
            <p>{t("dt_formula_desc", lang)}</p>
            <p>{t("dt_example", lang)}</p>
            <p className="font-mono text-xs">= (0.30 x 3.6) - (0.70 x 1.0) = 1.08 - 0.70 = <strong>+0.38R</strong></p>
          </ConceptCard>
        </Section>

        {/* ── 3. Chart Reading Layers ──────────────────────────────── */}
        <Section title={t("chartReadingLayers", lang)} icon={Layers} badge={t("core", lang)}>
          <p className="text-sm text-muted-foreground mb-2">{t("crl_intro", lang)}</p>

          <Tabs defaultValue="anatomy" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
              <TabsTrigger value="anatomy" className="text-xs">{t("anatomy", lang)}</TabsTrigger>
              <TabsTrigger value="patterns" className="text-xs">{t("patterns", lang)}</TabsTrigger>
              <TabsTrigger value="wicks" className="text-xs">{t("wicks", lang)}</TabsTrigger>
              <TabsTrigger value="body" className="text-xs">{t("body", lang)}</TabsTrigger>
              <TabsTrigger value="volume" className="text-xs">{t("volume", lang)}</TabsTrigger>
              <TabsTrigger value="context" className="text-xs">{t("context", lang)}</TabsTrigger>
            </TabsList>

            <TabsContent value="anatomy" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("candlestickAnatomy", lang)}</h4>
              <CandleAnatomy />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ConceptCard title={t("bullishCandle", lang)}>
                  <p><strong>{t("bull_close_gt_open", lang)}</strong></p>
                  <p>{t("bull_body", lang)}</p>
                  <p>{t("bull_upper", lang)}</p>
                  <p>{t("bull_lower", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("bearishCandle", lang)}>
                  <p><strong>{t("bear_close_lt_open", lang)}</strong></p>
                  <p>{t("bear_body", lang)}</p>
                  <p>{t("bear_lower", lang)}</p>
                  <p>{t("bear_upper", lang)}</p>
                </ConceptCard>
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("keyPatterns", lang)}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-white text-xs">{t("bullishReversal", lang)}</Badge>
                  <PatternDiagram pattern="hammer" />
                </div>
                <div className="space-y-2">
                  <Badge variant="destructive" className="text-xs">{t("bearishReversal", lang)}</Badge>
                  <PatternDiagram pattern="shooting-star" />
                </div>
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-white text-xs">{t("strongReversal", lang)}</Badge>
                  <PatternDiagram pattern="engulfing" />
                </div>
                <div className="space-y-2">
                  <Badge variant="secondary" className="text-xs">{t("indecision", lang)}</Badge>
                  <PatternDiagram pattern="doji" />
                </div>
                <div className="space-y-2">
                  <Badge className="bg-green-600 text-white text-xs">{t("continuation", lang)}</Badge>
                  <PatternDiagram pattern="three-soldiers" />
                </div>
                <div className="space-y-2">
                  <Badge variant="destructive" className="text-xs">{t("reversalAtTop", lang)}</Badge>
                  <PatternDiagram pattern="evening-star" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="wicks" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("readingWicks", lang)}</h4>
              <ConceptCard title={t("wicksTitle", lang)}>
                <p>{t("wicks_upper", lang)}</p>
                <p>{t("wicks_lower", lang)}</p>
                <p>{t("wicks_none", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("wickBodyRatio", lang)} variant="rule">
                <p>{t("wicks_ratio", lang)}</p>
                <p>{t("wicks_pinbar", lang)}</p>
              </ConceptCard>
            </TabsContent>

            <TabsContent value="body" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("readingBody", lang)}</h4>
              <ConceptCard title={t("bodyConviction", lang)}>
                <p>{t("body_large", lang)}</p>
                <p>{t("body_small", lang)}</p>
                <p>{t("body_doji", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("shrinkingBodies", lang)} variant="warning">
                <p>{t("body_shrinking", lang)}</p>
              </ConceptCard>
            </TabsContent>

            <TabsContent value="volume" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("volumeConfirmation", lang)}</h4>
              <ConceptCard title={t("volumeValidates", lang)}>
                <p>{t("vol_high_green", lang)}</p>
                <p>{t("vol_high_red", lang)}</p>
                <p>{t("vol_low", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("volumeDivergence", lang)} variant="warning">
                <p>{t("vol_divergence", lang)}</p>
              </ConceptCard>
            </TabsContent>

            <TabsContent value="context" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("contextIsKing", lang)}</h4>
              <ConceptCard title={t("sameCandle", lang)} variant="rule">
                <p>{t("ctx_hammer_support", lang)}</p>
                <p>{t("ctx_hammer_middle", lang)}</p>
                <p>{t("ctx_hammer_resistance", lang)}</p>
                <p className="font-semibold mt-2">{t("ctx_where", lang)}</p>
              </ConceptCard>
            </TabsContent>
          </Tabs>
        </Section>

        {/* ── 4. Core Mechanics ─────────────────────────────────────── */}
        <Section title={t("coreMechanics", lang)} icon={BarChart3} badge={t("essential", lang)}>
          <Tabs defaultValue="sr" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="sr" className="text-xs">{t("supportAndResistance", lang)}</TabsTrigger>
              <TabsTrigger value="structure" className="text-xs">{t("marketStructure", lang)}</TabsTrigger>
              <TabsTrigger value="trend" className="text-xs">{t("trendVsRange", lang)}</TabsTrigger>
              <TabsTrigger value="mtf" className="text-xs">{t("multiTimeframe", lang)}</TabsTrigger>
            </TabsList>

            <TabsContent value="sr" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("supportAndResistance", lang)}</h4>
              <SupportResistanceDiagram />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ConceptCard title={t("support", lang)} variant="tip">
                  <p>{t("support_desc", lang)}</p>
                  <p>{t("support_bounce", lang)}</p>
                  <p>{t("support_break", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("resistance", lang)} variant="warning">
                  <p>{t("resistance_desc", lang)}</p>
                  <p>{t("resistance_ceiling", lang)}</p>
                  <p>{t("resistance_break", lang)}</p>
                </ConceptCard>
              </div>
              <ConceptCard title={t("keyLevels", lang)} variant="rule">
                <p>{t("keyLevels_desc", lang)}</p>
              </ConceptCard>
            </TabsContent>

            <TabsContent value="structure" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("marketStructureTitle", lang)}</h4>
              <ConceptCard title={t("hhHl", lang)}>
                <p>{t("hh_hl_desc", lang)}</p>
                <p>{t("hh_hl_break", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("lhLl", lang)}>
                <p>{t("lh_ll_desc", lang)}</p>
                <p>{t("lh_ll_break", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("bosCore", lang)} variant="rule">
                <p>{t("bos_violates", lang)}</p>
                <p>{t("bos_early", lang)}</p>
                <p>{t("bos_wait", lang)}</p>
              </ConceptCard>
            </TabsContent>

            <TabsContent value="trend" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("trendVsRangeTitle", lang)}</h4>
              <TrendDiagram />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <ConceptCard title={t("tradingTrends", lang)} variant="tip">
                  <p>{t("trend_buy_pullback", lang)}</p>
                  <p>{t("trend_sell_rally", lang)}</p>
                  <p>{t("trend_friend", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("tradingRanges", lang)}>
                  <p>{t("range_buy_sell", lang)}</p>
                  <p>{t("range_breakout", lang)}</p>
                  <p>{t("range_false", lang)}</p>
                </ConceptCard>
              </div>
            </TabsContent>

            <TabsContent value="mtf" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("mtfTitle", lang)}</h4>
              <MultiTimeframeDiagram />
              <ConceptCard title={t("topDownApproach", lang)} variant="rule">
                <p>{t("mtf_higher", lang)}</p>
                <p>{t("mtf_middle", lang)}</p>
                <p>{t("mtf_lower", lang)}</p>
                <p className="mt-2 font-semibold">{t("mtf_never", lang)}</p>
              </ConceptCard>
            </TabsContent>
          </Tabs>
        </Section>

        {/* ── 5. Smart Money Concepts ──────────────────────────────── */}
        <Section title={t("smartMoneyConcepts", lang)} icon={Eye} badge={t("advanced", lang)}>
          <p className="text-sm text-muted-foreground">
            {t("smc_intro", lang)}
          </p>

          <Tabs defaultValue="bos" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
              <TabsTrigger value="bos" className="text-xs">{t("breaksInStructure", lang)}</TabsTrigger>
              <TabsTrigger value="fvg" className="text-xs">{t("fairValueGaps", lang)}</TabsTrigger>
              <TabsTrigger value="imbalance" className="text-xs">{t("imbalanceAreas", lang)}</TabsTrigger>
              <TabsTrigger value="reaction" className="text-xs">{t("reactionZones", lang)}</TabsTrigger>
            </TabsList>

            {/* ── Breaks in Structure ──────────────────────────────────── */}
            <TabsContent value="bos" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("bosCHoCH", lang)}</h4>

              {/* BOS Diagram */}
              <Card className="border-border/10 bg-surface-mid">
                <CardContent className="p-4">
                  <svg viewBox="0 0 420 200" className="w-full">
                    {/* Uptrend with BOS */}
                    {[
                      { o: 100, c: 105, h: 106, l: 99 },
                      { o: 105, c: 103, h: 106, l: 102 },
                      { o: 103, c: 109, h: 110, l: 102 },
                      { o: 109, c: 107, h: 110, l: 106 },
                      { o: 107, c: 113, h: 114, l: 106 },
                      { o: 113, c: 111, h: 114, l: 110 },
                      { o: 111, c: 115, h: 117, l: 110 },
                      /* CHoCH — fails to make HH, then breaks HL */
                      { o: 115, c: 112, h: 116, l: 111 },
                      { o: 112, c: 109, h: 113, l: 108 },
                      { o: 109, c: 106, h: 110, l: 105 },
                    ].map((c, i) => (
                      <Candle key={i} x={15 + i * 40} open={c.o} close={c.c} high={c.h} low={c.l} width={20} scaleY={(p) => 180 - (p - 97) * 7} baseY={190} />
                    ))}
                    {/* HH labels */}
                    <text x={115} y={18} textAnchor="middle" fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
                    <text x={195} y={10} textAnchor="middle" fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
                    <text x={275} y={5} textAnchor="middle" fill="#26a69a" fontSize={9} fontWeight={600}>HH</text>
                    {/* HL labels */}
                    <text x={75} y={155} textAnchor="middle" fill="#2962ff" fontSize={9} fontWeight={600}>HL</text>
                    <text x={155} y={140} textAnchor="middle" fill="#2962ff" fontSize={9} fontWeight={600}>HL</text>
                    {/* CHoCH label */}
                    <text x={335} y={90} textAnchor="middle" fill="#ef5350" fontSize={10} fontWeight={700}>CHoCH</text>
                    <line x1={230} y1={110} x2={400} y2={110} stroke="#ef5350" strokeWidth={1.5} strokeDasharray="5,3" />
                    <text x={410} y={113} fill="#ef5350" fontSize={8}>HL broken</text>
                    {/* Arrow showing the break */}
                    <polygon points="370,160 376,150 364,150" fill="#ef5350" />
                  </svg>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t("bos_diagram_desc", lang)}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConceptCard title={t("bosTitle", lang)}>
                  <p>{t("bos_desc", lang)}</p>
                  <p className="mt-1">{t("bos_bullish", lang)}</p>
                  <p>{t("bos_bearish", lang)}</p>
                  <p className="mt-1 font-semibold">{t("bos_intact", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("chochTitle", lang)} variant="warning">
                  <p>{t("choch_desc", lang)}</p>
                  <p className="mt-1">{t("choch_bullish", lang)}</p>
                  <p>{t("choch_bearish", lang)}</p>
                  <p className="mt-1 font-semibold">{t("choch_warning", lang)}</p>
                </ConceptCard>
              </div>

              <ConceptCard title={t("howToTradeBOS", lang)} variant="rule">
                <p>{t("bos_entries", lang)}</p>
                <p className="mt-1">{t("choch_entries", lang)}</p>
                <p>{t("choch_step1", lang)}</p>
                <p>{t("choch_step2", lang)}</p>
                <p>{t("choch_step3", lang)}</p>
              </ConceptCard>
            </TabsContent>

            {/* ── Fair Value Gaps ──────────────────────────────────────── */}
            <TabsContent value="fvg" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("fvgTitle", lang)}</h4>

              {/* FVG Diagram */}
              <Card className="border-border/10 bg-surface-mid">
                <CardContent className="p-4">
                  <svg viewBox="0 0 400 200" className="w-full">
                    {[
                      { o: 102, c: 105, h: 106, l: 101 },
                      { o: 105, c: 107, h: 108, l: 104 },
                      /* Candle 1 — before gap */
                      { o: 107, c: 109, h: 110, l: 106 },
                      /* Candle 2 — big impulse creating gap */
                      { o: 110, c: 118, h: 119, l: 109 },
                      /* Candle 3 — after gap */
                      { o: 118, c: 120, h: 122, l: 116 },
                      { o: 120, c: 119, h: 121, l: 118 },
                      /* Price returns to fill */
                      { o: 119, c: 116, h: 120, l: 115 },
                      { o: 116, c: 113, h: 117, l: 112 },
                      { o: 113, c: 117, h: 118, l: 112 },
                    ].map((c, i) => (
                      <Candle key={i} x={20 + i * 40} open={c.o} close={c.c} high={c.h} low={c.l} width={22} scaleY={(p) => 185 - (p - 99) * 6.5} baseY={190} />
                    ))}
                    {/* FVG zone highlight */}
                    <rect x={130} y={185 - (116 - 99) * 6.5} width={80} height={(116 - 110) * 6.5} fill="#2962ff" opacity={0.15} rx={2} />
                    <line x1={130} y1={185 - (116 - 99) * 6.5} x2={210} y2={185 - (116 - 99) * 6.5} stroke="#2962ff" strokeWidth={1} strokeDasharray="4,2" />
                    <line x1={130} y1={185 - (110 - 99) * 6.5} x2={210} y2={185 - (110 - 99) * 6.5} stroke="#2962ff" strokeWidth={1} strokeDasharray="4,2" />
                    {/* FVG label */}
                    <text x={170} y={185 - (113 - 99) * 6.5} textAnchor="middle" fill="#2962ff" fontSize={9} fontWeight={700}>FVG</text>
                    {/* Arrow showing fill */}
                    <line x1={300} y1={185 - (117 - 99) * 6.5} x2={300} y2={185 - (113 - 99) * 6.5} stroke="#ef5350" strokeWidth={1.5} markerEnd="url(#arrowRed)" />
                    <text x={320} y={185 - (114 - 99) * 6.5} fill="#26a69a" fontSize={8} fontWeight={600}>Gap Fill</text>
                    {/* Candle 1 high label */}
                    <text x={115} y={185 - (110 - 99) * 6.5 + 12} fill="#2962ff" fontSize={7}>C1 High</text>
                    {/* Candle 3 low label */}
                    <text x={215} y={185 - (116 - 99) * 6.5 - 4} fill="#2962ff" fontSize={7}>C3 Low</text>
                  </svg>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t("fvg_diagram_desc", lang)}
                  </p>
                </CardContent>
              </Card>

              <ConceptCard title={t("whatIsFVG", lang)}>
                <p>{t("fvg_desc", lang)}</p>
                <p className="mt-1">{t("fvg_bullish", lang)}</p>
                <p>{t("fvg_bearish", lang)}</p>
              </ConceptCard>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConceptCard title={t("whyFVGFilled", lang)} variant="tip">
                  <p>{t("fvg_efficiency", lang)}</p>
                  <p className="mt-1">{t("fvg_elastic", lang)}</p>
                  <p className="mt-1">{t("fvg_percent", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("tradingFVGs", lang)} variant="rule">
                  <p>{t("fvg_entry", lang)}</p>
                  <p>{t("fvg_stop", lang)}</p>
                  <p>{t("fvg_target", lang)}</p>
                  <p className="mt-1">{t("fvg_best", lang)}</p>
                </ConceptCard>
              </div>
            </TabsContent>

            {/* ── Imbalance Areas ──────────────────────────────────────── */}
            <TabsContent value="imbalance" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("imbalanceTitle", lang)}</h4>

              {/* Imbalance Diagram */}
              <Card className="border-border/10 bg-surface-mid">
                <CardContent className="p-4">
                  <svg viewBox="0 0 400 200" className="w-full">
                    {/* Balanced price action */}
                    {[
                      { o: 105, c: 107, h: 108, l: 104 },
                      { o: 107, c: 106, h: 108, l: 105 },
                      { o: 106, c: 108, h: 109, l: 105 },
                    ].map((c, i) => (
                      <Candle key={`bal-${i}`} x={20 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 7} baseY={190} />
                    ))}
                    {/* Imbalance — aggressive move */}
                    {[
                      { o: 108, c: 113, h: 114, l: 107 },
                      { o: 113, c: 118, h: 119, l: 112 },
                      { o: 118, c: 122, h: 123, l: 117 },
                    ].map((c, i) => (
                      <Candle key={`imb-${i}`} x={130 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 7} baseY={190} />
                    ))}
                    {/* Balanced again */}
                    {[
                      { o: 122, c: 121, h: 123, l: 120 },
                      { o: 121, c: 122, h: 123, l: 120 },
                      { o: 122, c: 121, h: 123, l: 119 },
                    ].map((c, i) => (
                      <Candle key={`after-${i}`} x={240 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 7} baseY={190} />
                    ))}
                    {/* Imbalance zone */}
                    <rect x={125} y={180 - (119 - 98) * 7} width={120} height={(119 - 108) * 7} fill="#26a69a" opacity={0.1} rx={2} />
                    <text x={185} y={180 - (113.5 - 98) * 7} textAnchor="middle" fill="#26a69a" fontSize={10} fontWeight={700}>IMBALANCE</text>
                    {/* Labels */}
                    <text x={60} y={15} fill="#9e9e9e" fontSize={9}>Balanced</text>
                    <text x={155} y={15} fill="#26a69a" fontSize={9} fontWeight={600}>Aggressive Move</text>
                    <text x={275} y={15} fill="#9e9e9e" fontSize={9}>Balanced</text>
                    {/* Buyers vs sellers annotation */}
                    <text x={185} y={180 - (108 - 98) * 7 + 14} fill="#26a69a" fontSize={7}>Buyers &gt;&gt;&gt; Sellers</text>
                  </svg>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t("imbalance_diagram_desc", lang)}
                  </p>
                </CardContent>
              </Card>

              <ConceptCard title={t("whatCreatesImbalance", lang)}>
                <p>{t("imb_desc", lang)}</p>
                <p className="mt-1">{t("imb_visual", lang)}</p>
                <p>{t("imb_large", lang)}</p>
                <p>{t("imb_no_wick", lang)}</p>
                <p>{t("imb_volume", lang)}</p>
                <p>{t("imb_displacement", lang)}</p>
              </ConceptCard>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConceptCard title={t("imbVsFVG", lang)} variant="rule">
                  <p>{t("imb_fvg_is", lang)}</p>
                  <p>{t("imb_area_is", lang)}</p>
                  <p className="mt-1">{t("imb_forest", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("tradingImbalance", lang)} variant="tip">
                  <p>{t("imb_bullish", lang)}</p>
                  <p>{t("imb_bearish", lang)}</p>
                  <p className="mt-1">{t("imb_valid", lang)}</p>
                </ConceptCard>
              </div>

              <ConceptCard title={t("institutionalProfiles", lang)}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 text-center">
                    <p className="text-xs text-green-400 font-semibold">{t("strongBuying", lang)}</p>
                    <svg viewBox="0 0 40 60" className="w-8 h-12 mx-auto my-1">
                      <line x1={20} y1={5} x2={20} y2={10} stroke="#26a69a" strokeWidth={1.5} />
                      <rect x={10} y={10} width={20} height={40} fill="#26a69a" rx={1} />
                      <line x1={20} y1={50} x2={20} y2={55} stroke="#26a69a" strokeWidth={1.5} />
                    </svg>
                    <p className="text-xs text-muted-foreground">{t("bigBodyTinyWicks", lang)}</p>
                  </div>
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-2 text-center">
                    <p className="text-xs text-red-400 font-semibold">{t("strongSelling", lang)}</p>
                    <svg viewBox="0 0 40 60" className="w-8 h-12 mx-auto my-1">
                      <line x1={20} y1={5} x2={20} y2={10} stroke="#ef5350" strokeWidth={1.5} />
                      <rect x={10} y={10} width={20} height={40} fill="#ef5350" rx={1} />
                      <line x1={20} y1={50} x2={20} y2={55} stroke="#ef5350" strokeWidth={1.5} />
                    </svg>
                    <p className="text-xs text-muted-foreground">{t("bigBodyTinyWicks", lang)}</p>
                  </div>
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 text-center">
                    <p className="text-xs text-green-400 font-semibold">{t("rejection", lang)}</p>
                    <svg viewBox="0 0 40 60" className="w-8 h-12 mx-auto my-1">
                      <line x1={20} y1={5} x2={20} y2={8} stroke="#26a69a" strokeWidth={1.5} />
                      <rect x={12} y={8} width={16} height={8} fill="#26a69a" rx={1} />
                      <line x1={20} y1={16} x2={20} y2={55} stroke="#26a69a" strokeWidth={1.5} />
                    </svg>
                    <p className="text-xs text-muted-foreground">{t("longLowerWick", lang)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2 text-center">
                    <p className="text-xs text-muted-foreground font-semibold">{t("indecisionCandle", lang)}</p>
                    <svg viewBox="0 0 40 60" className="w-8 h-12 mx-auto my-1">
                      <line x1={20} y1={5} x2={20} y2={27} stroke="#9e9e9e" strokeWidth={1.5} />
                      <rect x={14} y={27} width={12} height={3} fill="#9e9e9e" rx={1} />
                      <line x1={20} y1={30} x2={20} y2={55} stroke="#9e9e9e" strokeWidth={1.5} />
                    </svg>
                    <p className="text-xs text-muted-foreground">{t("dojiNoImbalance", lang)}</p>
                  </div>
                </div>
              </ConceptCard>
            </TabsContent>

            {/* ── Reaction Zones ───────────────────────────────────────── */}
            <TabsContent value="reaction" className="space-y-4 mt-4">
              <h4 className="text-sm font-semibold">{t("reactionTitle", lang)}</h4>

              {/* Order Block Diagram */}
              <Card className="border-border/10 bg-surface-mid">
                <CardContent className="p-4">
                  <svg viewBox="0 0 420 200" className="w-full">
                    {/* Downtrend candles before the order block */}
                    {[
                      { o: 118, c: 115, h: 119, l: 114 },
                      { o: 115, c: 112, h: 116, l: 111 },
                      { o: 112, c: 109, h: 113, l: 108 },
                    ].map((c, i) => (
                      <Candle key={`pre-${i}`} x={15 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 6} baseY={190} />
                    ))}
                    {/* ORDER BLOCK — last bearish candle before bullish move */}
                    <Candle x={120} open={109} close={106} high={110} low={105} width={18} scaleY={(p) => 180 - (p - 98) * 6} baseY={190} />
                    {/* Order block zone */}
                    <rect x={115} y={180 - (110 - 98) * 6} width={140} height={(110 - 105) * 6} fill="#2962ff" opacity={0.12} rx={2} />
                    <text x={185} y={180 - (107.5 - 98) * 6} textAnchor="middle" fill="#2962ff" fontSize={8} fontWeight={700}>ORDER BLOCK</text>
                    {/* Bullish displacement up */}
                    {[
                      { o: 106, c: 112, h: 113, l: 105 },
                      { o: 112, c: 117, h: 118, l: 111 },
                      { o: 117, c: 122, h: 123, l: 116 },
                    ].map((c, i) => (
                      <Candle key={`disp-${i}`} x={155 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 6} baseY={190} />
                    ))}
                    {/* Price returns to OB */}
                    {[
                      { o: 122, c: 119, h: 123, l: 118 },
                      { o: 119, c: 116, h: 120, l: 115 },
                      { o: 116, c: 113, h: 117, l: 112 },
                      /* Bounce from OB */
                      { o: 108, c: 114, h: 115, l: 107 },
                    ].map((c, i) => (
                      <Candle key={`ret-${i}`} x={260 + i * 35} open={c.o} close={c.c} high={c.h} low={c.l} width={18} scaleY={(p) => 180 - (p - 98) * 6} baseY={190} />
                    ))}
                    {/* Entry arrow */}
                    <polygon points="380,125 386,115 374,115" fill="#26a69a" />
                    <text x={390} y={110} fill="#26a69a" fontSize={8} fontWeight={600}>BUY</text>
                  </svg>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t("reactionDiagramDesc", lang)}
                  </p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConceptCard title={t("demandZones", lang)} variant="tip">
                  <p>{t("demand_desc", lang)}</p>
                  <p className="mt-1">{t("demand_why", lang)}</p>
                  <p className="mt-1">{t("demand_how", lang)}</p>
                  <p>{t("demand_step1", lang)}</p>
                  <p>{t("demand_step2", lang)}</p>
                  <p>{t("demand_step3", lang)}</p>
                  <p>{t("demand_step4", lang)}</p>
                </ConceptCard>
                <ConceptCard title={t("supplyZones", lang)} variant="warning">
                  <p>{t("supply_desc", lang)}</p>
                  <p className="mt-1">{t("supply_why", lang)}</p>
                  <p className="mt-1">{t("demand_how", lang)}</p>
                  <p>{t("supply_step1", lang)}</p>
                  <p>{t("supply_step2", lang)}</p>
                  <p>{t("supply_step3", lang)}</p>
                  <p>{t("supply_step4", lang)}</p>
                </ConceptCard>
              </div>

              <ConceptCard title={t("liquidityStopHunts", lang)} variant="rule">
                <p>{t("liq_intro", lang)}</p>
                <p className="mt-1">{t("liq_where", lang)}</p>
                <p>{t("liq_below_support", lang)}</p>
                <p>{t("liq_above_resistance", lang)}</p>
                <p>{t("liq_equal", lang)}</p>
                <p className="mt-2 font-semibold">{t("liq_sequence", lang)}</p>
                <p>{t("liq_step1", lang)}</p>
                <p>{t("liq_step2", lang)}</p>
                <p>{t("liq_step3", lang)}</p>
                <p>{t("liq_step4", lang)}</p>
                <p className="mt-1">{t("liq_why", lang)}</p>
              </ConceptCard>

              <ConceptCard title={t("puttingTogether", lang)} variant="tip">
                <p>{t("together_intro", lang)}</p>
                <div className="rounded-md border border-border bg-card p-3 mt-2 space-y-1 text-xs font-mono">
                  <p>1. Higher TF trend direction (Daily uptrend) ✓</p>
                  <p>2. Price returns to a demand zone / order block ✓</p>
                  <p>3. FVG sits inside the order block ✓</p>
                  <p>4. Liquidity was swept (stop hunt wick) ✓</p>
                  <p>5. Lower TF shows CHoCH back in trend direction ✓</p>
                  <p className="text-green-400 font-bold mt-2">→ High-probability entry with tight stop</p>
                </div>
              </ConceptCard>
            </TabsContent>
          </Tabs>
        </Section>

        {/* ── 6. Trader Mindset ────────────────────────────────────── */}
        <Section title={t("traderMindset", lang)} icon={Brain}>
          <ConceptCard title={t("thinkProbabilities", lang)}>
            <p>{t("tm_intro", lang)}</p>
            <p>{t("tm_winrate", lang)}</p>
          </ConceptCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConceptCard title={t("processOverOutcome", lang)} variant="tip">
              <p>{t("tm_good_trade", lang)}</p>
              <p>{t("tm_bad_trade", lang)}</p>
              <p>{t("tm_judge", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("detachFromMoney", lang)} variant="rule">
              <p>{t("tm_runits", lang)}</p>
              <p>{t("tm_detach", lang)}</p>
            </ConceptCard>
          </div>
        </Section>

        {/* ── 7. Psychological Traps ───────────────────────────────── */}
        <Section title={t("psychologicalTraps", lang)} icon={ShieldAlert}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConceptCard title={t("revengeTrading", lang)} variant="warning">
              <p>{t("pt_revenge", lang)}</p>
              <p>{t("pt_revenge_fix", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("fomo", lang)} variant="warning">
              <p>{t("pt_fomo", lang)}</p>
              <p>{t("pt_fomo_fix", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("overtrading", lang)} variant="warning">
              <p>{t("pt_overtrading", lang)}</p>
              <p>{t("pt_overtrading_fix", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("movingStopLoss", lang)} variant="warning">
              <p>{t("pt_moving_stop", lang)}</p>
              <p>{t("pt_moving_stop_fix", lang)}</p>
            </ConceptCard>
          </div>
        </Section>

        {/* ── 8. Trading Math ──────────────────────────────────────── */}
        <Section title={t("tradingMath", lang)} icon={Scale} badge={t("critical", lang)}>
          <ConceptCard title={t("positionSizingFormula", lang)} variant="rule">
            <div className="bg-card rounded-md border border-border p-3 text-center">
              <p className="font-mono text-base sm:text-lg font-bold text-primary">
                Shares = $ Risk / (Entry - Stop Loss)
              </p>
            </div>
            <p className="mt-2">{t("tm_formula_example", lang)}</p>
            <p className="font-mono text-sm">$100 / ($153.52 - $150.52) = $100 / $3.00 = <strong>33 shares</strong></p>
            <p>{t("tm_position_value", lang)}</p>
          </ConceptCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConceptCard title={t("onePercentRule", lang)} variant="tip">
              <p>{t("tm_1pct", lang)}</p>
              <p>{t("tm_1pct_example", lang)}</p>
              <p>{t("tm_1pct_survival", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("riskRewardRatio", lang)}>
              <p>{t("tm_rr", lang)}</p>
              <p>{t("tm_rr_math", lang)}</p>
              <p>At 3:1, you only need 25% win rate. The math is on your side.</p>
            </ConceptCard>
          </div>
          {/* Bell Curve — Distribution of Trade Results */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h4 className="text-sm font-semibold">{t("bellCurveTitle", lang)}</h4>
              <p className="text-sm text-muted-foreground">{t("bellCurve_intro", lang)}</p>

              {/* SVG Bell Curve */}
              <div className="flex justify-center">
                <svg viewBox="0 0 420 220" className="w-full max-w-md">
                  {/* Axis lines */}
                  <line x1={50} y1={180} x2={390} y2={180} stroke="currentColor" strokeWidth={1} className="text-muted-foreground" />
                  <line x1={50} y1={180} x2={50} y2={20} stroke="currentColor" strokeWidth={1} className="text-muted-foreground" />
                  {/* Axis labels */}
                  <text x={220} y={210} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>{t("bellCurve_xAxis", lang)}</text>
                  <text x={15} y={100} textAnchor="middle" className="fill-muted-foreground" fontSize={10} transform="rotate(-90,15,100)">{t("bellCurve_yAxis", lang)}</text>
                  {/* Bell curve path */}
                  <path
                    d="M60,178 Q100,175 130,165 Q160,140 180,100 Q195,60 220,40 Q245,60 240,100 Q260,140 290,165 Q320,175 360,178"
                    fill="none"
                    stroke="#26a69a"
                    strokeWidth={2.5}
                  />
                  {/* Filled area under curve */}
                  <path
                    d="M60,178 Q100,175 130,165 Q160,140 180,100 Q195,60 220,40 Q245,60 240,100 Q260,140 290,165 Q320,175 360,178 Z"
                    fill="#26a69a"
                    opacity={0.08}
                  />
                  {/* Center line (expectancy) */}
                  <line x1={220} y1={38} x2={220} y2={180} stroke="#26a69a" strokeWidth={2} strokeDasharray="6,3" />
                  <circle cx={220} cy={180} r={4} fill="#26a69a" />
                  {/* Expectancy label */}
                  <text x={300} y={55} textAnchor="start" fill="#26a69a" fontSize={10} fontWeight={700}>{t("bellCurve_avgResult", lang)}</text>
                  <text x={300} y={68} textAnchor="start" fill="#26a69a" fontSize={9}>({t("bellCurve_expectancy", lang)})</text>
                  <line x1={222} y1={50} x2={298} y2={55} stroke="#26a69a" strokeWidth={1} markerEnd="url(#arrowGreen)" />
                  {/* Scatter dots */}
                  {[
                    [85,175],[95,172],[108,170],[115,168],[125,163],[130,160],[138,155],[145,150],[150,145],
                    [158,138],[165,128],[170,120],[175,110],[180,100],[185,92],[190,80],[195,72],[200,60],
                    [205,55],[210,48],[215,42],[220,40],[225,42],[230,48],[235,55],[240,62],[245,72],
                    [250,82],[255,95],[260,108],[265,118],[270,130],[278,142],[285,152],[292,160],
                    [300,165],[310,170],[320,173],[335,176],[350,178],
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy! - 2 + Math.random() * 12} r={2.5} fill="#787b86" opacity={0.45} />
                  ))}
                  {/* Left/Right zone labels */}
                  <text x={100} y={155} textAnchor="middle" fill="#ef5350" fontSize={8} opacity={0.7}>{t("bellCurve_losses", lang)}</text>
                  <text x={340} y={155} textAnchor="middle" fill="#26a69a" fontSize={8} opacity={0.7}>{t("bellCurve_wins", lang)}</text>
                </svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground font-semibold">{t("bellCurve_most", lang)}</p>
                  <p className="text-sm mt-1">{t("bellCurve_most_desc", lang)}</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground font-semibold">{t("bellCurve_some", lang)}</p>
                  <p className="text-sm mt-1">{t("bellCurve_some_desc", lang)}</p>
                </div>
                <div className="rounded-md border border-border bg-card p-3 text-center">
                  <p className="text-xs text-muted-foreground font-semibold">{t("bellCurve_few", lang)}</p>
                  <p className="text-sm mt-1">{t("bellCurve_few_desc", lang)}</p>
                </div>
              </div>

              <ConceptCard title={t("bellCurve_centerTitle", lang)} variant="rule">
                <p>{t("bellCurve_center_desc", lang)}</p>
              </ConceptCard>
            </CardContent>
          </Card>

          {/* Expectancy Formula Breakdown */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h4 className="text-sm font-semibold">{t("expectancyBreakdownTitle", lang)}</h4>
              <p className="text-sm text-muted-foreground">{t("expectancy_math_def", lang)}</p>

              {/* Formula visual */}
              <div className="bg-card rounded-lg border border-border p-4 sm:p-6 text-center space-y-4">
                <p className="font-mono text-sm sm:text-base font-bold text-foreground">
                  Expectancy = (<span className="text-green-400">Win% x Avg Win Size</span>) - (<span className="text-red-400">Loss% x Avg Loss Size</span>)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3">
                    <p className="text-xs text-green-400 font-semibold mb-1">{t("exp_engine", lang)}</p>
                    <p className="text-sm text-muted-foreground">{t("exp_engine_desc", lang)}</p>
                  </div>
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
                    <p className="text-xs text-red-400 font-semibold mb-1">{t("exp_cost", lang)}</p>
                    <p className="text-sm text-muted-foreground">{t("exp_cost_desc", lang)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Size — True Performance */}
          <Card className="border-border/10 bg-surface-mid">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <h4 className="text-sm font-semibold">{t("sampleSizeTitle", lang)}</h4>
              <p className="text-sm text-muted-foreground">{t("sampleSize_intro", lang)}</p>

              {/* 3-stage SVG progression */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {/* Stage 1: 5 trades — scattered noise */}
                <div className="text-center space-y-2">
                  <p className="text-xs font-semibold">{t("ss_5trades", lang)}</p>
                  <div className="rounded-md border border-border bg-card p-2 aspect-square flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full">
                      <line x1={10} y1={90} x2={90} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                      <line x1={10} y1={10} x2={10} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                      {/* Scattered dots */}
                      {[[25,30],[55,70],[40,55],[75,25],[60,80]].map(([cx,cy],i) => (
                        <circle key={i} cx={cx} cy={cy} r={3} fill="#787b86" opacity={0.5} />
                      ))}
                    </svg>
                  </div>
                  <p className="text-[10px] text-red-400 font-medium">{t("ss_noise", lang)}</p>
                </div>

                {/* Arrow */}
                <div className="flex items-center justify-center col-span-1 relative">
                  {/* Stage 2: 100+ trades — shape forming */}
                  <div className="text-center space-y-2 w-full">
                    <p className="text-xs font-semibold">{t("ss_100trades", lang)}</p>
                    <div className="rounded-md border border-border bg-card p-2 aspect-square flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="w-full">
                        <line x1={10} y1={90} x2={90} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                        <line x1={10} y1={10} x2={10} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                        {/* More dots forming a loose shape */}
                        {[
                          [20,75],[25,68],[28,60],[30,72],[32,55],[35,50],[38,45],[40,42],
                          [42,38],[44,35],[46,32],[48,28],[50,25],[52,28],[54,32],[56,35],
                          [58,40],[60,45],[62,50],[65,55],[68,60],[70,65],[72,72],[75,78],
                          [35,65],[45,40],[55,38],[65,48],[40,58],[50,30],[60,42],[70,60],
                          [22,80],[78,82],[33,48],[67,52],[45,55],[55,45],
                        ].map(([cx,cy],i) => (
                          <circle key={i} cx={cx} cy={cy} r={2} fill="#787b86" opacity={0.45} />
                        ))}
                      </svg>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium">{t("ss_edge_appearing", lang)}</p>
                  </div>
                </div>

                {/* Stage 3: 500+ trades — bell curve clear */}
                <div className="text-center space-y-2">
                  <p className="text-xs font-semibold">{t("ss_500trades", lang)}</p>
                  <div className="rounded-md border border-border bg-card p-2 aspect-square flex items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full">
                      <line x1={10} y1={90} x2={90} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                      <line x1={10} y1={10} x2={10} y2={90} stroke="currentColor" strokeWidth={0.5} className="text-muted-foreground/30" />
                      {/* Dense dots + bell curve */}
                      {[
                        [15,85],[17,82],[20,78],[22,75],[24,70],[26,65],[28,58],[30,52],
                        [32,46],[34,40],[36,35],[38,30],[40,26],[42,22],[44,19],[46,17],
                        [48,15],[50,14],[52,15],[54,17],[56,19],[58,22],[60,26],[62,30],
                        [64,35],[66,40],[68,46],[70,52],[72,58],[74,65],[76,70],[78,75],
                        [80,78],[82,82],[85,85],
                        [25,72],[35,42],[45,20],[55,20],[65,42],[75,72],
                        [30,60],[40,30],[50,16],[60,30],[70,60],
                        [33,50],[43,24],[53,18],[63,24],[67,48],
                        [28,63],[38,35],[48,18],[58,18],[68,45],[72,55],
                      ].map(([cx,cy],i) => (
                        <circle key={i} cx={cx} cy={cy} r={1.5} fill="#787b86" opacity={0.4} />
                      ))}
                      {/* Bell curve line */}
                      <path
                        d="M15,85 Q25,72 35,45 Q42,25 50,14 Q58,25 65,45 Q75,72 85,85"
                        fill="none"
                        stroke="#26a69a"
                        strokeWidth={1.5}
                      />
                    </svg>
                  </div>
                  <p className="text-[10px] text-green-400 font-medium">{t("ss_edge_real", lang)}</p>
                </div>
              </div>

              <ConceptCard title={t("ss_quote", lang)} variant="rule">
                <p>{t("ss_quote_desc", lang)}</p>
              </ConceptCard>
            </CardContent>
          </Card>

          <ConceptCard title={t("unitOfRisk", lang)} variant="rule">
            <p>{t("tm_r_unit", lang)}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-red-500/10 rounded p-2 text-center">
                <p className="text-xs text-red-400 font-semibold">{t("loss", lang)}</p>
                <p className="font-mono text-red-400 font-bold">-1R</p>
                <p className="text-xs text-muted-foreground">{t("hitStopLoss", lang)}</p>
              </div>
              <div className="bg-green-500/10 rounded p-2 text-center">
                <p className="text-xs text-green-400 font-semibold">{t("win", lang)}</p>
                <p className="font-mono text-green-400 font-bold">+2.5R</p>
                <p className="text-xs text-muted-foreground">{t("hitTarget", lang)}</p>
              </div>
            </div>
          </ConceptCard>
        </Section>

        {/* ── 9. Process and Improvement ────────────────────────────── */}
        <Section title={t("processAndImprovement", lang)} icon={RefreshCcw}>
          <ConceptCard title={t("tradingJournal", lang)}>
            <p>{t("proc_journal", lang)}</p>
            <p>{t("proc_review", lang)}</p>
          </ConceptCard>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4 text-center space-y-1">
              <p className="text-2xl font-bold text-primary">1</p>
              <p className="text-sm font-semibold">{t("backtest", lang)}</p>
              <p className="text-xs text-muted-foreground">{t("backtest_desc", lang)}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center space-y-1">
              <p className="text-2xl font-bold text-primary">2</p>
              <p className="text-sm font-semibold">{t("paperTrade", lang)}</p>
              <p className="text-xs text-muted-foreground">{t("paperTrade_desc", lang)}</p>
            </div>
            <div className="rounded-lg border border-border p-4 text-center space-y-1">
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-sm font-semibold">{t("liveSmall", lang)}</p>
              <p className="text-xs text-muted-foreground">{t("liveSmall_desc", lang)}</p>
            </div>
          </div>
          <ConceptCard title={t("keyMetrics", lang)} variant="tip">
            <p><strong>Win Rate</strong> — % of trades that are profitable</p>
            <p><strong>Average R</strong> — avg winner in R-multiples</p>
            <p><strong>Expectancy</strong> — expected R per trade</p>
            <p><strong>Max Drawdown</strong> — worst peak-to-trough drop</p>
            <p><strong>Profit Factor</strong> — gross profit / gross loss (want &gt; 1.5)</p>
          </ConceptCard>
        </Section>

        {/* ── 10. Multi-Timeframe Analysis (Deep Dive) ───────────── */}
        <Section title={t("multiTimeframeAnalysis", lang)} icon={Clock} badge={t("deepDive", lang)}>
          <p className="text-sm text-muted-foreground">
            {t("mta_intro", lang)}
          </p>

          {/* Timeframe hierarchy visual */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 sm:p-6">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <MonitorSmartphone className="h-4 w-4 text-primary" />
                {t("tfHierarchy", lang)}
              </h4>
              <div className="space-y-2">
                {[
                  { tf: "Monthly (1mo)", role: t("tf_monthly_role", lang), color: "bg-purple-500", width: "w-full" },
                  { tf: "Weekly (1wk)", role: t("tf_weekly_role", lang), color: "bg-blue-500", width: "w-[90%]" },
                  { tf: "Daily (1d)", role: t("tf_daily_role", lang), color: "bg-primary", width: "w-[80%]" },
                  { tf: "4 Hour (4h)", role: t("tf_4h_role", lang), color: "bg-cyan-500", width: "w-[70%]" },
                  { tf: "1 Hour (1h)", role: t("tf_1h_role", lang), color: "bg-green-500", width: "w-[60%]" },
                  { tf: "30 Min (30m)", role: t("tf_30m_role", lang), color: "bg-amber-500", width: "w-[50%]" },
                  { tf: "15 Min (15m)", role: t("tf_15m_role", lang), color: "bg-orange-500", width: "w-[40%]" },
                  { tf: "5 Min (5m)", role: t("tf_5m_role", lang), color: "bg-red-500", width: "w-[30%]" },
                ].map((item) => (
                  <div key={item.tf} className="flex items-center gap-3">
                    <div className={cn("h-6 rounded-sm flex items-center px-2 text-white text-xs font-mono font-bold shrink-0", item.color, item.width)}>
                      {item.tf}
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{item.role}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 italic">
                {t("tf_higher_weight", lang)}
              </p>
            </CardContent>
          </Card>

          {/* The 3-Timeframe Rule */}
          <ConceptCard title={t("threeTimeframeRule", lang)} variant="rule">
            <p>{t("three_tf_intro", lang)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-center">
                <p className="text-xs text-blue-400 font-semibold">{t("higherTF", lang)}</p>
                <p className="text-sm font-bold mt-1">{t("trendDirection", lang)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("riverFlowing", lang)}</p>
              </div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xs text-primary font-semibold">{t("middleTF", lang)}</p>
                <p className="text-sm font-bold mt-1">{t("setupStructure", lang)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("keyLevelsWhere", lang)}</p>
              </div>
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-center">
                <p className="text-xs text-green-400 font-semibold">{t("lowerTF", lang)}</p>
                <p className="text-sm font-bold mt-1">{t("entryTrigger", lang)}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("whenEnter", lang)}</p>
              </div>
            </div>
          </ConceptCard>

          {/* Concrete combinations for each style */}
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("tfCombinations", lang)}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 text-muted-foreground font-medium">{t("style", lang)}</th>
                    <th className="text-center py-2 px-2 text-blue-400 font-medium">{t("higherTF", lang)}</th>
                    <th className="text-center py-2 px-2 text-primary font-medium">{t("middleTF", lang)}</th>
                    <th className="text-center py-2 px-2 text-green-400 font-medium">{t("lowerTF", lang)}</th>
                    <th className="text-left py-2 pl-3 text-muted-foreground font-medium hidden sm:table-cell">{t("holdTime", lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { style: t("scalper", lang), h: "15m", m: "5m", l: "1m*", hold: t("secondsMinutes", lang) },
                    { style: t("dayTrader", lang), h: "1h", m: "15m", l: "5m", hold: t("minutesHours", lang) },
                    { style: t("intradaySwing", lang), h: "4h", m: "1h", l: "15m", hold: t("hoursOneDay", lang) },
                    { style: t("swingTrader", lang), h: "1d", m: "4h", l: "1h", hold: t("daysWeeks", lang) },
                    { style: t("positionTrader", lang), h: "1wk", m: "1d", l: "4h", hold: t("weeksMonths", lang) },
                    { style: t("investor", lang), h: "1mo", m: "1wk", l: "1d", hold: t("monthsYears", lang) },
                  ].map((row) => (
                    <tr key={row.style} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2.5 pr-3 font-semibold">{row.style}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-blue-400">{row.h}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-primary">{row.m}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-green-400">{row.l}</td>
                      <td className="py-2.5 pl-3 text-muted-foreground hidden sm:table-cell">{row.hold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t("scalperNote", lang)}</p>
          </div>

          {/* Visual: 3-screen method */}
          <Card className="border-border/10 bg-surface-mid">
            <CardContent className="p-4 sm:p-6">
              <h4 className="text-sm font-semibold mb-4">{t("threeScreenMethod", lang)}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Screen 1: Daily */}
                <div className="rounded-lg border border-blue-500/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs font-semibold text-blue-400">{t("screen1Daily", lang)}</span>
                  </div>
                  <svg viewBox="0 0 160 80" className="w-full">
                    {/* Uptrend candles */}
                    {[
                      { o: 100, c: 104, h: 105, l: 99 },
                      { o: 104, c: 102, h: 105, l: 101 },
                      { o: 102, c: 107, h: 108, l: 101 },
                      { o: 107, c: 105, h: 108, l: 104 },
                      { o: 105, c: 110, h: 111, l: 104 },
                    ].map((c, i) => (
                      <Candle key={i} x={10 + i * 30} open={c.o} close={c.c} high={c.h} low={c.l} width={16} scaleY={(p) => 70 - (p - 98) * 4} baseY={75} />
                    ))}
                    <line x1={5} y1={62} x2={155} y2={30} stroke="#2962ff" strokeWidth={1} strokeDasharray="4,2" />
                  </svg>
                  <p className="text-xs text-muted-foreground">
                    {t("screen1Decision", lang)}
                  </p>
                </div>

                {/* Screen 2: 4H */}
                <div className="rounded-lg border border-primary/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-semibold text-primary">{t("screen2FourH", lang)}</span>
                  </div>
                  <svg viewBox="0 0 160 80" className="w-full">
                    {[
                      { o: 107, c: 109, h: 110, l: 106 },
                      { o: 109, c: 108, h: 110, l: 107 },
                      { o: 108, c: 106, h: 109, l: 105 },
                      { o: 106, c: 105, h: 107, l: 104 },
                      { o: 105, c: 106, h: 107, l: 104 },
                    ].map((c, i) => (
                      <Candle key={i} x={10 + i * 30} open={c.o} close={c.c} high={c.h} low={c.l} width={16} scaleY={(p) => 70 - (p - 103) * 7} baseY={75} />
                    ))}
                    {/* Support level */}
                    <line x1={5} y1={63} x2={155} y2={63} stroke="#26a69a" strokeWidth={1.5} strokeDasharray="5,3" />
                    <text x={155} y={60} textAnchor="end" fill="#26a69a" fontSize={7} fontWeight={600}>Support</text>
                  </svg>
                  <p className="text-xs text-muted-foreground">
                    {t("screen2Decision", lang)}
                  </p>
                </div>

                {/* Screen 3: 1H */}
                <div className="rounded-lg border border-green-500/30 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-semibold text-green-400">{t("screen3OneH", lang)}</span>
                  </div>
                  <svg viewBox="0 0 160 80" className="w-full">
                    {[
                      { o: 106, c: 105, h: 107, l: 104 },
                      { o: 105, c: 104.5, h: 105.5, l: 104 },
                      { o: 104.5, c: 105, h: 106, l: 103.5 },
                      { o: 105, c: 107, h: 108, l: 104.5 },
                      { o: 107, c: 108, h: 109, l: 106.5 },
                    ].map((c, i) => (
                      <Candle key={i} x={10 + i * 30} open={c.o} close={c.c} high={c.h} low={c.l} width={16} scaleY={(p) => 70 - (p - 103) * 10} baseY={75} />
                    ))}
                    {/* Entry arrow */}
                    <polygon points="100,30 106,40 94,40" fill="#26a69a" />
                    <text x={100} y={50} textAnchor="middle" fill="#26a69a" fontSize={7} fontWeight={700}>BUY</text>
                    {/* Stop line */}
                    <line x1={85} y1={65} x2={155} y2={65} stroke="#ef5350" strokeWidth={1} strokeDasharray="3,2" />
                    <text x={155} y={62} textAnchor="end" fill="#ef5350" fontSize={6}>Stop</text>
                  </svg>
                  <p className="text-xs text-muted-foreground">
                    {t("screen3Decision", lang)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step-by-step workflow */}
          <ConceptCard title={t("mtfWorkflow", lang)} variant="rule">
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="shrink-0 h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">1</div>
                <div>
                  <p className="font-semibold text-foreground">{t("mtf_step1_title", lang)}</p>
                  <p>{t("mtf_step1_desc", lang)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">2</div>
                <div>
                  <p className="font-semibold text-foreground">{t("mtf_step2_title", lang)}</p>
                  <p>{t("mtf_step2_desc", lang)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="shrink-0 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">3</div>
                <div>
                  <p className="font-semibold text-foreground">{t("mtf_step3_title", lang)}</p>
                  <p>{t("mtf_step3_desc", lang)}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="shrink-0 h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-bold">4</div>
                <div>
                  <p className="font-semibold text-foreground">{t("mtf_step4_title", lang)}</p>
                  <p>{t("mtf_step4_desc", lang)}</p>
                </div>
              </div>
            </div>
          </ConceptCard>

          {/* Confluence & Alignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConceptCard title={t("confluenceHighProb", lang)} variant="tip">
              <p>{t("confluence_intro", lang)}</p>
              <p className="mt-2 font-semibold">{t("confluence_agree", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("conflictNoTrade", lang)} variant="warning">
              <p>{t("conflict_intro", lang)}</p>
              <p className="mt-2 font-semibold">{t("conflict_trap", lang)}</p>
            </ConceptCard>
          </div>

          {/* Common MTF mistakes */}
          <div>
            <h4 className="text-sm font-semibold mb-3">{t("commonMTFMistakes", lang)}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ConceptCard title={t("mistakeTooManyTF", lang)} variant="warning">
                <p>{t("mistakeTooManyTF_desc", lang)}</p>
                <p>{t("mistakeTooManyTF_fix", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("mistakeEnteringHigherTF", lang)} variant="warning">
                <p>{t("mistakeEnteringHigherTF_desc", lang)}</p>
                <p>{t("mistakeEnteringHigherTF_fix", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("mistakeFightingHigherTF", lang)} variant="warning">
                <p>{t("mistakeFightingHigherTF_desc", lang)}</p>
                <p>{t("mistakeFightingHigherTF_fix", lang)}</p>
              </ConceptCard>
              <ConceptCard title={t("mistakeManagingEntryTF", lang)} variant="warning">
                <p>{t("mistakeManagingEntryTF_desc", lang)}</p>
                <p>{t("mistakeManagingEntryTF_fix", lang)}</p>
              </ConceptCard>
            </div>
          </div>

          {/* Real example walkthrough */}
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 sm:p-6 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-400" />
                {t("realExample", lang)}
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong className="text-foreground">1H (Higher):</strong> AAPL is in an uptrend. Price at $185, making higher highs. Bias = LONG only.</p>
                <p><strong className="text-foreground">15m (Middle):</strong> Price pulls back to $183.50 — previous breakout level now acting as support. RSI showing oversold on 15m.</p>
                <p><strong className="text-foreground">5m (Lower):</strong> Bullish engulfing candle at $183.60. Volume spike confirms buyers stepping in.</p>
                <div className="rounded-md border border-border p-3 bg-card mt-2">
                  <p className="text-xs font-mono">
                    <span className="text-green-400">Entry:</span> $183.65 (above engulfing high)<br/>
                    <span className="text-red-400">Stop:</span> $183.10 (below engulfing low) → Risk = $0.55/share<br/>
                    <span className="text-blue-400">Target:</span> $185.30 (previous high) → Reward = $1.65/share<br/>
                    <span className="text-primary">R:R = 3:1</span> — Risk $55 to make $165 on 100 shares
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeframe & indicators */}
          <ConceptCard title={t("indicatorsByTF", lang)}>
            <div className="space-y-1.5">
              <p>{t("ind_5m_15m", lang)}</p>
              <p>{t("ind_30m_1h", lang)}</p>
              <p>{t("ind_4h_1d", lang)}</p>
              <p>{t("ind_1wk_1mo", lang)}</p>
            </div>
          </ConceptCard>
        </Section>

        {/* ── 11. Growth and Scaling ────────────────────────────────── */}
        <Section title={t("growthAndScaling", lang)} icon={ArrowUpDown}>
          <ConceptCard title={t("whenToScaleUp", lang)}>
            <p>{t("gs_consistency", lang)}</p>
            <p>{t("gs_scale", lang)}</p>
            <p>{t("gs_drawdown", lang)}</p>
          </ConceptCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ConceptCard title={t("addingToWinners", lang)} variant="tip">
              <p>{t("gs_pyramid", lang)}</p>
              <p>{t("gs_addon", lang)}</p>
              <p>{t("gs_breakeven", lang)}</p>
            </ConceptCard>
            <ConceptCard title={t("cuttingLosers", lang)} variant="warning">
              <p>{t("gs_invalidated", lang)}</p>
              <p>{t("gs_dont_wait", lang)}</p>
              <p>{t("gs_cut", lang)}</p>
            </ConceptCard>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
