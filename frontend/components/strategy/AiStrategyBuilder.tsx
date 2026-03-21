"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  Copy,
  Play,
  Code,
  ChevronDown,
  ChevronUp,
  DollarSign,
} from "lucide-react";
import { backtestApi, strategyApi } from "@/lib/api";
import { getQueryClient } from "@/lib/queryClient";
import { ResultsPanel } from "./ResultsPanel";
import type {
  StrategyMode,
  Timeframe,
  BacktestSummary,
  ChartData,
  BacktestTrade,
  VariantBacktestResult,
} from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  strategy?: ParsedStrategy;
}

interface ParsedStrategy {
  name: string;
  mode: StrategyMode;
  symbol: string;
  timeframe: Timeframe;
  indicators: string[];
  leverage: number;
  riskLevel: string;
  description: string;
  pineScript: string;
}

interface RunResult {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
  investmentAmount?: number;
  errorMessage?: string | null;
  fallbackNote?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODE_DEFAULT_LEVERAGE: Record<StrategyMode, number> = {
  conservative: 2.5,
  aggressive: 4.0,
  "ai-pick": 2.5,
  "buy-low-sell-high": 2.5,
};

const MODE_LABELS: Record<StrategyMode, string> = {
  conservative: "Conservative",
  aggressive: "Aggressive",
  "ai-pick": "AI Pick",
  "buy-low-sell-high": "Buy Low Sell High",
};

// ─── Strategy Parser ──────────────────────────────────────────────────────────

const INDICATOR_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /\brsi\b/i, label: "RSI" },
  { pattern: /\bmacd\b/i, label: "MACD" },
  { pattern: /\bema\b/i, label: "EMA" },
  { pattern: /bollinger|bband|bb\b/i, label: "Bollinger Bands" },
  { pattern: /stochastic|stoch\b/i, label: "Stochastic" },
  { pattern: /\badx\b/i, label: "ADX" },
  { pattern: /\bcci\b/i, label: "CCI" },
  { pattern: /\bvwap\b/i, label: "VWAP" },
  { pattern: /williams|%r\b/i, label: "Williams %R" },
  { pattern: /donchian/i, label: "Donchian Channel" },
  { pattern: /\batr\b/i, label: "ATR" },
  { pattern: /volume/i, label: "Volume" },
  { pattern: /sma|moving average/i, label: "SMA" },
  { pattern: /supertrend/i, label: "Supertrend" },
  { pattern: /ichimoku/i, label: "Ichimoku" },
];

function parseStrategy(message: string): ParsedStrategy {
  const lower = message.toLowerCase();

  // Determine mode — default to ai-pick (optimizer) which runs multiple
  // variants and is far more likely to find trades than the strict HMM modes
  let mode: StrategyMode = "ai-pick";
  if (
    lower.includes("buy low") ||
    lower.includes("sell high") ||
    lower.includes("mean reversion") ||
    lower.includes("dip") ||
    lower.includes("cycle") ||
    lower.includes("oversold")
  ) {
    mode = "buy-low-sell-high";
  } else if (/\bconservative\b/.test(lower)) {
    // Only use HMM modes if user explicitly names them
    mode = "conservative";
  } else if (/\baggressive\b/.test(lower) && !lower.includes("nnfx")) {
    mode = "aggressive";
  }

  // Extract indicators
  const indicators: string[] = [];
  for (const { pattern, label } of INDICATOR_KEYWORDS) {
    if (pattern.test(message)) {
      indicators.push(label);
    }
  }
  if (indicators.length === 0) {
    indicators.push("EMA", "RSI");
  }

  // Extract timeframe
  let timeframe: Timeframe = "1d";
  if (/\b5\s?min|\b5m\b/i.test(message)) timeframe = "5m";
  else if (/\b15\s?min|\b15m\b/i.test(message)) timeframe = "15m";
  else if (/\b30\s?min|\b30m\b/i.test(message)) timeframe = "30m";
  else if (/\b1h\b|\b1-?hour/i.test(message)) timeframe = "1h";
  else if (/\b4h\b|\b4-?hour/i.test(message)) timeframe = "4h";
  else if (/\bweekly\b|\b1wk\b|\b1w\b/i.test(message)) timeframe = "1wk";
  else if (/\bmonthly\b|\b1mo\b/i.test(message)) timeframe = "1mo";

  // Extract symbol
  let symbol = "BTC-USD";
  const symMatch = message.match(/\b([A-Z]{2,5}-USD[T]?)\b/);
  if (symMatch) symbol = symMatch[1];
  else if (/\baapl\b/i.test(message)) symbol = "AAPL";
  else if (/\btsla\b/i.test(message)) symbol = "TSLA";
  else if (/\bnvda\b/i.test(message)) symbol = "NVDA";
  else if (/\bspy\b/i.test(message)) symbol = "SPY";
  else if (/\beth\b/i.test(message)) symbol = "ETH-USD";
  else if (/\bsol\b/i.test(message)) symbol = "SOL-USD";
  else if (/\bdoge\b/i.test(message)) symbol = "DOGE-USD";
  else if (/\bxrp\b/i.test(message)) symbol = "XRP-USD";
  else if (/forex|eur.*usd/i.test(message)) symbol = "EURUSD=X";
  else if (/gbp/i.test(message)) symbol = "GBPUSD=X";
  else if (/stock|equity/i.test(message)) symbol = "SPY";
  else if (/gold/i.test(message)) symbol = "GC=F";
  else if (/oil|crude/i.test(message)) symbol = "CL=F";

  const leverage = MODE_DEFAULT_LEVERAGE[mode];

  // Generate name
  const words = message
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const name = (words.join(" ") || "Custom Strategy").slice(0, 50);

  const riskMap: Record<StrategyMode, string> = {
    conservative: "Low",
    aggressive: "High",
    "ai-pick": "Medium",
    "buy-low-sell-high": "Medium",
  };

  const pineScript = generatePineScript(name, mode, indicators, leverage);

  return {
    name,
    mode,
    symbol,
    timeframe,
    indicators,
    leverage,
    riskLevel: riskMap[mode],
    description: message.slice(0, 200),
    pineScript,
  };
}

// ─── Pine Script Generator ────────────────────────────────────────────────────

interface Snippets {
  inputs: string[];
  calculations: string[];
  longConditions: string[];
  shortConditions: string[];
  plots: string[];
}

function buildSnippets(indicators: string[]): Snippets {
  const s: Snippets = { inputs: [], calculations: [], longConditions: [], shortConditions: [], plots: [] };
  const lower = indicators.map((i) => i.toLowerCase());

  if (lower.some((i) => i.includes("rsi"))) {
    s.inputs.push('rsiLength = input.int(14, "RSI Length", minval = 2)');
    s.inputs.push('rsiOversold = input.int(30, "RSI Oversold", minval = 10, maxval = 45)');
    s.inputs.push('rsiOverbought = input.int(70, "RSI Overbought", minval = 55, maxval = 90)');
    s.calculations.push("rsiVal = ta.rsi(close, rsiLength)");
    s.longConditions.push("rsiVal < rsiOverbought and rsiVal > rsiOversold");
    s.shortConditions.push("rsiVal > rsiOversold and rsiVal < rsiOverbought");
  }
  if (lower.some((i) => i.includes("macd"))) {
    s.inputs.push('macdFast = input.int(12, "MACD Fast", minval = 3)');
    s.inputs.push('macdSlow = input.int(26, "MACD Slow", minval = 10)');
    s.inputs.push('macdSig = input.int(9, "MACD Signal", minval = 3)');
    s.calculations.push("[macdLine, macdSignal, macdHist] = ta.macd(close, macdFast, macdSlow, macdSig)");
    s.longConditions.push("macdLine > macdSignal and macdHist > 0");
    s.shortConditions.push("macdLine < macdSignal and macdHist < 0");
  }
  if (lower.some((i) => i.includes("ema"))) {
    s.inputs.push('emaFast = input.int(21, "EMA Fast", minval = 5)');
    s.inputs.push('emaSlow = input.int(89, "EMA Slow", minval = 20)');
    s.calculations.push("emaFastVal = ta.ema(close, emaFast)");
    s.calculations.push("emaSlowVal = ta.ema(close, emaSlow)");
    s.longConditions.push("emaFastVal > emaSlowVal and close > emaFastVal");
    s.shortConditions.push("emaFastVal < emaSlowVal and close < emaFastVal");
    s.plots.push('plot(emaFastVal, "EMA Fast", color = color.new(color.blue, 0), linewidth = 1)');
    s.plots.push('plot(emaSlowVal, "EMA Slow", color = color.new(color.orange, 0), linewidth = 2)');
  }
  if (lower.some((i) => i.includes("bollinger") || i.includes("bb"))) {
    s.inputs.push('bbLen = input.int(20, "BB Length", minval = 5)');
    s.inputs.push('bbMult = input.float(2.0, "BB Mult", minval = 0.5, step = 0.1)');
    s.calculations.push("[bbMid, bbUpper, bbLower] = ta.bb(close, bbLen, bbMult)");
    s.longConditions.push("close <= bbLower * 1.01");
    s.shortConditions.push("close >= bbUpper * 0.99");
    s.plots.push('p1 = plot(bbUpper, "BB Upper", color = color.new(color.blue, 50))');
    s.plots.push('p3 = plot(bbLower, "BB Lower", color = color.new(color.blue, 50))');
    s.plots.push("fill(p1, p3, color = color.new(color.blue, 92))");
  }
  if (lower.some((i) => i.includes("stochastic") || i.includes("stoch"))) {
    s.inputs.push('stochLen = input.int(14, "Stoch %K Length", minval = 3)');
    s.inputs.push('stochSmooth = input.int(3, "Stoch %D Smooth", minval = 1)');
    s.calculations.push("stochK = ta.stoch(close, high, low, stochLen)");
    s.calculations.push("stochD = ta.sma(stochK, stochSmooth)");
    s.longConditions.push("stochK < 30 and ta.crossover(stochK, stochD)");
    s.shortConditions.push("stochK > 70 and ta.crossunder(stochK, stochD)");
  }
  if (lower.some((i) => i.includes("adx"))) {
    s.inputs.push('adxLen = input.int(14, "ADX Length", minval = 5)');
    s.inputs.push('adxThresh = input.int(25, "ADX Threshold", minval = 10, maxval = 50)');
    s.calculations.push("[diPlus, diMinus, adxVal] = ta.dmi(adxLen, adxLen)");
    s.longConditions.push("adxVal > adxThresh and diPlus > diMinus");
    s.shortConditions.push("adxVal > adxThresh and diMinus > diPlus");
  }
  if (lower.some((i) => i.includes("vwap"))) {
    s.calculations.push("vwapVal = ta.vwap(close)");
    s.longConditions.push("close > vwapVal");
    s.shortConditions.push("close < vwapVal");
    s.plots.push('plot(vwapVal, "VWAP", color = color.new(color.purple, 0), linewidth = 2)');
  }
  if (lower.some((i) => i.includes("sma"))) {
    s.inputs.push('smaLen = input.int(50, "SMA Length", minval = 5)');
    s.calculations.push("smaVal = ta.sma(close, smaLen)");
    s.longConditions.push("close > smaVal");
    s.shortConditions.push("close < smaVal");
    s.plots.push('plot(smaVal, "SMA", color = color.new(color.yellow, 0), linewidth = 1)');
  }

  // Always include volume + ATR
  s.calculations.push("volSma = ta.sma(volume, 20)");
  s.calculations.push("atrVal = ta.atr(14)");
  s.longConditions.push("volume > volSma * 0.8");
  s.shortConditions.push("volume > volSma * 0.8");

  return s;
}

function generatePineScript(name: string, mode: StrategyMode, indicators: string[], leverage: number): string {
  const snippets = buildSnippets(indicators);
  const longConds = snippets.longConditions.map((c, i) => `c${i + 1}L = ${c}`).join("\n");
  const shortConds = snippets.shortConditions.map((c, i) => `c${i + 1}S = ${c}`).join("\n");
  const longCount = snippets.longConditions.map((_, i) => `(c${i + 1}L ? 1 : 0)`).join(" + ");
  const shortCount = snippets.shortConditions.map((_, i) => `(c${i + 1}S ? 1 : 0)`).join(" + ");
  const minConfirms = Math.max(1, snippets.longConditions.length - 1);

  return `//@version=5
strategy(
  title            = "${name}",
  shorttitle       = "NGS-AI",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
leverage      = input.float(${leverage}, "Leverage", minval = 1.0, step = 0.5)
signalSpacing = input.int(4, "Min Bars Between Signals", minval = 1)
${snippets.inputs.join("\n")}

// === INDICATOR CALCULATIONS ===
${snippets.calculations.join("\n")}

// === CONFIRMATION LOGIC ===
${longConds}

${shortConds}

longConfirms  = ${longCount || "0"}
shortConfirms = ${shortCount || "0"}

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and longConfirms  >= ${minConfirms} and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and shortConfirms >= ${minConfirms} and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
longStop  = close - atrVal * 2.0
shortStop = close + atrVal * 2.0

// === STRATEGY ORDERS ===
qtyLevered = (strategy.equity * leverage) / close

if longEntry
    strategy.entry("Long", strategy.long, qty = qtyLevered)
if shortEntry
    strategy.entry("Short", strategy.short, qty = qtyLevered)

if strategy.position_size > 0
    strategy.exit("Long Exit", "Long", stop = longStop)
if strategy.position_size < 0
    strategy.exit("Short Exit", "Short", stop = shortStop)

// === PLOTS ===
plotshape(longEntry,  title = "Long",  style = shape.triangleup,   location = location.belowbar, color = color.green, size = size.small)
plotshape(shortEntry, title = "Short", style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.small)
${snippets.plots.join("\n")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiStrategyBuilder() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Describe a trading strategy and I'll build it for you. I'll detect indicators, set the right mode, generate Pine Script, and let you backtest it immediately.\n\nExamples:\n- \"Momentum breakout using Bollinger Bands and RSI for BTC-USD on 4H\"\n- \"Conservative EMA crossover strategy for AAPL daily\"\n- \"Aggressive scalping with MACD and Stochastic on 1H\"",
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<ParsedStrategy | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [investmentAmount, setInvestmentAmount] = useState<string>("");
  const [customSymbol, setCustomSymbol] = useState<string>("");
  const [customTimeframe, setCustomTimeframe] = useState<Timeframe>("1d");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);
    setRunResult(null);

    setTimeout(() => {
      const strategy = parseStrategy(trimmed);
      setActiveStrategy(strategy);
      setCustomSymbol(strategy.symbol);
      setCustomTimeframe(strategy.timeframe);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: `I've built **"${strategy.name}"** for you!\n\n**Mode:** ${MODE_LABELS[strategy.mode]}\n**Risk:** ${strategy.riskLevel}\n**Symbol:** ${strategy.symbol}\n**Timeframe:** ${strategy.timeframe}\n**Indicators:** ${strategy.indicators.join(", ")}\n**Leverage:** ${strategy.leverage}x\n\nPine Script v5 code is ready. You can view it, copy it, or run a backtest below.`,
        strategy,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 1200);
  }, [input, isThinking]);

  const { mutate: runBacktest, isPending: isRunning } = useMutation({
    mutationFn: async () => {
      if (!activeStrategy) throw new Error("No strategy");

      const inv = investmentAmount ? parseFloat(investmentAmount) : undefined;
      const sym = customSymbol.trim().toUpperCase() || activeStrategy.symbol;

      // Helper to run a single backtest attempt
      async function attemptBacktest(mode: StrategyMode, tf: Timeframe) {
        const request = {
          symbol: sym,
          timeframe: tf,
          mode,
          leverage: activeStrategy!.leverage,
          dry_run: true,
        };
        let raw: any;
        if (mode === "ai-pick") {
          raw = await strategyApi.runAiPick(request);
        } else if (mode === "buy-low-sell-high") {
          raw = await strategyApi.runBuyLowSellHigh(request);
        } else {
          raw = await backtestApi.run(request);
        }
        const runId: number = raw.id ?? raw.run?.id;
        const [chartData, trades, variants] = await Promise.all([
          backtestApi.chartData(runId).catch(() => undefined),
          backtestApi.trades(runId).catch(() => [] as BacktestTrade[]),
          (mode === "ai-pick" || mode === "buy-low-sell-high")
            ? backtestApi.leaderboard(runId).catch(() => [])
            : Promise.resolve([]),
        ]);
        return { raw, runId, chartData, trades, variants, mode, tf };
      }

      // Build a prioritised list of attempts:
      // 1. User's chosen mode + timeframe
      // 2. Fallback: try other modes / daily timeframe
      const attempts: { mode: StrategyMode; tf: Timeframe }[] = [
        { mode: activeStrategy.mode, tf: customTimeframe },
      ];
      // If not already ai-pick, add ai-pick as fallback
      if (activeStrategy.mode !== "ai-pick") {
        attempts.push({ mode: "ai-pick", tf: customTimeframe });
      }
      // If not already buy-low-sell-high, add it
      if (activeStrategy.mode !== "buy-low-sell-high") {
        attempts.push({ mode: "buy-low-sell-high", tf: customTimeframe });
      }
      // Try daily timeframe if user picked something else
      if (customTimeframe !== "1d") {
        attempts.push({ mode: "ai-pick", tf: "1d" });
      }

      let bestResult: Awaited<ReturnType<typeof attemptBacktest>> | null = null;
      let fallbackUsed = false;

      for (const attempt of attempts) {
        try {
          const result = await attemptBacktest(attempt.mode, attempt.tf);
          if (result.trades.length > 0) {
            bestResult = result;
            fallbackUsed = attempt !== attempts[0];
            break;
          }
          // Keep first result even if 0 trades (to show something)
          if (!bestResult) bestResult = result;
        } catch {
          // If this attempt errors, try next
          continue;
        }
      }

      if (!bestResult) throw new Error("All backtest attempts failed");

      const { raw, runId, chartData, trades, variants } = bestResult;

      const totalReturnPct = trades.reduce((s, t) => s + (t.leveraged_return_pct ?? t.return_pct), 0);
      const maxDrawdownPct = trades.length > 0
        ? Math.min(...trades.map((t) => t.leveraged_return_pct ?? t.return_pct))
        : 0;
      const wins = trades.filter((t) => t.return_pct >= 0).length;
      const avgRet = trades.length > 0 ? totalReturnPct / trades.length : 0;
      const stdDev = trades.length > 1
        ? Math.sqrt(trades.reduce((s, t) => s + Math.pow((t.leveraged_return_pct ?? t.return_pct) - avgRet, 2), 0) / (trades.length - 1))
        : 1;

      const summary: BacktestSummary = {
        run: {
          id: runId,
          user_id: raw.user_id,
          created_at: raw.created_at,
          run_type: raw.run_type ?? "backtest",
          mode_name: raw.mode_name,
          strategy_family: raw.strategy_family ?? null,
          symbol: raw.symbol,
          timeframe: raw.timeframe,
          leverage: raw.leverage,
          min_confirmations: raw.min_confirmations ?? null,
          trailing_stop_pct: raw.trailing_stop_pct ?? null,
          current_regime: raw.current_regime ?? null,
          current_signal: raw.current_signal ?? null,
          confirmation_count: raw.confirmation_count ?? null,
          selected_variant_name: raw.selected_variant_name ?? null,
          selected_variant_score: raw.selected_variant_score ?? null,
          notes: raw.notes ?? null,
          error_message: raw.error_message ?? null,
        },
        total_return_pct: totalReturnPct,
        max_drawdown_pct: maxDrawdownPct,
        sharpe_like: stdDev > 0 ? avgRet / stdDev : 0,
        trade_count: trades.length,
        win_rate: trades.length > 0 ? wins / trades.length : 0,
      };

      const fallbackNote = fallbackUsed
        ? `\n\n*Switched to **${MODE_LABELS[bestResult.mode as StrategyMode]}** mode on **${bestResult.tf}** timeframe to find trades.*`
        : "";

      return { summary, chartData, trades, variants, investmentAmount: inv, errorMessage: raw.error_message, fallbackNote };
    },
    onSuccess: (result) => {
      setRunResult(result);
      getQueryClient().invalidateQueries({ queryKey: ["strategies", "runs"] });
      getQueryClient().invalidateQueries({ queryKey: ["backtests"] });

      // Post a result message to the chat
      const tradeCount = result.trades.length;
      if (result.errorMessage) {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `The backtest encountered an issue: ${result.errorMessage}\n\nTry a different symbol or timeframe.`,
        };
        setMessages((prev) => [...prev, errMsg]);
        toast.error("Backtest had errors");
      } else if (tradeCount === 0) {
        const noTradesMsg: ChatMessage = {
          id: `notrades-${Date.now()}`,
          role: "assistant",
          text: `The backtest completed but found **0 trades** for ${result.summary.run.symbol} on ${result.summary.run.timeframe}.\n\nThis means the ${MODE_LABELS[activeStrategy!.mode]} strategy's signal conditions were never met in the historical data. Try:\n- A different **symbol** (e.g. BTC-USD, AAPL, SPY)\n- A different **timeframe** (1d usually has more signals than 1h)\n- A different **strategy mode** (Conservative or AI Pick may find more signals)`,
        };
        setMessages((prev) => [...prev, noTradesMsg]);
        toast.info("No trades found — try different parameters");
      } else {
        const inv = result.investmentAmount ?? 10000;
        const totalRetPct = result.summary.total_return_pct;
        const profit = inv * (totalRetPct / 100);
        const successMsg: ChatMessage = {
          id: `result-${Date.now()}`,
          role: "assistant",
          text: `Backtest complete! **${tradeCount} trades** found.\n\n**Return:** ${totalRetPct >= 0 ? "+" : ""}${totalRetPct.toFixed(2)}%\n**Profit:** ${profit >= 0 ? "+" : ""}$${Math.abs(profit).toFixed(2)}\n**Win Rate:** ${(result.summary.win_rate * 100).toFixed(1)}%${result.fallbackNote ?? ""}\n\nScroll down for full results, charts, and trade-by-trade breakdown.`,
        };
        setMessages((prev) => [...prev, successMsg]);
        toast.success(`Backtest complete — ${tradeCount} trades`);
      }
    },
    onError: (err: Error) => {
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        text: `Backtest failed: ${err.message}\n\nMake sure the backend is running and the symbol is valid for yfinance.`,
      };
      setMessages((prev) => [...prev, errMsg]);
      toast.error(err.message ?? "Backtest failed");
    },
  });

  async function handleCopyCode() {
    if (!activeStrategy) return;
    try {
      await navigator.clipboard.writeText(activeStrategy.pineScript);
      toast.success("Pine Script copied to clipboard");
    } catch {
      toast.error("Clipboard access denied");
    }
  }

  return (
    <div className="space-y-6">
      {/* Chat Area */}
      <Card>
        <CardHeader className="px-4 sm:px-6 pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Strategy Builder
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Describe your strategy idea in plain English. I'll build a runnable strategy with Pine Script.
          </p>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* Messages */}
          <ScrollArea className="h-[300px] sm:h-[350px] mb-4 rounded-lg border border-border bg-background p-3">
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    msg.role === "user" ? "bg-primary/20" : "bg-primary/10"
                  }`}>
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-primary" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex gap-3">
                  <div className="shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building your strategy...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe your strategy... e.g. 'Momentum breakout with RSI and MACD for TSLA on daily'"
              className="flex-1 min-h-[56px] sm:min-h-[64px] max-h-[120px] resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm sm:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isThinking}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              className="h-[56px] sm:h-[64px] w-[56px] sm:w-[64px] shrink-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for newline
          </p>
        </CardContent>
      </Card>

      {/* Strategy Result & Actions */}
      {activeStrategy && (
        <>
          {/* Strategy Card */}
          <Card className="border-primary/30">
            <CardHeader className="px-4 sm:px-6 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">{activeStrategy.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge className="text-xs">{MODE_LABELS[activeStrategy.mode]}</Badge>
                    <Badge variant="outline" className="text-xs">{activeStrategy.riskLevel} Risk</Badge>
                    <Badge variant="secondary" className="text-xs font-mono">{activeStrategy.symbol}</Badge>
                    <Badge variant="secondary" className="text-xs">{activeStrategy.timeframe}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCode(!showCode)} className="text-sm h-10">
                    <Code className="h-4 w-4 mr-1.5" />
                    {showCode ? "Hide" : "View"} Code
                    {showCode ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyCode} className="text-sm h-10">
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy
                  </Button>
                </div>
              </div>
            </CardHeader>

            {showCode && (
              <CardContent className="px-4 sm:px-6 pt-0">
                <ScrollArea className="max-h-[400px] rounded-lg border border-border bg-background">
                  <pre className="p-4 text-xs sm:text-sm font-mono text-foreground whitespace-pre overflow-x-auto">
                    {activeStrategy.pineScript}
                  </pre>
                </ScrollArea>
              </CardContent>
            )}
          </Card>

          {/* Backtest Controls */}
          <Card>
            <CardHeader className="px-4 sm:px-6 pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Run Backtest
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Investment Amount (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="100"
                      min="1"
                      placeholder="10,000"
                      value={investmentAmount}
                      onChange={(e) => setInvestmentAmount(e.target.value)}
                      className="pl-9 h-12 text-lg font-bold"
                      disabled={isRunning}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base font-semibold">Symbol</Label>
                    <Input
                      value={customSymbol}
                      onChange={(e) => setCustomSymbol(e.target.value.toUpperCase())}
                      placeholder="AAPL, BTC-USD, TSLA, SPY..."
                      className="h-12 text-lg font-mono font-bold"
                      disabled={isRunning}
                    />
                    <p className="text-xs text-muted-foreground">Type any yfinance ticker</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm sm:text-base font-semibold">Timeframe</Label>
                    <Select
                      value={customTimeframe}
                      onValueChange={(v) => setCustomTimeframe(v as Timeframe)}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5m" className="text-base">5 Min</SelectItem>
                        <SelectItem value="15m" className="text-base">15 Min</SelectItem>
                        <SelectItem value="30m" className="text-base">30 Min</SelectItem>
                        <SelectItem value="1h" className="text-base">1 Hour</SelectItem>
                        <SelectItem value="4h" className="text-base">4 Hour</SelectItem>
                        <SelectItem value="1d" className="text-base">Daily</SelectItem>
                        <SelectItem value="1wk" className="text-base">Weekly</SelectItem>
                        <SelectItem value="1mo" className="text-base">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-card border border-border rounded-lg p-2.5">
                      <span className="text-xs text-muted-foreground block">Mode</span>
                      <span className="font-semibold">{MODE_LABELS[activeStrategy.mode]}</span>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-2.5">
                      <span className="text-xs text-muted-foreground block">Leverage</span>
                      <span className="font-semibold">{activeStrategy.leverage}x</span>
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => runBacktest()}
                disabled={isRunning}
                className="w-full h-12 text-base sm:text-lg"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Running Backtest...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Run Backtest — {customSymbol || activeStrategy.symbol} ({customTimeframe})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {runResult && (
            <ResultsPanel
              summary={runResult.summary}
              chartData={runResult.chartData}
              trades={runResult.trades}
              variants={runResult.variants}
              investmentAmount={runResult.investmentAmount}
            />
          )}
        </>
      )}
    </div>
  );
}
