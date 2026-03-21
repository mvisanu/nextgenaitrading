"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronDown,
  Shield,
  Flame,
  Brain,
  TrendingDown,
  Activity,
  BarChart3,
  Zap,
  Clock,
  Target,
  AlertTriangle,
  Layers,
  FileCode,
  HelpCircle,
  ArrowUpDown,
  TrendingUp,
  LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  accentColor = "text-primary",
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/60">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-secondary/30 transition-colors rounded-t-lg"
      >
        <Icon className={cn("h-5 w-5 shrink-0", accentColor)} />
        <span className="flex-1 font-semibold text-sm text-foreground">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="px-5 pb-5 pt-0 text-sm text-muted-foreground leading-relaxed space-y-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Indicator Row ───────────────────────────────────────────────────────────

function Indicator({
  name,
  window,
  purpose,
}: {
  name: string;
  window: string;
  purpose: string;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <code className="shrink-0 text-xs font-mono bg-secondary/60 px-2 py-0.5 rounded text-foreground min-w-[80px]">
        {name}
      </code>
      <span className="text-xs text-muted-foreground/70 shrink-0 w-[70px]">
        {window}
      </span>
      <span className="text-xs">{purpose}</span>
    </div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQ({
  q,
  children,
}: {
  q: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-start gap-2 w-full py-3 text-left"
      >
        <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <span className="flex-1 text-sm font-medium text-foreground">{q}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <div className="pl-6 pb-3 text-sm text-muted-foreground leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Comparison Table ────────────────────────────────────────────────────────

function ComparisonTable() {
  const rows = [
    { label: "Leverage", conservative: "2.5x", aggressive: "4.0x", aiPick: "2.0x", blsh: "2.0x" },
    { label: "Logic Type", conservative: "HMM + 8 Indicators", aggressive: "HMM + 8 Indicators", aiPick: "MACD/RSI/EMA Optimizer", blsh: "RSI/Bollinger Optimizer" },
    { label: "Min Confirmations", conservative: "7 / 8", aggressive: "5 / 8", aiPick: "N/A", blsh: "N/A" },
    { label: "Trailing Stop", conservative: "None", aggressive: "5%", aiPick: "None", blsh: "None" },
    { label: "Variants Tested", conservative: "1", aggressive: "1", aiPick: "12", blsh: "8" },
    { label: "Cooldown Bars", conservative: "3", aggressive: "3", aiPick: "3", blsh: "2" },
    { label: "Pine Script Export", conservative: "No", aggressive: "No", aiPick: "Yes", blsh: "Yes" },
    { label: "Entry Condition", conservative: "Bull regime + 7 confirms", aggressive: "Bull regime + 5 confirms", aiPick: "MACD/RSI/EMA signals", blsh: "RSI oversold + BB lower" },
    { label: "Exit Condition", conservative: "Bear regime", aggressive: "Bear regime or trail stop", aiPick: "Variant sell signal", blsh: "Overbought or BB upper" },
  ];

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-2 font-semibold text-foreground w-[140px]">Feature</th>
            <th className="text-center py-2 px-2 font-semibold text-blue-400">Conservative</th>
            <th className="text-center py-2 px-2 font-semibold text-orange-400">Aggressive</th>
            <th className="text-center py-2 px-2 font-semibold text-purple-400">AI Pick</th>
            <th className="text-center py-2 px-2 font-semibold text-emerald-400">Buy Low/Sell High</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/30 hover:bg-secondary/20">
              <td className="py-2 px-2 font-medium text-foreground">{row.label}</td>
              <td className="py-2 px-2 text-center text-muted-foreground">{row.conservative}</td>
              <td className="py-2 px-2 text-center text-muted-foreground">{row.aggressive}</td>
              <td className="py-2 px-2 text-center text-muted-foreground">{row.aiPick}</td>
              <td className="py-2 px-2 text-center text-muted-foreground">{row.blsh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  return (
    <AppShell title="FAQ & Strategy Reference">
      <div className="max-w-4xl mx-auto space-y-4 pb-12">

        {/* Header */}
        <div className="space-y-1 mb-6">
          <h1 className="text-xl font-bold text-foreground">
            Strategy Rules & FAQ
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything you need to know about each strategy mode, indicators, backtesting mechanics, and platform features.
          </p>
        </div>

        {/* ── Strategy Comparison ───────────────────────────────────────── */}
        <Section
          title="Strategy Comparison at a Glance"
          icon={Layers}
          defaultOpen={true}
          accentColor="text-primary"
        >
          <ComparisonTable />
        </Section>

        {/* ── Conservative Strategy ────────────────────────────────────── */}
        <Section
          title="Conservative Strategy"
          icon={Shield}
          accentColor="text-blue-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">Leverage: 2.5x</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">7/8 Confirmations</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">No Trailing Stop</Badge>
              <Badge variant="outline" className="text-blue-400 border-blue-400/30">Cooldown: 3 bars</Badge>
            </div>

            <p>
              The Conservative strategy uses a <strong className="text-foreground">2-state Hidden Markov Model (HMM)</strong> to
              detect whether the market is in a <span className="text-[#26a69a]">bull</span> or{" "}
              <span className="text-[#ef5350]">bear</span> regime. It then requires <strong className="text-foreground">7 out of 8</strong> technical
              indicators to confirm before entering a trade. This is the safest mode — designed for capital preservation with fewer but higher-confidence entries.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              HMM Regime Detection
            </h4>
            <p>
              A Gaussian HMM with 2 hidden states is fitted on three features: <strong className="text-foreground">log returns</strong>,{" "}
              <strong className="text-foreground">ATR</strong> (14-period), and <strong className="text-foreground">volume ratio</strong> (current volume / 20-bar avg).
              The state with the higher mean return is labeled "bull"; the other is "bear".
              Requires at least 60 bars of data to train.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              8 Confirmation Signals
            </h4>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-0.5">
              <Indicator name="RSI" window="14-period" purpose="RSI < 70 — not overbought" />
              <Indicator name="MACD" window="12/26/9" purpose="MACD line > Signal line — bullish crossover" />
              <Indicator name="EMA" window="20 & 50" purpose="EMA₂₀ > EMA₅₀ — short-term uptrend" />
              <Indicator name="Bollinger" window="20, 2σ" purpose="Price > lower band — above support" />
              <Indicator name="ADX" window="14-period" purpose="ADX > 20 — market is trending" />
              <Indicator name="OBV" window="cumulative" purpose="OBV increasing — volume confirms price" />
              <Indicator name="ATR" window="14-period" purpose="ATR > 0 — market has volatility" />
              <Indicator name="Volume" window="20-bar avg" purpose="Volume ratio > 0.8 — above-average activity" />
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Entry & Exit Rules
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">BUY</div>
                <p className="text-xs">Regime = bull <span className="text-foreground font-semibold">AND</span> confirmations ≥ 7</p>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">SELL</div>
                <p className="text-xs">Regime = bear (regardless of confirmations)</p>
              </div>
              <div className="bg-secondary/40 border border-border rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">HOLD</div>
                <p className="text-xs">Regime = bull but &lt; 7 confirmations</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Aggressive Strategy ──────────────────────────────────────── */}
        <Section
          title="Aggressive Strategy"
          icon={Flame}
          accentColor="text-orange-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">Leverage: 4.0x</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">5/8 Confirmations</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">5% Trailing Stop</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/30">Cooldown: 3 bars</Badge>
            </div>

            <p>
              Same HMM regime detection and 8 indicators as Conservative, but with a{" "}
              <strong className="text-foreground">lower confirmation gate (5/8)</strong> and{" "}
              <strong className="text-foreground">higher leverage (4.0x)</strong>.
              Enters trades more frequently with more risk per trade.
              A <strong className="text-foreground">5% trailing stop</strong> actively protects against sharp reversals.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              What's Different from Conservative?
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">1.</span>
                <p className="text-xs"><strong className="text-foreground">Relaxed gate:</strong> Only 5 of 8 indicators need to confirm (vs 7). More trades, but lower conviction per trade.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">2.</span>
                <p className="text-xs"><strong className="text-foreground">Higher leverage:</strong> 4.0x amplifies both gains and losses. A 2% move becomes an 8% portfolio impact.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-orange-400 text-sm">3.</span>
                <p className="text-xs"><strong className="text-foreground">Trailing stop:</strong> Tracks the highest price during a trade. If price drops 5% from that peak, the position is closed automatically.</p>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Trailing Stop Mechanics
            </h4>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs">
                During each bar of an open trade, the engine tracks the <strong className="text-foreground">highest price reached</strong>.
                If the current price falls to <code className="bg-secondary/60 px-1 rounded">highest_price × (1 − 0.05)</code>,
                the position is closed with exit reason <code className="bg-secondary/60 px-1 rounded">"trailing_stop"</code>.
              </p>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Exit Conditions (3 possible)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">Signal Exit</div>
                <p className="text-xs">HMM regime switches to bear</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-orange-400 mb-1">Trailing Stop</div>
                <p className="text-xs">Price drops 5% from peak</p>
              </div>
              <div className="bg-secondary/40 border border-border rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">End of Data</div>
                <p className="text-xs">Backtest ends with open position</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── AI Pick Optimizer ────────────────────────────────────────── */}
        <Section
          title="AI Pick Optimizer"
          icon={Brain}
          accentColor="text-purple-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">Leverage: 2.0x</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">12 Variants Tested</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">No Trailing Stop</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">Cooldown: 3 bars</Badge>
              <Badge variant="outline" className="text-purple-400 border-purple-400/30">Pine Script Export</Badge>
            </div>

            <p>
              The AI Pick optimizer does <strong className="text-foreground">not use HMM</strong>.
              Instead, it systematically tests <strong className="text-foreground">12 parameter combinations</strong> of
              MACD, RSI, and EMA indicators, backtests each variant, then selects the winner
              with the best risk-adjusted score.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Parameter Grid (12 Variants)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-semibold text-foreground">Parameter</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-foreground">Values Tested</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">MACD Fast / Slow</td>
                    <td className="py-1.5 px-2 font-mono">(8, 21) or (12, 26)</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">RSI Window</td>
                    <td className="py-1.5 px-2 font-mono">10 or 14</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">EMA Short / Long</td>
                    <td className="py-1.5 px-2 font-mono">(10, 50) or (20, 100)</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">RSI Oversold Threshold</td>
                    <td className="py-1.5 px-2 font-mono">30 or 35</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Buy / Sell Logic (per Variant)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">BUY when all true</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  <li>MACD &gt; Signal line</li>
                  <li>RSI &lt; oversold + 20</li>
                  <li>EMA_short &gt; EMA_long</li>
                </ul>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">SELL when any true</div>
                <ul className="text-xs space-y-0.5 list-disc list-inside">
                  <li>MACD &lt; Signal line</li>
                  <li>RSI &gt; 70</li>
                  <li>EMA_short &lt; EMA_long</li>
                </ul>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Variant Selection Process
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs shrink-0">1.</span>
                <p className="text-xs">Run all 12 variants against historical data</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs shrink-0">2.</span>
                <p className="text-xs">Split data: 60% train, 20% validation, 20% test</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs shrink-0">3.</span>
                <p className="text-xs">Score each variant: <code className="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs shrink-0">4.</span>
                <p className="text-xs">Top-ranked variant becomes the winner</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-purple-400 font-mono text-xs shrink-0">5.</span>
                <p className="text-xs">Pine Script v5 code is generated mirroring the winner's logic</p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Buy Low / Sell High Optimizer ────────────────────────────── */}
        <Section
          title="Buy Low / Sell High Optimizer"
          icon={ArrowUpDown}
          accentColor="text-emerald-400"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Leverage: 2.0x</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">8 Variants Tested</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">No Trailing Stop</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Cooldown: 2 bars</Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">Pine Script Export</Badge>
            </div>

            <p>
              A mean-reversion optimizer that buys when price is at <strong className="text-foreground">Bollinger lower band + RSI oversold</strong>,
              and sells when price reaches the <strong className="text-foreground">upper band or RSI overbought</strong>.
              Tests 8 parameter combinations and selects the best performer.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Parameter Grid (8 Variants)
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-semibold text-foreground">Parameter</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-foreground">Values Tested</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">RSI Oversold Threshold</td>
                    <td className="py-1.5 px-2 font-mono">25, 30, 35, or 40</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">Bollinger Band Window</td>
                    <td className="py-1.5 px-2 font-mono">14 or 20</td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-1.5 px-2">Cycle Hold Bars</td>
                    <td className="py-1.5 px-2 font-mono">5 or 10</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Regime States
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="bg-[#26a69a]/10 border border-[#26a69a]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#26a69a] mb-1">DIP (Buy)</div>
                <p className="text-xs">RSI &lt; oversold threshold <span className="text-foreground font-semibold">AND</span> Price &lt; BB lower band. Hold for cycle_hold_bars.</p>
              </div>
              <div className="bg-[#ef5350]/10 border border-[#ef5350]/20 rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-[#ef5350] mb-1">TOP (Sell)</div>
                <p className="text-xs">RSI &gt; 65 <span className="text-foreground font-semibold">OR</span> Price &gt; BB upper band. Exit immediately.</p>
              </div>
              <div className="bg-secondary/40 border border-border rounded-lg p-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">NEUTRAL</div>
                <p className="text-xs">Neither condition met. Continue holding or waiting.</p>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Fixed Parameters
            </h4>
            <ul className="text-xs space-y-1 list-disc list-inside">
              <li>RSI window: 14 (fixed, not optimized)</li>
              <li>RSI overbought: 65 (fixed)</li>
              <li>Bollinger std deviation: 2.0 (fixed)</li>
            </ul>
          </div>
        </Section>

        {/* ── Backtesting Engine ───────────────────────────────────────── */}
        <Section
          title="Backtesting Engine"
          icon={BarChart3}
          accentColor="text-cyan-400"
        >
          <div className="space-y-3">
            <p>
              All four strategies run through the same backtesting engine. The engine simulates trades on historical data and calculates performance metrics.
            </p>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Data Splitting
            </h4>
            <div className="flex gap-0 rounded-lg overflow-hidden h-6">
              <div className="bg-blue-500/30 flex items-center justify-center flex-[6] text-[10px] font-mono text-blue-400">
                Train 60%
              </div>
              <div className="bg-purple-500/30 flex items-center justify-center flex-[2] text-[10px] font-mono text-purple-400">
                Val 20%
              </div>
              <div className="bg-emerald-500/30 flex items-center justify-center flex-[2] text-[10px] font-mono text-emerald-400">
                Test 20%
              </div>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Performance Metrics
            </h4>
            <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">Total Return</code>
                <span className="text-xs">Compounded % return across all trades on the equity curve</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">Max Drawdown</code>
                <span className="text-xs">Largest peak-to-trough decline — measures worst-case loss</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">Sharpe-like</code>
                <span className="text-xs">Mean leveraged return / std deviation — risk-adjusted performance</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">Validation Score</code>
                <span className="text-xs"><code className="bg-secondary/60 px-1 rounded">val_return / (1 + max_drawdown)</code> — used to rank optimizer variants</span>
              </div>
              <div className="flex items-start gap-2">
                <code className="text-xs font-mono bg-secondary/60 px-1.5 py-0.5 rounded shrink-0">Win Rate</code>
                <span className="text-xs">Percentage of trades with positive return</span>
              </div>
            </div>

            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mt-4">
              Return Calculation
            </h4>
            <div className="bg-secondary/30 rounded-lg p-3 font-mono text-xs space-y-1">
              <p><span className="text-muted-foreground">return_pct</span> = (exit_price - entry_price) / entry_price × 100</p>
              <p><span className="text-muted-foreground">leveraged_return</span> = return_pct × leverage</p>
              <p><span className="text-muted-foreground">equity</span> *= (1 + leveraged_return / 100)</p>
            </div>
          </div>
        </Section>

        {/* ── Cooldown Mechanics ───────────────────────────────────────── */}
        <Section
          title="Cooldown Mechanics"
          icon={Clock}
          accentColor="text-amber-400"
        >
          <p>
            After every trade exit, a <strong className="text-foreground">cooldown period</strong> prevents immediate re-entry.
            This avoids whipsaw trades — rapid buy/sell cycles that erode capital through fees and slippage.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-foreground mb-1">Conservative / Aggressive / AI Pick</div>
              <p className="text-xs"><strong className="text-foreground">3 bars</strong> after each exit before next entry is allowed</p>
            </div>
            <div className="bg-secondary/30 rounded-lg p-3">
              <div className="text-[10px] uppercase font-bold text-foreground mb-1">Buy Low / Sell High</div>
              <p className="text-xs"><strong className="text-foreground">2 bars</strong> — shorter cooldown since the strategy has a mandatory hold period built in</p>
            </div>
          </div>
          <div className="mt-2 text-xs">
            <strong className="text-foreground">How it works:</strong> Exit trade → counter set to N → each subsequent bar decrements counter → when counter reaches 0, new entries are allowed again.
          </div>
        </Section>

        {/* ── Indicator Glossary ───────────────────────────────────────── */}
        <Section
          title="Indicator Glossary"
          icon={Activity}
          accentColor="text-teal-400"
        >
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">RSI (Relative Strength Index)</h4>
                <p className="text-xs mt-1">
                  Momentum oscillator measuring speed/magnitude of price changes on a 0-100 scale.
                  Above 70 = overbought (likely to reverse down). Below 30 = oversold (likely to bounce).
                  Used in all four strategies.
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">MACD (Moving Average Convergence Divergence)</h4>
                <p className="text-xs mt-1">
                  Trend-following indicator. MACD line = EMA₁₂ − EMA₂₆. Signal line = 9-period EMA of MACD.
                  When MACD crosses above signal = bullish. Below = bearish.
                  Used in Conservative, Aggressive, and AI Pick.
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">EMA (Exponential Moving Average)</h4>
                <p className="text-xs mt-1">
                  A moving average that gives more weight to recent prices. When short-term EMA crosses above long-term EMA, it signals upward momentum.
                  Conservative uses 20/50, AI Pick tests 10/50 and 20/100.
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">Bollinger Bands</h4>
                <p className="text-xs mt-1">
                  Three lines: middle = SMA, upper/lower = middle ± 2 standard deviations.
                  Price near lower band suggests oversold; near upper band suggests overbought.
                  Used in Conservative/Aggressive (as confirmation) and Buy Low/Sell High (as primary signal).
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">ADX (Average Directional Index)</h4>
                <p className="text-xs mt-1">
                  Measures trend strength on a 0-100 scale. ADX &gt; 20 means the market is trending (either direction).
                  ADX &lt; 20 means ranging/choppy. Used as confirmation in Conservative and Aggressive.
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">OBV (On-Balance Volume)</h4>
                <p className="text-xs mt-1">
                  Cumulative volume indicator. Adds volume on up days, subtracts on down days.
                  Rising OBV confirms price trend with volume support. Used in Conservative and Aggressive.
                </p>
              </div>
              <div className="border-b border-border/30 pb-2">
                <h4 className="text-xs font-semibold text-foreground">ATR (Average True Range)</h4>
                <p className="text-xs mt-1">
                  Measures market volatility — the average range of price movement over 14 bars.
                  Higher ATR = more volatile market. Used as confirmation and as an HMM input feature.
                </p>
              </div>
              <div className="pb-1">
                <h4 className="text-xs font-semibold text-foreground">HMM (Hidden Markov Model)</h4>
                <p className="text-xs mt-1">
                  A statistical model that detects hidden "regimes" (bull/bear) from observable features
                  (returns, volatility, volume). Learns state transition probabilities from historical data.
                  Used exclusively by Conservative and Aggressive strategies.
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Pine Script Artifacts ────────────────────────────────────── */}
        <Section
          title="Pine Script Artifacts"
          icon={FileCode}
          accentColor="text-yellow-400"
        >
          <p>
            When an optimizer mode (AI Pick or Buy Low/Sell High) completes a run, the winning variant's logic is automatically
            converted into <strong className="text-foreground">TradingView Pine Script v5</strong> code. This code can be
            copied and pasted directly into TradingView's Pine Editor.
          </p>
          <div className="mt-2 space-y-1.5 text-xs">
            <p><strong className="text-foreground">Generated for:</strong> AI Pick (winner), Buy Low/Sell High (winner)</p>
            <p><strong className="text-foreground">Not generated for:</strong> Conservative, Aggressive (HMM is stateful and cannot be represented in Pine Script)</p>
            <p><strong className="text-foreground">Includes:</strong> Exact indicator windows/thresholds from the winning variant, entry/exit conditions, and inline comments</p>
            <p><strong className="text-foreground">Where to find:</strong> Artifacts page → each artifact shows mode, symbol, variant name, and copyable code</p>
          </div>
        </Section>

        {/* ── General FAQ ──────────────────────────────────────────────── */}
        <Section
          title="Frequently Asked Questions"
          icon={HelpCircle}
          defaultOpen={true}
          accentColor="text-primary"
        >
          <div className="space-y-0">
            <FAQ q="Is this real trading or simulation?">
              <p>
                By default, all strategy runs are <strong className="text-foreground">backtests on historical data</strong> — no real money is at risk.
                The live trading page supports paper trading and real execution through broker integrations (Alpaca),
                but <strong className="text-foreground">dry-run mode is always the default</strong> and requires explicit opt-in for real trades.
              </p>
            </FAQ>

            <FAQ q="How much historical data does the platform use?">
              <p>
                Data comes from <strong className="text-foreground">yfinance</strong> (free public data). Daily and weekly timeframes pull up to{" "}
                <strong className="text-foreground">730 days (2 years)</strong>. Intraday timeframes (5m, 15m, 30m) pull up to{" "}
                <strong className="text-foreground">60 days</strong>. 1-minute candles are limited to <strong className="text-foreground">7 days</strong>.
              </p>
            </FAQ>

            <FAQ q="What does leverage actually do?">
              <p>
                Leverage multiplies your returns (and losses). With 2.5x leverage, a 4% price move becomes a 10% portfolio impact.
                The backtest engine compounds leveraged returns:
              </p>
              <code className="block bg-secondary/40 rounded px-3 py-2 text-xs font-mono mt-1">
                leveraged_return = (exit - entry) / entry × 100 × leverage
              </code>
              <p className="mt-1">Higher leverage means higher potential reward <em>and</em> higher potential loss.</p>
            </FAQ>

            <FAQ q="What is the validation score and why does it matter?">
              <p>
                The validation score is <code className="bg-secondary/60 px-1 rounded">validation_return / (1 + max_drawdown)</code>.
                It rewards strategies that produce high returns while penalizing those with large drawdowns.
                This prevents the optimizer from selecting a variant that got lucky with one big trade but had dangerous risk exposure.
              </p>
            </FAQ>

            <FAQ q="Why can't Conservative/Aggressive strategies export Pine Script?">
              <p>
                These strategies use a <strong className="text-foreground">Hidden Markov Model</strong>, which is a real-time statistical model
                that requires fitting on historical data and tracking hidden state transitions.
                Pine Script v5 doesn't support the matrix operations and probability calculations needed for HMM inference.
                Only the deterministic indicator-based optimizer strategies (AI Pick, BLSH) can be expressed in Pine Script.
              </p>
            </FAQ>

            <FAQ q="What symbols can I use?">
              <p>
                Any valid <strong className="text-foreground">yfinance ticker</strong>: US stocks (AAPL, TSLA, NVDA),
                crypto pairs (BTC-USD, ETH-USD, SOL-USD), ETFs (SPY, QQQ), indices (^GSPC, ^VIX),
                and international stocks. The platform validates the symbol before running.
              </p>
            </FAQ>

            <FAQ q="What is the HMM and how does it work?">
              <p>
                A <strong className="text-foreground">Gaussian Hidden Markov Model</strong> with 2 states is trained on three features:
                log returns, ATR, and volume ratio. It learns to classify the market into two regimes — the state with higher average returns
                is labeled "bull" and the other "bear". The model is fitted using 200 iterations with a fixed random seed (42) for reproducibility.
                It requires at least 60 bars of data.
              </p>
            </FAQ>

            <FAQ q="How does the cooldown prevent whipsaw trades?">
              <p>
                After exiting a trade, the engine enforces a waiting period (2-3 bars depending on strategy) before allowing a new entry.
                Without cooldowns, rapid buy/sell cycles can occur when indicators fluctuate near their thresholds,
                generating many small losing trades that erode capital through transaction costs and slippage.
              </p>
            </FAQ>

            <FAQ q="What's the difference between the train, validation, and test splits?">
              <p>
                <strong className="text-foreground">Train (60%):</strong> The model learns patterns from this data.{" "}
                <strong className="text-foreground">Validation (20%):</strong> Used to rank and select the best variant — the validation_score
                determines the winner.{" "}
                <strong className="text-foreground">Test (20%):</strong> Held out entirely — used only to show how the winner performs on
                completely unseen data, giving you a realistic estimate of future performance.
              </p>
            </FAQ>

            <FAQ q="What timeframes are supported?">
              <p>
                The platform supports: <strong className="text-foreground">1m, 2m, 5m, 15m, 30m</strong> (intraday),{" "}
                <strong className="text-foreground">1h, 2h, 3h, 4h</strong> (hourly),{" "}
                <strong className="text-foreground">1d, 1wk, 1mo</strong> (daily+).
                Note: 2h, 3h, and 4h are resampled from 1-hour data since yfinance doesn't support them natively.
              </p>
            </FAQ>

            <FAQ q="Are broker credentials safe?">
              <p>
                Broker API keys are encrypted with <strong className="text-foreground">Fernet symmetric encryption</strong> and only decrypted
                in-memory at execution time. They are <strong className="text-foreground">never returned in API responses</strong> — the frontend
                never sees the raw keys after submission. All credentials are scoped to the authenticated user.
              </p>
            </FAQ>

            <FAQ q="What is a Fair Value Gap (FVG)?">
              <p>
                A Fair Value Gap is a price imbalance that occurs when a strong candle creates a gap between the high of candle N-2
                and the low of candle N. <span className="text-[#26a69a]">Bullish FVGs</span> form when price gaps up (potential support zone).{" "}
                <span className="text-[#ef5350]">Bearish FVGs</span> form when price gaps down (potential resistance zone).
                You can view auto-detected FVGs on the dashboard chart using the "Auto FVG" button.
              </p>
            </FAQ>
          </div>
        </Section>

      </div>
    </AppShell>
  );
}
