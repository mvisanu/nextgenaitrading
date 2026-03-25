"use client";

/**
 * /live-trading — Refactored Live Trading Page
 *
 * Guided 3-step workflow:
 *   Step 1: Setup — broker, symbol, timeframe, strategy mode
 *   Step 2: Analyze — run signal check, view indicator breakdown
 *   Step 3: Execute — place order (dry-run or live)
 *
 * Chart is always visible alongside workflow steps.
 * Positions & orders in collapsible sections below.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { PriceChart } from "@/components/charts/PriceChart";
import { useTheme } from "@/lib/theme";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brokerApi, liveApi } from "@/lib/api";
import { logLiveTrade } from "@/lib/tradeLog";
import { usePaperPortfolio } from "@/lib/paperTrading";
import {
  formatDateTime,
  formatCurrency,
  getErrorMessage,
  getRegimeVariant,
  getSignalVariant,
} from "@/lib/utils";
import { cn } from "@/lib/utils";
import type {
  BrokerCredential,
  SignalCheckResult,
  Timeframe,
  SignalMarker,
} from "@/types";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  LinkIcon,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";

const executeSchema = z.object({
  side: z.enum(["buy", "sell"]),
  amount: z.preprocess(
    (v) => Number(v),
    z.number().positive("Amount must be positive")
  ),
});
type ExecuteFormValues = z.infer<typeof executeSchema>;

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

type TradingMode = "paper" | "dry-run" | "live";

const TRADING_MODES: { value: TradingMode; label: string; icon: typeof FlaskConical; description: string; color: string }[] = [
  { value: "paper", label: "Paper", icon: Wallet, description: "Virtual $100K portfolio", color: "text-blue-400" },
  { value: "dry-run", label: "Dry Run", icon: FlaskConical, description: "One-off simulation", color: "text-purple-400" },
  { value: "live", label: "Live", icon: Zap, description: "Real money orders", color: "text-red-400" },
];

const TIMEFRAMES: { value: Timeframe; label: string; short: string }[] = [
  { value: "1h", label: "1 Hour", short: "1H" },
  { value: "4h", label: "4 Hour", short: "4H" },
  { value: "1d", label: "Daily", short: "1D" },
  { value: "1wk", label: "Weekly", short: "1W" },
];

export default function LiveTradingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/live-trading");
    }
  }, [authLoading, user, router]);

  const [selectedCredentialId, setSelectedCredentialId] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [committedSymbol, setCommittedSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [mode, setMode] = useState<"conservative" | "aggressive">("conservative");
  const [tradingMode, setTradingMode] = useState<TradingMode>("paper");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [signalResult, setSignalResult] = useState<SignalCheckResult | null>(null);
  const [positionsOpen, setPositionsOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [paperPositionsOpen, setPaperPositionsOpen] = useState(true);
  const [paperHistoryOpen, setPaperHistoryOpen] = useState(false);

  // Paper trading engine
  const { portfolio, executePaperOrder, resetPortfolio, stats: paperStats } = usePaperPortfolio();

  // Derived from trading mode
  const dryRun = tradingMode !== "live";
  const isPaper = tradingMode === "paper";

  const { data: credentials = [], isLoading: credsLoading } = useQuery({
    queryKey: ["broker", "credentials"],
    queryFn: brokerApi.list,
  });

  const { data: positions = [], isLoading: positionsLoading } = useQuery({
    queryKey: ["live", "positions"],
    queryFn: liveApi.positions,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["live", "orders"],
    queryFn: () => liveApi.orders(),
  });

  const { data: chartData } = useQuery({
    queryKey: ["live", "chart-data", committedSymbol, timeframe],
    queryFn: () => liveApi.chartData(committedSymbol, timeframe),
    enabled: committedSymbol.length >= 2 && /[A-Z]/.test(committedSymbol),
  });

  const { mutate: runSignalCheck, isPending: isSignalChecking } = useMutation({
    mutationFn: () => {
      if (!selectedCredentialId) throw new Error("Select a broker credential");
      return liveApi.signalCheck({
        symbol: committedSymbol,
        timeframe,
        mode,
        credential_id: selectedCredentialId,
      });
    },
    onSuccess: (result) => {
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
  } = useForm<ExecuteFormValues>({
    resolver: zodResolver(executeSchema),
    defaultValues: { side: "buy", amount: 0 },
  });

  const { mutate: executeOrder, isPending: isExecuting } = useMutation({
    mutationFn: async (values: ExecuteFormValues) => {
      // Paper trading: execute locally
      if (isPaper) {
        const price = chartStats?.price;
        if (!price) throw new Error("No price data available for paper trade");
        const result = executePaperOrder({
          symbol: committedSymbol,
          side: values.side,
          notionalUsd: values.amount,
          currentPrice: price,
        });
        if (!result.success) throw new Error(result.error ?? "Paper trade failed");
        // Return a mock order matching the BrokerOrder shape
        return {
          id: 0,
          symbol: committedSymbol,
          side: values.side,
          order_type: "market",
          quantity: values.amount / price,
          notional_usd: values.amount,
          broker_order_id: null,
          status: "filled",
          filled_price: price,
          filled_quantity: values.amount / price,
          mode_name: mode,
          dry_run: false,
          error_message: null,
          created_at: new Date().toISOString(),
          _paper: true,
          _realizedPnl: result.realizedPnl ?? null,
          _action: result.action,
        };
      }

      // Dry-run or live: send to backend
      if (!selectedCredentialId) throw new Error("Select a broker credential");
      return liveApi.execute({
        symbol: committedSymbol,
        side: values.side,
        notional_usd: values.amount,
        credential_id: selectedCredentialId,
        dry_run: dryRun,
        strategy_run_id: signalResult?.strategy_run_id,
      });
    },
    onSuccess: (order: any) => {
      queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["live", "positions"] });

      if (order._paper) {
        const pnlStr = order._realizedPnl != null
          ? ` (P&L: ${order._realizedPnl >= 0 ? "+" : ""}$${order._realizedPnl.toFixed(2)})`
          : "";
        toast.success(
          `[PAPER] ${order._action === "close" ? "Closed" : "Opened"} ${order.side?.toUpperCase()} $${order.notional_usd?.toFixed(2)} ${order.symbol}${pnlStr}`
        );
      } else {
        const label = order.dry_run ? "[DRY RUN] " : "";
        const amt = order.notional_usd ? ` $${order.notional_usd}` : "";
        toast.success(`${label}Order submitted: ${order.side?.toUpperCase()}${amt} ${symbol}`);
      }

      // Log to trade log
      logLiveTrade({
        symbol: committedSymbol,
        side: (order.side as "buy" | "sell") ?? "buy",
        amountUsd: order.notional_usd ?? null,
        dryRun: order._paper ? false : (order.dry_run ?? dryRun),
        timeframe,
        mode,
        signal: signalResult?.signal ?? null,
        confirmationCount: signalResult?.confirmation_count ?? null,
      });
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
    queryClient.invalidateQueries({ queryKey: ["live", "positions"] });
    queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
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

  if (authLoading || !user) return null;

  return (
    <AppShell title="Live Trading">
      {/* Status strip */}
      <div className="flex items-center gap-3 mb-4 flex-wrap text-xs">
        {isPaper ? (
          <StatusPill label="Mode" value="Paper Trading" active variant="paper" />
        ) : tradingMode === "dry-run" ? (
          <StatusPill label="Mode" value="Dry Run" active variant="default" />
        ) : (
          <StatusPill label="Mode" value="LIVE" active variant="destructive" />
        )}
        {isPaper && (
          <StatusPill
            label="Balance"
            value={`$${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            active
          />
        )}
        {!isPaper && (
          <StatusPill
            label="Broker"
            value={selectedCredential?.profile_name ?? "Not connected"}
            active={brokerReady}
          />
        )}
        <StatusPill label="Symbol" value={committedSymbol} active />
        <StatusPill label="Timeframe" value={timeframe} active />
        <StatusPill label="Strategy" value={mode} active />
        {isPaper && paperStats.openPositionCount > 0 && (
          <StatusPill label="Paper Positions" value={String(paperStats.openPositionCount)} active />
        )}
        {!isPaper && openPositionCount > 0 && (
          <StatusPill label="Positions" value={String(openPositionCount)} active />
        )}
      </div>

      {/* Live Mode Banner */}
      {tradingMode === "live" && (
        <Alert variant="destructive" className="mb-4">
          <Zap className="h-4 w-4" />
          <AlertTitle>LIVE MODE ACTIVE</AlertTitle>
          <AlertDescription>
            Real money orders will be submitted to your broker. Switch to Paper or Dry Run to return to simulation.
          </AlertDescription>
        </Alert>
      )}

      {/* Main layout: steps + chart */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Left column: workflow steps */}
        <div className="lg:col-span-2 space-y-3">
          {/* Step 1: Setup */}
          <StepCard
            step={1}
            title="Setup"
            icon={<LinkIcon className="h-3.5 w-3.5" />}
            done={brokerReady}
          >
            <div className="space-y-3">
              {/* Broker selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Broker Credential</Label>
                {credsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : credentials.length === 0 ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 inline mr-1.5" />
                    No credentials.{" "}
                    <a href="/profile" className="underline text-primary">
                      Add in Profile
                    </a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Select onValueChange={(v) => setSelectedCredentialId(Number(v))}>
                      <SelectTrigger className="h-9 text-xs flex-1">
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
                <div className="space-y-1">
                  <Label className="text-xs">Symbol</Label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    onBlur={() => setCommittedSymbol(symbol.trim())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setCommittedSymbol(symbol.trim());
                      }
                    }}
                    placeholder="AAPL"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Timeframe</Label>
                  <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1d">Daily (1d)</SelectItem>
                      <SelectItem value="1h">Hourly (1h)</SelectItem>
                      <SelectItem value="4h">4-Hour (4h)</SelectItem>
                      <SelectItem value="1wk">Weekly (1wk)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Strategy Mode */}
              <div className="space-y-1">
                <Label className="text-xs">Strategy</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as "conservative" | "aggressive")}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Trading Mode Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Trading Mode</Label>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/20 p-1">
                  {TRADING_MODES.map((tm) => {
                    const Icon = tm.icon;
                    const isActive = tradingMode === tm.value;
                    return (
                      <button
                        key={tm.value}
                        type="button"
                        onClick={() => handleModeChange(tm.value)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-center transition-all",
                          isActive
                            ? tm.value === "live"
                              ? "bg-red-500/15 border border-red-500/30 shadow-sm"
                              : tm.value === "paper"
                                ? "bg-blue-500/15 border border-blue-500/30 shadow-sm"
                                : "bg-purple-500/15 border border-purple-500/30 shadow-sm"
                            : "border border-transparent hover:bg-muted/40"
                        )}
                      >
                        <Icon className={cn("h-3.5 w-3.5", isActive ? tm.color : "text-muted-foreground")} />
                        <span className={cn("text-[11px] font-medium", isActive ? tm.color : "text-muted-foreground")}>
                          {tm.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {tradingMode === "paper" && "Virtual portfolio with $100K — practice risk-free"}
                  {tradingMode === "dry-run" && "Simulate a single order without any execution"}
                  {tradingMode === "live" && "Real money — orders sent to your broker"}
                </p>
              </div>
            </div>
          </StepCard>

          {/* Step 2: Analyze */}
          <StepCard
            step={2}
            title="Analyze Signal"
            icon={<Search className="h-3.5 w-3.5" />}
            done={signalReady}
            disabled={!isPaper && !brokerReady}
          >
            <div className="space-y-3">
              <Button
                onClick={() => runSignalCheck()}
                disabled={isSignalChecking || (!isPaper && !brokerReady)}
                className="w-full h-9 text-xs"
                variant="secondary"
              >
                {isSignalChecking ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5 mr-1.5" />
                    Run Signal Check
                  </>
                )}
              </Button>

              {!isPaper && !brokerReady && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Select a broker credential in Step 1 first
                </p>
              )}

              {signalResult && <SignalResultPanel result={signalResult} />}
            </div>
          </StepCard>

          {/* Step 3: Execute */}
          <StepCard
            step={3}
            title="Execute Order"
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
            done={false}
            disabled={!isPaper && !brokerReady}
          >
            {/* Paper balance indicator */}
            {isPaper && (
              <div className="flex items-center justify-between rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2 mb-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs text-muted-foreground">Paper Balance</span>
                </div>
                <span className="text-xs font-mono font-bold text-blue-400">
                  ${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <form
              onSubmit={handleExecuteSubmit((v) => executeOrder(v))}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Side</Label>
                  <Select
                    defaultValue="buy"
                    onValueChange={(v) => setExecuteValue("side", v as "buy" | "sell")}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="100.00"
                      className="pl-6 h-9 text-xs"
                      {...registerExecute("amount")}
                    />
                  </div>
                  {executeErrors.amount && (
                    <p className="text-[11px] text-destructive">
                      {executeErrors.amount.message?.toString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick amount buttons */}
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setExecuteValue("amount", amt)}
                    className="px-2.5 py-1 text-[11px] rounded-md border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ${amt}
                  </button>
                ))}
              </div>

              <Button
                type="submit"
                variant={tradingMode === "live" ? "destructive" : tradingMode === "paper" ? "default" : "secondary"}
                className="w-full h-9 text-xs"
                disabled={isExecuting || (!isPaper && !brokerReady)}
              >
                {isExecuting
                  ? "Submitting..."
                  : tradingMode === "paper"
                    ? "Execute Paper Trade"
                    : tradingMode === "dry-run"
                      ? "Execute (Dry Run)"
                      : "Execute LIVE Order"}
              </Button>
            </form>
          </StepCard>

          {/* Risk disclaimer — compact */}
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-amber-500 inline mr-1" />
            Educational software. Live trading carries risk of total loss. Past performance does not guarantee future results.
          </div>
        </div>

        {/* Right column: chart + signal banner */}
        <div className="lg:col-span-3 space-y-3">
          {/* Signal Decision Banner */}
          {signalResult && (
            <SignalDecisionBanner
              result={signalResult}
              symbol={committedSymbol}
              mode={mode}
              dryRun={dryRun}
            />
          )}

          {/* Enhanced Price Chart */}
          <Card className="overflow-hidden">
            {/* Chart header: symbol + price + stats + timeframe tabs */}
            <div className="px-4 pt-3 pb-2 border-b border-border/50">
              {/* Top row: symbol info + timeframe tabs */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <CandlestickChart className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm text-foreground">
                        {committedSymbol}
                      </span>
                      {chartStats && (
                        <>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {formatCurrency(chartStats.price)}
                          </span>
                          <span
                            className={cn(
                              "flex items-center gap-0.5 text-xs font-medium",
                              chartStats.isUp ? "text-emerald-400" : "text-red-400"
                            )}
                          >
                            {chartStats.isUp ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {chartStats.isUp ? "+" : ""}
                            {chartStats.change.toFixed(2)} ({chartStats.changePct.toFixed(2)}%)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline timeframe tabs */}
                <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf.value}
                      onClick={() => setTimeframe(tf.value)}
                      className={cn(
                        "px-2 py-1 text-[11px] font-medium rounded transition-colors",
                        timeframe === tf.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tf.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* OHLCV stats row */}
              {chartStats && (
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
                  <span>O <span className="text-foreground font-mono">{chartStats.open.toFixed(2)}</span></span>
                  <span>H <span className="text-foreground font-mono">{chartStats.high.toFixed(2)}</span></span>
                  <span>L <span className="text-foreground font-mono">{chartStats.low.toFixed(2)}</span></span>
                  <span>C <span className={cn("font-mono", chartStats.isUp ? "text-emerald-400" : "text-red-400")}>{chartStats.price.toFixed(2)}</span></span>
                  <span className="ml-auto">
                    24 Range{" "}
                    <span className="text-foreground font-mono">
                      {chartStats.low24.toFixed(2)} — {chartStats.high24.toFixed(2)}
                    </span>
                  </span>
                  {chartStats.volume > 0 && (
                    <span>
                      Vol <span className="text-foreground font-mono">{formatVolume(chartStats.volume)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Chart body — no extra padding so chart bleeds to card edges */}
            <div className="px-1 pb-1">
              {chartData?.candles ? (
                <PriceChart
                  data={chartData.candles}
                  signals={signalResult ? buildSignalMarkers(signalResult, chartData.candles) : []}
                  symbol={committedSymbol}
                  height={420}
                  theme={theme}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[420px] text-muted-foreground">
                  <CandlestickChart className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-xs">Loading chart data...</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Paper Portfolio — shown only in paper mode */}
      {isPaper && (
        <>
          {/* Paper stats strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <PaperStatCard
              label="Cash"
              value={`$${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
              color="text-blue-400"
            />
            <PaperStatCard
              label="Realized P&L"
              value={`${paperStats.totalRealizedPnl >= 0 ? "+" : ""}$${paperStats.totalRealizedPnl.toFixed(2)}`}
              color={paperStats.totalRealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
            />
            <PaperStatCard
              label="Win Rate"
              value={paperStats.closedTradeCount > 0 ? `${paperStats.winRate.toFixed(0)}%` : "\u2014"}
              color={paperStats.winRate >= 50 ? "text-emerald-400" : "text-muted-foreground"}
            />
            <PaperStatCard
              label="Trades"
              value={String(paperStats.closedTradeCount)}
              color="text-muted-foreground"
            />
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground gap-1"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
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
              <p className="text-xs text-muted-foreground py-4 text-center">
                No open paper positions — execute a paper trade above
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Symbol</TableHead>
                    <TableHead className="text-xs">Side</TableHead>
                    <TableHead className="text-xs text-right">Qty</TableHead>
                    <TableHead className="text-xs text-right">Avg Entry</TableHead>
                    <TableHead className="text-xs text-right">Value</TableHead>
                    <TableHead className="text-xs">Opened</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.positions.map((pos, i) => (
                    <TableRow key={`${pos.symbol}-${i}`}>
                      <TableCell className="font-mono text-xs font-semibold">{pos.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            pos.side === "long"
                              ? "text-emerald-400 border-emerald-400/30"
                              : "text-red-400 border-red-400/30"
                          )}
                        >
                          {pos.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {pos.quantity.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ${pos.avgEntry.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ${(pos.quantity * pos.avgEntry).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(pos.openedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Symbol</TableHead>
                    <TableHead className="text-xs">Side</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs text-right">Price</TableHead>
                    <TableHead className="text-xs text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...portfolio.trades].reverse().slice(0, 20).map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(trade.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{trade.symbol}</TableCell>
                      <TableCell>
                        <Badge
                          variant={trade.side === "buy" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {trade.side.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{trade.action}</TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ${trade.notionalUsd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        ${trade.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-mono">
                        {trade.realizedPnl != null ? (
                          <span className={trade.realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}>
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
            </CollapsibleSection>
          )}
        </>
      )}

      {/* Broker Positions — collapsible, hidden in paper mode */}
      {!isPaper && (
      <CollapsibleSection
        title="Open Positions"
        count={openPositionCount}
        open={positionsOpen}
        onToggle={() => setPositionsOpen(!positionsOpen)}
        action={
          <Button variant="ghost" size="sm" onClick={refreshData} className="h-7 text-xs">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        }
      >
        {positionsLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : positions.filter((p) => p.is_open).length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No open positions
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-xs">Side</TableHead>
                <TableHead className="text-xs text-right">Qty</TableHead>
                <TableHead className="text-xs text-right">Avg Entry</TableHead>
                <TableHead className="text-xs text-right">Mark Price</TableHead>
                <TableHead className="text-xs text-right">Unrealized PnL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.filter((p) => p.is_open).map((pos) => (
                <TableRow key={pos.id}>
                  <TableCell className="font-mono text-xs">{pos.symbol}</TableCell>
                  <TableCell className="text-xs">{pos.position_side}</TableCell>
                  <TableCell className="text-right text-xs">{pos.quantity}</TableCell>
                  <TableCell className="text-right text-xs">
                    {formatCurrency(pos.avg_entry_price)}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {pos.mark_price ? formatCurrency(pos.mark_price) : "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {pos.unrealized_pnl !== null ? (
                      <span className={pos.unrealized_pnl >= 0 ? "text-green-400" : "text-red-400"}>
                        {formatCurrency(pos.unrealized_pnl)}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>
      )}

      {/* Orders — collapsible, collapsed by default */}
      {!isPaper && (
      <CollapsibleSection
        title="Order History"
        count={orders.length}
        open={ordersOpen}
        onToggle={() => setOrdersOpen(!ordersOpen)}
      >
        {ordersLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : orders.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No orders yet
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Symbol</TableHead>
                <TableHead className="text-xs">Side</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Amount</TableHead>
                <TableHead className="text-xs text-right">Fill Price</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.symbol}</TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={order.side === "buy" ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {order.side?.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{order.status}</TableCell>
                  <TableCell className="text-right text-xs">
                    {order.notional_usd
                      ? formatCurrency(order.notional_usd)
                      : order.filled_quantity ?? order.quantity ?? "-"}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {order.filled_price ? formatCurrency(order.filled_price) : "-"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {order.dry_run && (
                      <Badge variant="secondary" className="text-[10px] mr-1">DRY</Badge>
                    )}
                    {order.order_type}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(order.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CollapsibleSection>
      )}

      {/* Live Mode Confirmation Dialog */}
      <Dialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Enable Live Trading?</DialogTitle>
            <DialogDescription>
              You are switching to <strong>LIVE mode</strong>. Real money will be used
              for all subsequent order submissions. Toggle dry-run back on to return to simulation.
              <br /><br />
              Are you sure you want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLiveConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLiveMode}>
              Yes, enable LIVE mode
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Paper Portfolio Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Paper Portfolio?</DialogTitle>
            <DialogDescription>
              This will clear all paper positions, trade history, and reset your
              balance to $100,000. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
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

// ─── Paper Stat Card ──────────────────────────────────────────────────────────

function PaperStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold font-mono", color)}>{value}</p>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  title,
  icon,
  done,
  disabled,
  children,
}: {
  step: number;
  title: string;
  icon: React.ReactNode;
  done: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Card className={cn(disabled && "opacity-50 pointer-events-none")}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-left"
      >
        <span
          className={cn(
            "flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-bold shrink-0",
            done
              ? "bg-green-500/20 text-green-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {done ? <Check className="h-3 w-3" /> : step}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium flex-1">
          {icon}
          {title}
        </span>
        {done && (
          <Badge variant="secondary" className="text-[10px] py-0">Done</Badge>
        )}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && <CardContent className="pt-0 pb-3 px-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Signal Result Panel ──────────────────────────────────────────────────────

function SignalResultPanel({ result }: { result: SignalCheckResult }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={getRegimeVariant(result.regime)}>{result.regime}</Badge>
        <Badge variant={getSignalVariant(result.signal)}>
          {result.signal?.toUpperCase() ?? "\u2014"}
        </Badge>
        <span className="text-[11px] text-muted-foreground ml-auto">
          {result.confirmation_count}/8 confirmations
        </span>
      </div>
      {result.reason && (
        <p className="text-[11px] text-muted-foreground italic">{result.reason}</p>
      )}
      {result.confirmation_details?.length > 0 && (
        <div className="space-y-1 pt-1.5 border-t border-border">
          <p className="text-[11px] font-medium text-muted-foreground">Indicators</p>
          {result.confirmation_details.map((detail, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] gap-2">
              <div className="flex items-center gap-1.5">
                <span className={detail.met ? "text-green-400" : "text-red-400"}>
                  {detail.met ? "\u2713" : "\u2717"}
                </span>
                <span className={detail.met ? "text-foreground" : "text-muted-foreground"}>
                  {detail.name}
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Signal Decision Banner ──────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof ArrowUpCircle;
}> = {
  buy: {
    label: "BUY",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: ArrowUpCircle,
  },
  sell: {
    label: "SELL",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: ArrowDownCircle,
  },
  hold: {
    label: "HOLD",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: MinusCircle,
  },
};

function SignalDecisionBanner({
  result,
  symbol,
  mode,
  dryRun,
}: {
  result: SignalCheckResult;
  symbol: string;
  mode: string;
  dryRun: boolean;
}) {
  const sig = result.signal?.toLowerCase() ?? "hold";
  const config = SIGNAL_CONFIG[sig] ?? SIGNAL_CONFIG.hold;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4`} data-testid="signal-decision">
      <div className="flex items-center gap-4">
        <Icon className={`h-10 w-10 ${config.color} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-2xl font-bold tracking-tight ${config.color}`}>
            {config.label}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{symbol}</span>
            {" · "}<span className="capitalize">{mode}</span>
            {" · "}{dryRun ? "Dry Run" : "LIVE"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="rounded-md border border-border bg-background/50 px-2.5 py-1 text-center">
            <p className="text-[10px] text-muted-foreground">Regime</p>
            <Badge variant={getRegimeVariant(result.regime)} className="mt-0.5 text-[10px]">
              {result.regime ?? "\u2014"}
            </Badge>
          </div>
          <div className="rounded-md border border-border bg-background/50 px-2.5 py-1 text-center">
            <p className="text-[10px] text-muted-foreground">Confirms</p>
            <p className="font-mono font-bold text-sm text-foreground">
              {result.confirmation_count ?? 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-4" data-testid={title === "Order History" ? "orders" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between py-2.5 px-4">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <CardTitle className="text-xs">{title}</CardTitle>
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px] py-0">{count}</Badge>
          )}
        </button>
        {open && action}
      </CardHeader>
      {open && <CardContent className="pt-0 pb-3 px-4">{children}</CardContent>}
    </Card>
  );
}

// ─── Status Pill ─────────────────────────────────────────────────────────────

function StatusPill({
  label,
  value,
  active,
  variant = "default",
}: {
  label: string;
  value: string;
  active: boolean;
  variant?: "default" | "destructive" | "paper";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
        variant === "destructive" && active
          ? "border-red-500/30 bg-red-500/10"
          : variant === "paper" && active
            ? "border-blue-500/30 bg-blue-500/10"
            : active
              ? "border-border bg-muted/30"
              : "border-border/50 bg-transparent"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          variant === "destructive" && active
            ? "bg-red-400 animate-pulse"
            : variant === "paper" && active
              ? "bg-blue-400"
              : active
                ? "bg-green-400"
                : "bg-muted-foreground/30"
        )}
      />
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn(
        "font-medium",
        variant === "destructive" && active
          ? "text-red-400"
          : variant === "paper" && active
            ? "text-blue-400"
            : "text-foreground"
      )}>
        {value}
      </span>
    </div>
  );
}

// ─── Signal Marker Builder ───────────────────────────────────────────────────

function buildSignalMarkers(
  result: SignalCheckResult,
  candles: { time: string; high: number; low: number }[]
): SignalMarker[] {
  if (!candles.length || !result.signal) return [];
  const sig = result.signal.toLowerCase();
  if (sig === "hold") return [];

  const lastCandle = candles[candles.length - 1];
  return [
    {
      time: lastCandle.time,
      position: sig === "buy" ? "belowBar" : "aboveBar",
      color: sig === "buy" ? "#22c55e" : "#ef4444",
      shape: sig === "buy" ? "arrowUp" : "arrowDown",
      text: sig.toUpperCase(),
    },
  ];
}

// ─── Volume Formatter ────────────────────────────────────────────────────────

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + "B";
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + "M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + "K";
  return String(Math.round(vol));
}

// ─── Credential Badge ────────────────────────────────────────────────────────

function CredentialBadge({ credential }: { credential: BrokerCredential }) {
  if (credential.provider === "alpaca") {
    return (
      <Badge variant="alpaca" className="shrink-0 text-[10px]">
        Alpaca
      </Badge>
    );
  }
  return (
    <Badge variant="robinhood" className="shrink-0 text-[10px]">
      Robinhood
    </Badge>
  );
}
