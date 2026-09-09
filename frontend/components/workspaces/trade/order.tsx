"use client";
import { BrokerLedger } from "@/components/trading/BrokerLedger";
import { BuySellToggle, CollapsibleSection, CredentialBadge, PaperStatCard, SignalDecisionBanner, SignalResultPanel, Tip, buildSignalMarkers, formatVolume } from "@/components/trading/desk-components";
import { useOrderExecution } from "@/components/trading/useOrderExecution";
import { LIVE_REFRESH_MS, refreshTrading, tradingKeys } from "@/lib/trading-queries";

/**
 * /live-trading — Sovereign Terminal Live Trading Page
 *
 * Guided 3-step workflow:
 *   Step 1: Setup — broker, symbol, timeframe, strategy mode
 *   Step 2: Analyze — run signal check, view indicator breakdown
 *   Step 3: Execute — place order (dry-run or live)
 *
 * Chart is always visible alongside workflow steps.
 * Positions & orders in collapsible sections below.
 */

import { PriceChart } from "@/components/charts/PriceChart";
import { useAuth } from "@/components/layout/AppShell";
import { WorkspaceSection as AppShell } from "@/components/layout/WorkspaceSection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { brokerApi, liveApi } from "@/lib/api";
import { usePaperPortfolio } from "@/lib/paperTrading";
import { useTheme } from "@/lib/theme";
import { logLiveTrade } from "@/lib/tradeLog";
import {
  cn, formatCurrency, getErrorMessage
} from "@/lib/utils";
import type {
  SignalCheckResult, Timeframe
} from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CandlestickChart, Check, FlaskConical, RefreshCw, RotateCcw, Wallet, Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const executeSchema = z.object({
  side: z.enum(["buy", "sell"]),
  amount: z.preprocess(
    (v) => Number(v),
    z.number().finite("Enter a finite amount").positive("Amount must be positive")
  ),
});
type ExecuteFormValues = z.infer<typeof executeSchema>;

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

type TradingMode = "paper" | "dry-run" | "live";

const TRADING_MODES: { value: TradingMode; label: string; icon: typeof FlaskConical; description: string; color: string }[] = [
  { value: "paper", label: "PAPER", icon: Wallet, description: "Virtual $100K portfolio", color: "text-primary" },
  { value: "dry-run", label: "DRY RUN", icon: FlaskConical, description: "One-off simulation", color: "text-muted-foreground" },
  { value: "live", label: "LIVE", icon: Zap, description: "Real money orders", color: "text-destructive" },
];

const TIMEFRAMES: { value: Timeframe; label: string; short: string }[] = [
  { value: "1h", label: "1 Hour", short: "1H" },
  { value: "4h", label: "4 Hour", short: "4H" },
  { value: "1d", label: "Daily", short: "1D" },
  { value: "1wk", label: "Weekly", short: "1W" },
];

export default function LiveTradingPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [committedSymbol, setCommittedSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [mode, setMode] = useState<"conservative" | "aggressive" | "squeeze">("conservative");
  const [tradingMode, setTradingMode] = useState<TradingMode>("paper");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [signalResult, setSignalResult] = useState<SignalCheckResult | null>(null);
  const [positionsOpen, setPositionsOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [paperPositionsOpen, setPaperPositionsOpen] = useState(true);
  const [paperHistoryOpen, setPaperHistoryOpen] = useState(false);

  const signalKey = `${selectedCredentialId}:${committedSymbol}:${timeframe}:${mode}`;
  const currentSignalKey = useRef(signalKey);
  currentSignalKey.current = signalKey;
  useEffect(() => { setSignalResult(null); }, [signalKey]);

  // Paper trading engine
  const { portfolio, executePaperOrder, resetPortfolio, stats: paperStats } = usePaperPortfolio();

  // Derived from trading mode
  const dryRun = tradingMode !== "live";
  const isPaper = tradingMode === "paper";

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: tradingKeys.credentials(user?.id),
    queryFn: brokerApi.list,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: tradingKeys.positions(user?.id),
    queryFn: liveApi.positions,
    enabled: !!user, refetchInterval: LIVE_REFRESH_MS,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: tradingKeys.orders(user?.id),
    queryFn: () => liveApi.orders(),
    enabled: !!user, refetchInterval: LIVE_REFRESH_MS,
  });

  const { data: chartData } = useQuery({
    queryKey: ["live", "chart-data", committedSymbol, timeframe, mode === "squeeze"],
    queryFn: () => liveApi.chartData(committedSymbol, timeframe, mode === "squeeze"),
    enabled: /^[A-Z][A-Z0-9.\/-]{0,14}$/.test(committedSymbol),
  });

  const { mutate: runSignalCheck, isPending: isSignalChecking } = useMutation({
    mutationFn: async () => {
      if (!selectedCredentialId) throw new Error("Select a broker credential");
      const result = await liveApi.signalCheck({
        symbol: committedSymbol,
        timeframe,
        mode,
        credential_id: selectedCredentialId,
      });
      return { result, key: signalKey };
    },
    onSuccess: ({ result, key }) => {
      if (key !== currentSignalKey.current) return;
      setSignalResult(result);
      toast.success("Signal check complete");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Signal check failed"));
    },
  });

  const {
    register: registerExecute,
    handleSubmit: handleExecuteSubmit,
    formState: { errors: executeErrors },
    setValue: setExecuteValue,
    watch: watchExecute,
  } = useForm<ExecuteFormValues>({
    resolver: zodResolver(executeSchema),
    defaultValues: { side: "buy", amount: 0 },
  });

  const { executeOrder, isExecuting, pendingOrder, recoverOrder } = useOrderExecution({
    accountId: user?.id, symbol: committedSymbol, credentialId: selectedCredentialId, isPaper, dryRun,
    price: chartData?.candles?.at(-1)?.close, timeframe, mode,
    signal: signalResult?.signal, confirmationCount: signalResult?.confirmation_count,
    strategyRunId: signalResult?.strategy_run_id, executePaperOrder,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: tradingKeys.orders(user?.id) });
      queryClient.invalidateQueries({ queryKey: tradingKeys.positions(user?.id) });

      if (order._paper) {
        const pnlStr = order._realizedPnl != null
          ? ` (P&L: ${order._realizedPnl >= 0 ? "+" : ""}$${order._realizedPnl.toFixed(2)})`
          : "";
        toast.success(
          `[PAPER] ${order._action === "close" ? "Closed" : "Opened"} ${order.side?.toUpperCase()} $${order.notional_usd?.toFixed(2)} ${order.symbol}${pnlStr}`
        );
      } else {
        const label = order.dry_run ? "[DRY RUN] " : "";
        const amt = order.notional_usd != null ? ` $${Number(order.notional_usd).toFixed(2)}` : "";
        toast.success(`${label}Order submitted: ${order.side?.toUpperCase()}${amt} ${order.symbol}`);
      }

      // Log to trade log
      try { logLiveTrade({
        accountId: order._context.accountId,
        id: order._tradeId ?? `broker-${order.id}`,
        symbol: order.symbol,
        side: (order.side as "buy" | "sell") ?? "buy",
        amountUsd: order.notional_usd ?? null,
        dryRun: order._paper ? true : order.dry_run,
        paper: !!order._paper,
        closing: order._action === "close",
        realizedPnl: order._realizedPnl,
        timeframe: order._context.timeframe,
        mode: order._context.mode,
        signal: order._context.signal ?? null,
        confirmationCount: order._context.confirmationCount ?? null,
      }); } catch { toast.error("Order recorded, but the browser journal could not be saved. Check order history before trying again."); }
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Order execution failed"));
    },
  });

  const selectedCredential = credentials.find((c) => c.id === selectedCredentialId);

  const handleModeChange = useCallback((newMode: TradingMode) => {
    if (newMode === "live") {
      setShowLiveConfirm(true);
    } else {
      setTradingMode(newMode);
    }
  }, []);

  function confirmLiveMode() {
    setTradingMode("live");
    setShowLiveConfirm(false);
    toast.warning("LIVE MODE enabled — real money at risk");
  }

  function refreshData() {
    void refreshTrading(queryClient, user?.id);
    toast.info("Refreshed");
  }

  // Derive latest price stats from chart candles
  const chartStats = useMemo(() => {
    if (!chartData?.candles?.length) return null;
    const candles = chartData.candles;
    const latest = candles[candles.length - 1];
    const prev = candles.length > 1 ? candles[candles.length - 2] : latest;
    const change = latest.close - prev.close;
    const changePct = prev.close !== 0 ? (change / prev.close) * 100 : 0;
    const high24 = Math.max(...candles.slice(-24).map((c) => c.high));
    const low24 = Math.min(...candles.slice(-24).map((c) => c.low));
    const totalVol = candles.slice(-24).reduce((s, c) => s + (c.volume ?? 0), 0);
    return {
      price: latest.close,
      open: latest.open,
      high: latest.high,
      low: latest.low,
      change,
      changePct,
      high24,
      low24,
      volume: totalVol,
      isUp: change >= 0,
    };
  }, [chartData]);

  // Derived state
  const brokerReady = !!selectedCredentialId;
  const signalReady = !!signalResult;
  const openPositionCount = positions.filter((p) => p.is_open).length;


  return (
    <AppShell title="Live Trading">
      {pendingOrder && <Alert className="mb-4">
        <AlertTitle>Order awaiting confirmation</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>{pendingOrder.request.side.toUpperCase()} ${pendingOrder.request.notional_usd} {pendingOrder.request.symbol}. Recovering checks or retries the original request using the same order ID.</p>
          <Button disabled={isExecuting} onClick={recoverOrder}>Recover saved order</Button>
        </AlertDescription>
      </Alert>}

      {/* ── Status Header Strip ── */}
      <div className="min-h-[2.5rem] bg-surface-low border-b border-border/10 flex items-center px-3 sm:px-4 justify-between mb-4 -mt-1 -mx-1 sm:-mx-1 flex-wrap gap-y-1 py-1.5 sm:py-0">
        <div className="flex items-center gap-5 overflow-x-auto">
          {/* Mode pill */}
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                tradingMode === "live"
                  ? "bg-destructive animate-pulse"
                  : tradingMode === "paper"
                    ? "bg-primary animate-pulse"
                    : "bg-muted-foreground"
              )}
            />
            <span className="text-2xs uppercase tracking-widest font-bold text-muted-foreground">Mode:</span>
            <span
              className={cn(
                "text-2xs font-bold px-1.5 py-0.5 rounded-sm",
                tradingMode === "live"
                  ? "text-destructive bg-destructive/10"
                  : tradingMode === "paper"
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground bg-surface-high"
              )}
            >
              {tradingMode === "paper" ? "PAPER TRADING" : tradingMode === "dry-run" ? "DRY RUN" : "LIVE TRADING"}
            </span>
          </div>

          <div className="h-4 w-px bg-border/20 shrink-0" />

          {/* Balance */}
          {isPaper && (
            <>
              <div className="flex flex-col shrink-0">
                <span className="text-3xs text-muted-foreground uppercase leading-none">Paper cash</span>
                <span className="text-xs font-bold tabular-nums text-foreground">
                  ${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-4 w-px bg-border/20 shrink-0" />
            </>
          )}

          {/* Symbol */}
          <div className="flex flex-col shrink-0">
            <span className="text-3xs text-muted-foreground uppercase leading-none">Symbol</span>
            <span className="text-xs font-bold text-foreground">
              {committedSymbol}
              {chartStats && (
                <span className={cn("font-normal text-2xs ml-1.5", chartStats.isUp ? "text-primary" : "text-destructive")}>
                  {chartStats.isUp ? "+" : ""}{chartStats.changePct.toFixed(2)}%
                </span>
              )}
            </span>
          </div>

          <div className="h-4 w-px bg-border/20 shrink-0" />

          {/* Strategy */}
          <div className="flex flex-col shrink-0">
            <span className="text-3xs text-muted-foreground uppercase leading-none">Strategy</span>
            <span className="text-xs font-bold text-foreground capitalize">{mode} ({timeframe})</span>
          </div>
        </div>
      </div>

      {/* ── Live Mode Warning Banner ── */}
      {tradingMode === "live" && (
        <div className="flex items-center gap-3 rounded-sm border border-destructive/30 bg-destructive/10 px-4 py-2.5 mb-4">
          <Zap className="h-3.5 w-3.5 text-destructive shrink-0" />
          <p className="text-xs font-bold text-destructive tracking-wide">LIVE MODE ACTIVE</p>
          <p className="text-2xs text-muted-foreground ml-1">
            Real money orders will be submitted to your broker. Switch to Paper or Dry Run to return to simulation.
          </p>
        </div>
      )}

      {/* ── Beginner Guide Banner ── */}
      <details className="mb-4 border-b border-border pb-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">How to place a trade</summary>
        <ol className="list-decimal space-y-2 pl-5 text-muted-foreground"><li>Choose a stock, timeframe, and strategy.</li><li>Connect a broker to check the signal and review its indicators.</li><li>Set the order amount and side. Paper mode uses virtual funds; live mode requires confirmation.</li></ol>
      </details>

      {/* ── Main 3-column terminal layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] xl:grid-cols-[20rem_1fr_16rem] gap-0 rounded-sm overflow-hidden border border-border/10">

        {/* ════ LEFT — Execution Desk ════ */}
        <section className="bg-surface-low border-r border-border/10 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-6">

            {/* ── Step 1: Setup ── */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-3xs font-bold shrink-0",
                    brokerReady ? "bg-primary/20 text-primary" : "bg-surface-high text-muted-foreground"
                  )}
                >
                  {brokerReady ? <Check className="h-2.5 w-2.5" /> : "1"}
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Setup</h3>
              </div>

              <div className="space-y-3">
                {/* Broker Credential */}
                <div>
                  <label className="flex items-center gap-1 text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                    Broker Credential
                    <Tip text="Your broker account connection (e.g. Alpaca). Required for Dry Run and Live modes. Paper mode works without one." />
                  </label>
                  {credsLoading ? (
                    <Skeleton className="h-9 w-full bg-surface-highest" />
                  ) : credentials.length === 0 ? (
                    <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-2.5 text-2xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 text-amber-500 inline mr-1.5" />
                      No credentials.{" "}
                      <a href="/settings?view=account" className="underline text-primary">
                        Add in Settings
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(v) => setSelectedCredentialId(Number(v))}>
                        <SelectTrigger aria-label="Broker credential" className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50 flex-1">
                          <SelectValue placeholder="Select credential..." />
                        </SelectTrigger>
                        <SelectContent>
                          {credentials.filter((c) => c.is_active).map((cred) => (
                            <SelectItem key={cred.id} value={String(cred.id)}>
                              {cred.profile_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCredential && (
                        <CredentialBadge credential={selectedCredential} />
                      )}
                    </div>
                  )}
                </div>

                {/* Symbol + Timeframe row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="flex items-center gap-1 text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                      Symbol
                      <Tip text="The stock or ETF ticker. Examples: AAPL (Apple), TSLA (Tesla), SPY (S&P 500 ETF). Start with well-known stocks." />
                    </label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      aria-label="Stock symbol"
                      onBlur={() => setCommittedSymbol(symbol.trim().toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setCommittedSymbol(symbol.trim().toUpperCase());
                        }
                      }}
                      placeholder="AAPL"
                      className="h-9 text-xs bg-surface-highest border-none font-bold focus:ring-1 focus:ring-primary/50 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                      Timeframe
                      <Tip text="How much time each candle on the chart represents. Daily (1d) is best for beginners — it's slower and less noisy than hourly." />
                    </label>
                    <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                      <SelectTrigger aria-label="Timeframe" className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1d">Daily (1d) — recommended</SelectItem>
                        <SelectItem value="1h">Hourly (1h)</SelectItem>
                        <SelectItem value="4h">4-Hour (4h)</SelectItem>
                        <SelectItem value="1wk">Weekly (1wk)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Strategy Mode */}
                <div>
                  <label className="flex items-center gap-1 text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                    Strategy Profile
                    <Tip text="The set of rules the AI uses to evaluate buy/sell signals. Conservative requires more confirmations before triggering — safer for beginners." />
                  </label>
                  <Select value={mode} onValueChange={(v) => setMode(v as "conservative" | "aggressive" | "squeeze")}>
                    <SelectTrigger aria-label="Strategy profile" className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">
                        <div className="flex items-center gap-2">
                          <span>Conservative Growth</span>
                          <span className="text-3xs text-amber-400 font-bold">★ For beginners</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="aggressive">Aggressive Scalp — higher risk</SelectItem>
                      <SelectItem value="squeeze">BB Squeeze — volatility breakouts</SelectItem>
                    </SelectContent>
                  </Select>
                  {mode === "conservative" && (
                    <p className="text-3xs text-muted-foreground mt-1.5 leading-relaxed">
                      Requires 7/8 indicators to agree before signaling. Fewer trades, higher confidence per trade.
                    </p>
                  )}
                  {mode === "aggressive" && (
                    <p className="text-3xs text-amber-400/80 mt-1.5 leading-relaxed">
                      Only needs 5/8 confirmations — more signals but higher false-positive rate. Not recommended for beginners.
                    </p>
                  )}
                  {mode === "squeeze" && (
                    <p className="text-3xs text-muted-foreground mt-1.5 leading-relaxed">
                      Detects when volatility is compressing and a large price move is likely. Best for experienced traders.
                    </p>
                  )}
                </div>

                {/* Trading Mode Selector */}
                <div>
                  <label className="flex items-center gap-1 text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                    Trading Mode
                    <Tip text="Paper = virtual $100K, no real money. Dry Run = simulates the broker call without placing it. Live = real money order. Always start with Paper." />
                  </label>
                  <div className="p-1 bg-surface-highest rounded-sm flex">
                    {TRADING_MODES.map((tm) => {
                      const isActive = tradingMode === tm.value;
                      return (
                        <button
                          key={tm.value}
                          type="button"
                          onClick={() => handleModeChange(tm.value)}
                          className={cn(
                            "flex-1 text-3xs font-bold py-1.5 rounded-sm transition-all",
                            isActive
                              ? tm.value === "live"
                                ? "bg-destructive text-destructive-foreground"
                                : tm.value === "paper"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-surface-bright text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {tm.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-3xs text-muted-foreground mt-1">
                    {tradingMode === "paper" && "✓ Safe — virtual money only, no broker needed."}
                    {tradingMode === "dry-run" && "Simulates order logic — broker credential required, no real order placed."}
                    {tradingMode === "live" && <span className="text-destructive font-bold">⚠ Real money — use with caution.</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Step 2: Analyze Signal ── */}
            <div className="space-y-4 pt-4 border-t border-border/10">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-3xs font-bold shrink-0",
                    signalReady ? "bg-primary/20 text-primary" : "bg-surface-high text-muted-foreground"
                  )}
                >
                  {signalReady ? <Check className="h-2.5 w-2.5" /> : "2"}
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Analyze Signal</h3>
                <Tip text="The AI checks 8 technical indicators (trend, momentum, volume, etc.) and counts how many agree. More agreements = higher confidence." />
              </div>

              <button
                type="button"
                onClick={() => runSignalCheck()}
                disabled={isSignalChecking || !brokerReady}
                className={cn(
                  "w-full py-3 bg-surface-bright hover:bg-surface-high text-foreground border border-primary/20 rounded-sm flex items-center justify-center gap-2 transition-all active:scale-95 group text-xs font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 text-primary transition-transform", isSignalChecking && "animate-spin")} />
                {isSignalChecking ? "CHECKING..." : "RUN SIGNAL CHECK"}
              </button>

              {!brokerReady && (
                <p className="text-3xs text-muted-foreground text-center">
                  Select a broker credential in Setup first
                </p>
              )}

              {signalResult && <SignalResultPanel result={signalResult} />}
            </div>

            {/* ── Step 3: Execute Order ── */}
            <div className="space-y-4 pt-4 border-t border-border/10">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-surface-high text-muted-foreground flex items-center justify-center text-3xs font-bold shrink-0">
                  3
                </span>
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Execute Order</h3>
              </div>

              <div className="space-y-4">
                {/* Paper balance */}
                {isPaper && (
                  <div className="flex justify-between items-end">
                    <span className="text-3xs uppercase text-muted-foreground font-bold">Paper Balance</span>
                    <span className="text-sm font-bold tabular-nums text-foreground">
                      ${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <form onSubmit={handleExecuteSubmit((v) => executeOrder(v))} className="space-y-3">
                  {/* Buy / Sell toggle */}
                  <BuySellToggle
                    value={watchExecute("side")}
                    onSelect={(side) => setExecuteValue("side", side)}
                  />

                  {/* Amount input */}
                  <div>
                    <label className="block text-3xs uppercase font-bold text-muted-foreground mb-1.5">
                      Amount (USD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="5000"
                        className="w-full bg-surface-highest border-none rounded-sm text-sm p-3 text-foreground font-bold tabular-nums focus:ring-1 focus:ring-primary/50 focus:outline-none"
                        aria-label="Order amount in dollars"
                        {...registerExecute("amount")}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-3xs text-muted-foreground font-bold">
                        USD
                      </span>
                    </div>
                    {executeErrors.amount && (
                      <p className="text-3xs text-destructive mt-1">
                        {executeErrors.amount.message?.toString()}
                      </p>
                    )}
                  </div>

                  {/* Quick amount buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setExecuteValue("amount", amt)}
                        className="px-2 py-1 text-3xs rounded-sm bg-surface-highest hover:bg-surface-bright text-muted-foreground hover:text-foreground transition-colors font-bold"
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>

                  {/* Execute CTA */}
                  <button
                    type="submit"
                    disabled={!!pendingOrder || isExecuting || (!isPaper && !brokerReady)}
                    className={cn(
                      "w-full py-3.5 font-extrabold tracking-tighter text-sm rounded-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                      tradingMode === "live"
                        ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        : "bg-gradient-to-br from-primary to-primary/60 text-primary-foreground"
                    )}
                  >
                    {isExecuting
                      ? "SUBMITTING..."
                      : tradingMode === "paper"
                        ? "EXECUTE PAPER TRADE"
                        : tradingMode === "dry-run"
                          ? "EXECUTE DRY RUN"
                          : "EXECUTE LIVE ORDER"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Risk disclaimer */}
          <div className="mt-auto p-4 border-t border-border/10">
            <p className="text-3xs text-muted-foreground leading-relaxed">
              <AlertTriangle className="h-3 w-3 text-amber-500 inline mr-1" />
              Educational software. Live trading carries risk of total loss. Past performance does not guarantee future results.
            </p>
          </div>
        </section>

        {/* ════ CENTER — Charting Area ════ */}
        <section className="flex flex-col bg-surface-lowest min-h-[320px] sm:min-h-[420px] lg:min-h-[560px]">
          {/* Chart toolbar */}
          <div className="h-10 border-b border-border/10 flex items-center px-4 gap-4 overflow-x-auto bg-surface-low">
            {/* Symbol label */}
            <div className="flex items-center gap-1.5 pr-4 border-r border-border/10 shrink-0">
              <span className="text-xs font-bold text-foreground">{committedSymbol}</span>
              {chartStats && (
                <span className={cn("text-2xs tabular-nums", chartStats.isUp ? "text-primary" : "text-destructive")}>
                  {formatCurrency(chartStats.price)}
                </span>
              )}
            </div>

            {/* Timeframe tabs */}
            <div className="flex items-center gap-0.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => setTimeframe(tf.value)}
                  className={cn(
                    "px-1.5 py-0.5 text-2xs font-bold rounded-sm transition-colors",
                    timeframe === tf.value
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tf.short}
                </button>
              ))}
            </div>

            {/* OHLCV inline on desktop */}
            {chartStats && (
              <div className="hidden md:flex items-center gap-4 ml-2 text-3xs text-muted-foreground tabular-nums">
                <span>O <span className="text-foreground font-mono">{chartStats.open.toFixed(2)}</span></span>
                <span>H <span className="text-foreground font-mono">{chartStats.high.toFixed(2)}</span></span>
                <span>L <span className="text-foreground font-mono">{chartStats.low.toFixed(2)}</span></span>
                <span>C <span className={cn("font-mono", chartStats.isUp ? "text-primary" : "text-destructive")}>{chartStats.price.toFixed(2)}</span></span>
                {chartStats.volume > 0 && (
                  <span>Vol <span className="text-foreground font-mono">{formatVolume(chartStats.volume)}</span></span>
                )}
              </div>
            )}
          </div>

          {/* Signal Decision Banner */}
          {signalResult && (
            <SignalDecisionBanner
              result={signalResult}
              symbol={committedSymbol}
              mode={mode}
              dryRun={dryRun}
            />
          )}

          {/* Chart canvas */}
          <div className="flex-1 relative">
            {chartData?.candles ? (
              <PriceChart
                data={chartData.candles}
                signals={signalResult ? buildSignalMarkers(signalResult, chartData.candles) : []}
                symbol={committedSymbol}
                height={320}
                theme={theme}
                bollingerData={chartData.bollinger ?? undefined}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-[420px] text-muted-foreground">
                <CandlestickChart className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-2xs uppercase tracking-widest">Loading chart data...</p>
              </div>
            )}

            {/* Real-time price float tag */}
            {chartStats && (
              <div className="absolute right-0 top-1/4 z-10">
                <div className="bg-primary text-primary-foreground font-bold px-2 py-1 text-xs tabular-nums shadow-2xl">
                  {chartStats.price.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {/* Bottom metadata strip */}
          <div className="h-9 border-t border-border/10 flex items-center px-4 bg-surface-low gap-6">
            {chartStats && (
              <div className="flex items-center gap-4">
                <span className="text-3xs uppercase font-bold text-muted-foreground">
                  {timeframe === "1d" ? "24-Day" : timeframe === "1wk" ? "24-Week" : "24-Bar"} Range{" "}
                  <span className="text-foreground font-mono tabular-nums">
                    {chartStats.low24.toFixed(2)} — {chartStats.high24.toFixed(2)}
                  </span>
                </span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-3xs font-bold text-foreground uppercase tracking-tighter">Market Data · Alpaca / yFinance</span>
            </div>
          </div>
        </section>

        {/* ════ RIGHT — Market Pulse ════ */}
        <section className="bg-surface-low border-l border-border/10 hidden xl:flex flex-col" aria-label="Price summary">
          <div className="p-4 flex items-center justify-between border-b border-border/10">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Price summary</h3>
          </div>

          {/* Asset detail card */}
          <div className="p-3 border-t border-border/10">
            <div className="p-3 bg-surface-high rounded-sm border border-border/10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-surface-highest flex items-center justify-center">
                  <CandlestickChart className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold leading-none">{committedSymbol}</p>
                  <p className="text-3xs text-muted-foreground mt-0.5">Equity</p>
                </div>
              </div>

              {chartStats && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-3xs text-muted-foreground uppercase">Price</span>
                    <span className="text-xs font-bold tabular-nums">{formatCurrency(chartStats.price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-3xs text-muted-foreground uppercase">Change</span>
                    <span className={cn("text-xs font-bold tabular-nums", chartStats.isUp ? "text-primary" : "text-destructive")}>
                      {chartStats.isUp ? "+" : ""}{chartStats.change.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-3xs text-muted-foreground uppercase">
                      {timeframe === "1d" ? "24-Day" : timeframe === "1wk" ? "24-Wk" : "24-Bar"} High
                    </span>
                    <span className="text-xs font-bold tabular-nums">{chartStats.high24.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-3xs text-muted-foreground uppercase">
                      {timeframe === "1d" ? "24-Day" : timeframe === "1wk" ? "24-Wk" : "24-Bar"} Low
                    </span>
                    <span className="text-xs font-bold tabular-nums">{chartStats.low24.toFixed(2)}</span>
                  </div>
                  {chartStats.volume > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-3xs text-muted-foreground uppercase">Volume</span>
                      <span className="text-xs font-bold tabular-nums">{formatVolume(chartStats.volume)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── Paper Portfolio — shown only in paper mode ── */}
      {isPaper && (
        <>
          {/* Paper stats strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <PaperStatCard
              label="Cash"
              value={`$${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
              color="text-primary"
            />
            <PaperStatCard
              label="Realized P&L"
              value={`${paperStats.totalRealizedPnl >= 0 ? "+" : ""}$${paperStats.totalRealizedPnl.toFixed(2)}`}
              color={paperStats.totalRealizedPnl >= 0 ? "text-primary" : "text-destructive"}
            />
            <PaperStatCard
              label="Win Rate"
              value={paperStats.closedTradeCount > 0 ? `${paperStats.winRate.toFixed(0)}%` : "\u2014"}
              color={paperStats.winRate >= 50 ? "text-primary" : "text-muted-foreground"}
            />
            <PaperStatCard
              label="Trades"
              value={String(paperStats.closedTradeCount)}
              color="text-muted-foreground"
            />
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="flex items-center gap-1.5 h-7 text-2xs text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>

          {/* Paper positions */}
          <CollapsibleSection
            title="Paper Positions"
            count={portfolio.positions.length}
            open={paperPositionsOpen}
            onToggle={() => setPaperPositionsOpen(!paperPositionsOpen)}
          >
            {portfolio.positions.length === 0 ? (
              <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
                No open paper positions — execute a paper trade above
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/10">
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Avg Entry</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Cost / collateral</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.positions.map((pos, i) => (
                      <TableRow key={`${pos.symbol}-${i}`} className="border-border/5 hover:bg-surface-low">
                        <TableCell className="font-mono text-xs font-semibold">{pos.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                              pos.side === "long"
                                ? "text-primary bg-primary/10"
                                : "text-destructive bg-destructive/10"
                            )}
                          >
                            {pos.side.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {pos.quantity.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${pos.avgEntry.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${(pos.quantity * pos.avgEntry).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-2xs text-muted-foreground">
                          {new Date(pos.openedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CollapsibleSection>

          {/* Paper trade history */}
          {portfolio.trades.length > 0 && (
            <CollapsibleSection
              title="Paper Trade History"
              count={portfolio.trades.length}
              open={paperHistoryOpen}
              onToggle={() => setPaperHistoryOpen(!paperHistoryOpen)}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/10">
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Time</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Action</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...portfolio.trades].reverse().slice(0, 20).map((trade) => (
                      <TableRow key={trade.id} className="border-border/5 hover:bg-surface-low">
                        <TableCell className="text-2xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {new Date(trade.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{trade.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                              trade.side === "buy"
                                ? "text-primary bg-primary/10"
                                : "text-destructive bg-destructive/10"
                            )}
                          >
                            {trade.side.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-2xs capitalize">{trade.action}</TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${trade.notionalUsd.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${trade.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {trade.realizedPnl != null ? (
                            <span className={trade.realizedPnl >= 0 ? "text-primary" : "text-destructive"}>
                              {trade.realizedPnl >= 0 ? "+" : ""}${trade.realizedPnl.toFixed(2)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}
        </>
      )}

      {/* ── Broker Positions — hidden in paper mode ── */}
      {!isPaper && <BrokerLedger positions={positions} orders={orders} positionsLoading={positionsLoading} ordersLoading={ordersLoading} refreshData={refreshData} />}

      {/* ── Live Mode Confirmation Dialog ── */}
      <Dialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <DialogContent className="bg-surface-low border-border/20">
          <DialogHeader>
            <DialogTitle className="text-destructive uppercase tracking-widest text-sm font-black">
              Enable Live Trading?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              You are switching to{" "}
              <strong className="text-destructive">LIVE mode</strong>. Real money will be used
              for all subsequent order submissions. Toggle dry-run back on to return to simulation.
              <br /><br />
              Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiveConfirm(false)} className="text-xs">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLiveMode} className="text-xs font-black uppercase tracking-widest">
              Yes, Enable Live Mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Paper Portfolio Dialog ── */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="bg-surface-low border-border/20">
          <DialogHeader>
            <DialogTitle className="text-xs font-black uppercase tracking-widest">Reset Paper Portfolio?</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              This will clear all paper positions, trade history, and reset your
              balance to $100,000. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="text-xs font-black uppercase tracking-widest"
              onClick={() => {
                resetPortfolio();
                setShowResetConfirm(false);
                toast.info("Paper portfolio reset to $100,000");
              }}
            >
              Reset Portfolio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Buy / Sell Toggle ────────────────────────────────────────────────────────
