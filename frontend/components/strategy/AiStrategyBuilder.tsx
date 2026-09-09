"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { backtestApi, strategyApi } from "@/lib/api";
import { summarizeBacktest } from "@/lib/backtest-summary";
import { getQueryClient } from "@/lib/queryClient";
import { MODE_LABELS, parseStrategy, type ParsedStrategy } from "@/lib/strategy-template";
import type {
  BacktestSummary, BacktestTrade, ChartData, StrategyMode, Timeframe, VariantBacktestResult,
} from "@/types";
import { useMutation } from "@tanstack/react-query";
import {
  Bot, ChevronDown, ChevronUp, Code, Copy, DollarSign, Loader2, Play, Send, Sparkles, User,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ResultsPanel } from "./ResultsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  strategy?: ParsedStrategy;
}

interface RunResult {
  summary: BacktestSummary;
  chartData?: ChartData;
  trades: BacktestTrade[];
  variants: VariantBacktestResult[];
  investmentAmount?: number;
  errorMessage?: string | null;
  fallbackNote?: string;
  referenceMode: StrategyMode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export function AiStrategyBuilder() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Describe a strategy to create a Pine Script template. Test the generated rules in TradingView. The reference backtest below runs this app's predefined strategy engine, which uses different rules.\n\nExamples:\n- \"Momentum breakout using Bollinger Bands and RSI for BTC-USD on 4H\"\n- \"Conservative EMA crossover strategy for AAPL daily\"\n- \"Aggressive scalping with MACD and Stochastic on 1H\"",
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
        text: `I've prepared a template for **"${strategy.name}"** for you!\n\n**Mode:** ${MODE_LABELS[strategy.mode]}\n**Risk:** ${strategy.riskLevel}\n**Symbol:** ${strategy.symbol}\n**Timeframe:** ${strategy.timeframe}\n**Indicators:** ${strategy.indicators.join(", ")}\n**Leverage:** ${strategy.leverage}x\n\nPine Script v5 template is ready to review and test in TradingView. The reference backtest below tests the predefined app mode; it does not execute this template.`,
        strategy,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 1200);
  }, [input, isThinking]);

  const { mutate: runBacktest, isPending: isRunning } = useMutation({
    mutationFn: async () => {
      if (!activeStrategy) throw new Error("No strategy");
      if (!["1h", "4h", "1d", "1wk", "1mo"].includes(customTimeframe)) throw new Error("Choose a supported reference timeframe: 1h, 4h, daily, weekly, or monthly");

      const inv = investmentAmount ? Number(investmentAmount) : undefined;
      if (inv !== undefined && (!Number.isFinite(inv) || inv <= 0)) throw new Error("Enter a positive investment amount");
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
          backtestApi.trades(runId),
          (mode === "ai-pick" || mode === "buy-low-sell-high")
            ? backtestApi.leaderboard(runId).catch(() => [])
            : Promise.resolve([]),
        ]);
        return { raw, runId, chartData, trades, variants, mode, tf };
      }

      // Run exactly the selected setup; zero trades or an error is useful evidence.
      const { raw, chartData, trades, variants } = await attemptBacktest(activeStrategy.mode, customTimeframe);
      const summary = summarizeBacktest(raw, trades);
      const fallbackNote = "";

      return { summary, chartData, trades, variants, referenceMode: activeStrategy.mode, investmentAmount: inv, errorMessage: raw.error_message, fallbackNote };
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
          text: `The backtest completed but found **0 trades** for ${result.summary.run.symbol} on ${result.summary.run.timeframe}.\n\nThis means the ${MODE_LABELS[result.referenceMode]} strategy's signal conditions were never met in the historical data. Try:\n- A different **symbol** (e.g. BTC-USD, AAPL, SPY)\n- A different **timeframe** (1d usually has more signals than 1h)\n- A different **strategy mode** (Conservative or AI Pick may find more signals)`,
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
          text: `Reference strategy backtest complete! **${tradeCount} trades** found.\n\n**Return:** ${totalRetPct >= 0 ? "+" : ""}${totalRetPct.toFixed(2)}%\n**Profit:** ${profit >= 0 ? "+" : ""}$${Math.abs(profit).toFixed(2)}\n**Win Rate:** ${(result.summary.win_rate * 100).toFixed(1)}%${result.fallbackNote ?? ""}\n\nScroll down for full results, charts, and trade-by-trade breakdown.`,
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
            Script template builder
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Describe your strategy idea in plain English. I&apos;ll build a runnable strategy with Pine Script.
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
              disabled={isThinking || isRunning}
            />
            <Button
              aria-label="Create strategy template"
              onClick={handleSend}
              disabled={!input.trim() || isThinking || isRunning}
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
                Test reference strategy
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <p className="mb-4 text-sm text-muted-foreground">Tests the predefined {MODE_LABELS[activeStrategy.mode]} engine for the selected symbol and timeframe. Generated Pine Script and its indicator settings are not executed by this backtest.</p>
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
                      onChange={(e) => { setCustomSymbol(e.target.value.toUpperCase()); setRunResult(null); }}
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
                      onValueChange={(v) => { setCustomTimeframe(v as Timeframe); setRunResult(null); }}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {!["1h", "4h", "1d", "1wk", "1mo"].includes(customTimeframe) && <SelectItem value={customTimeframe} disabled>{customTimeframe} (template only; choose a reference timeframe)</SelectItem>}
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
                    Test reference strategy — {customSymbol || activeStrategy.symbol} ({customTimeframe})
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {runResult && (
            <>
            <p className="text-sm text-muted-foreground">Reference results: {MODE_LABELS[runResult.referenceMode]} engine. These results do not validate the generated Pine Script.</p>
            <ResultsPanel
              summary={runResult.summary}
              chartData={runResult.chartData}
              trades={runResult.trades}
              variants={runResult.variants}
              investmentAmount={runResult.investmentAmount}
            />
            </>
          )}
        </>
      )}
    </div>
  );
}
