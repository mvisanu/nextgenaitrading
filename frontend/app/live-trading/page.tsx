"use client";

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

import { useState, useEffect, useCallback, useMemo } from "react";
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
  BookOpen,
  CandlestickChart,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  FlaskConical,
  Info,
  LinkIcon,
  MinusCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
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
    queryKey: ["live", "chart-data", committedSymbol, timeframe, mode === "squeeze"],
    queryFn: () => liveApi.chartData(committedSymbol, timeframe, mode === "squeeze"),
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
    watch: watchExecute,
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
        const amt = order.notional_usd != null ? ` $${Number(order.notional_usd).toFixed(2)}` : "";
        toast.success(`${label}Order submitted: ${order.side?.toUpperCase()}${amt} ${committedSymbol}`);
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

  // Beginner guide banner — dismissed after user clicks X (persisted in sessionStorage)
  const [guideVisible, setGuideVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return sessionStorage.getItem("liveGuideHidden") !== "1";
  });
  function dismissGuide() {
    sessionStorage.setItem("liveGuideHidden", "1");
    setGuideVisible(false);
  }


  return (
    <AppShell title="Live Trading">

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
                <span className="text-3xs text-muted-foreground uppercase leading-none">Account Balance</span>
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
      {guideVisible && (
        <div className="relative mb-4 rounded-sm border border-amber-500/25 bg-amber-500/5 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/60" />
          <div className="px-4 py-3 pl-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-amber-300 uppercase tracking-widest">How to use this page</span>
              </div>
              <button
                type="button"
                onClick={dismissGuide}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss guide"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-2xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-3xs shrink-0 mt-0.5">1</span>
                <div>
                  <p className="font-semibold text-foreground/80 mb-0.5">Setup</p>
                  <p>Pick a stock symbol (e.g. AAPL), choose <strong className="text-foreground/70">Conservative</strong> strategy, and leave mode as <strong className="text-foreground/70">Paper</strong> while learning.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-3xs shrink-0 mt-0.5">2</span>
                <div>
                  <p className="font-semibold text-foreground/80 mb-0.5">Analyze Signal</p>
                  <p>Click <strong className="text-foreground/70">&quot;Run Signal Check&quot;</strong> to let the AI evaluate 8 indicators. The result tells you whether conditions look favorable to buy or hold.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-3xs shrink-0 mt-0.5">3</span>
                <div>
                  <p className="font-semibold text-foreground/80 mb-0.5">Execute Order</p>
                  <p>Enter a dollar amount and click <strong className="text-foreground/70">Execute Paper Trade</strong>. Paper mode uses virtual money — no real risk while you learn.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      <a href="/profile" className="underline text-primary">
                        Add in Profile
                      </a>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select onValueChange={(v) => setSelectedCredentialId(Number(v))}>
                        <SelectTrigger className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50 flex-1">
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
                      onBlur={() => setCommittedSymbol(symbol.trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setCommittedSymbol(symbol.trim());
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
                      <SelectTrigger className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50">
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
                    <SelectTrigger className="h-9 text-xs bg-surface-highest border-none focus:ring-1 focus:ring-primary/50">
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
                    disabled={isExecuting || (!isPaper && !brokerReady)}
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
        <section className="bg-surface-low border-l border-border/10 hidden xl:flex flex-col" aria-label="Market Pulse">
          <div className="p-4 flex items-center justify-between border-b border-border/10">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground">Price Levels</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Tick feed rows from chartStats */}
            {chartStats ? (
              <>
                <MarketPulseRow price={chartStats.price} qty={0.45} up />
                <MarketPulseRow price={chartStats.price - 0.01} qty={1.20} up={false} />
                <MarketPulseRow price={chartStats.price} qty={0.10} up />
                <MarketPulseRow price={chartStats.price + 0.01} qty={4.50} up />
                <MarketPulseRow price={chartStats.price - 0.02} qty={0.05} up={false} />
                <MarketPulseRow price={chartStats.price} qty={2.30} up />
                <MarketPulseRow price={chartStats.price + 0.01} qty={1.80} up />
                <MarketPulseRow price={chartStats.price - 0.01} qty={0.75} up={false} />
              </>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-7 w-full bg-surface-mid" />
                ))}
              </div>
            )}
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
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Value</TableHead>
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
      {!isPaper && (
        <CollapsibleSection
          title="Open Positions"
          count={openPositionCount}
          open={positionsOpen}
          onToggle={() => setPositionsOpen(!positionsOpen)}
          action={
            <button
              type="button"
              onClick={refreshData}
              className="flex items-center gap-1 text-3xs text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          }
        >
          {positionsLoading ? (
            <Skeleton className="h-24 w-full bg-surface-mid" />
          ) : positions.filter((p) => p.is_open).length === 0 ? (
            <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
              No open positions
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
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Mark Price</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Unrealized PnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.filter((p) => p.is_open).map((pos) => (
                    <TableRow key={pos.id} className="border-border/5 hover:bg-surface-low">
                      <TableCell className="font-mono text-xs">{pos.symbol}</TableCell>
                      <TableCell className="text-2xs">{pos.position_side}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{pos.quantity}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatCurrency(pos.avg_entry_price)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {pos.mark_price ? formatCurrency(pos.mark_price) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {pos.unrealized_pnl !== null ? (
                          <span className={pos.unrealized_pnl >= 0 ? "text-primary" : "text-destructive"}>
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
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ── Order History ── */}
      {!isPaper && (
        <CollapsibleSection
          title="Order History"
          count={orders.length}
          open={ordersOpen}
          onToggle={() => setOrdersOpen(!ordersOpen)}
        >
          {ordersLoading ? (
            <Skeleton className="h-24 w-full bg-surface-mid" />
          ) : orders.length === 0 ? (
            <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
              No orders yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/10">
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Fill Price</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Type</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-border/5 hover:bg-surface-low">
                      <TableCell className="font-mono text-xs">{order.symbol}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                            order.side === "buy"
                              ? "text-primary bg-primary/10"
                              : "text-destructive bg-destructive/10"
                          )}
                        >
                          {order.side?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-2xs">{order.status}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {order.notional_usd
                          ? formatCurrency(order.notional_usd)
                          : order.filled_quantity ?? order.quantity ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {order.filled_price ? formatCurrency(order.filled_price) : "-"}
                      </TableCell>
                      <TableCell className="text-2xs">
                        {order.dry_run && (
                          <span className="text-3xs font-bold uppercase bg-surface-high text-muted-foreground px-1 py-0.5 rounded-sm mr-1">DRY</span>
                        )}
                        {order.order_type}
                      </TableCell>
                      <TableCell className="text-2xs text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleSection>
      )}

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

function BuySellToggle({
  value,
  onSelect,
}: {
  value: "buy" | "sell";
  onSelect: (side: "buy" | "sell") => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onSelect("buy")}
        className={cn(
          "flex-1 py-2 font-bold text-xs rounded-sm border transition-colors",
          value === "buy"
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-surface-highest text-muted-foreground border-transparent hover:text-foreground"
        )}
      >
        BUY
      </button>
      <button
        type="button"
        onClick={() => onSelect("sell")}
        className={cn(
          "flex-1 py-2 font-bold text-xs rounded-sm border transition-colors",
          value === "sell"
            ? "bg-destructive/10 text-destructive border-destructive/30"
            : "bg-surface-highest text-muted-foreground border-transparent hover:text-foreground"
        )}
      >
        SELL
      </button>
    </div>
  );
}

// ─── Market Pulse Row ─────────────────────────────────────────────────────────

function MarketPulseRow({ price, qty, up }: { price: number; qty: number; up: boolean }) {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  return (
    <div className="flex justify-between items-center p-2 hover:bg-surface-high rounded-sm transition-colors tabular-nums">
      <span className={cn("text-2xs font-medium", up ? "text-primary" : "text-destructive")}>
        {price.toFixed(2)}
      </span>
      <span className="text-2xs text-muted-foreground">{qty.toFixed(3)}</span>
      <span className="text-3xs text-muted-foreground">{timeStr}</span>
    </div>
  );
}

// ─── Paper Stat Card ──────────────────────────────────────────────────────────

function PaperStatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface-low border border-border/10 px-3 py-2 rounded-sm text-center">
      <p className="text-3xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold font-mono tabular-nums mt-0.5", color)}>{value}</p>
    </div>
  );
}

// ─── Signal Result Panel ──────────────────────────────────────────────────────

function SignalResultPanel({ result }: { result: SignalCheckResult }) {
  const sq = result.squeeze;
  return (
    <div className="bg-surface-lowest rounded-sm border border-border/10 p-3 space-y-2.5">
      {/* Summary row */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-3xs text-muted-foreground uppercase">Last Result</span>
        <span
          className={cn(
            "text-3xs font-bold uppercase",
            result.signal === "buy"
              ? "text-primary"
              : result.signal === "sell"
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {result.signal?.toUpperCase() ?? "HOLD"}
        </span>
      </div>

      {/* Plain-English interpretation */}
      <SignalPlainEnglish result={result} />

      {/* Confirmation progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-3xs text-muted-foreground flex items-center gap-1">
            Confirmations
            <Tip text="Each confirmation is one indicator (e.g. RSI, MACD, EMA) agreeing with the signal. More confirmations = higher confidence." />
          </span>
          <span className="text-3xs font-bold tabular-nums text-foreground">
            {result.confirmation_count ?? 0}/8
          </span>
        </div>
        <div className="w-full bg-border/10 h-1.5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all rounded-full",
              (result.confirmation_count ?? 0) >= 7
                ? "bg-primary"
                : (result.confirmation_count ?? 0) >= 5
                  ? "bg-amber-400"
                  : "bg-destructive/60"
            )}
            style={{ width: `${((result.confirmation_count ?? 0) / 8) * 100}%` }}
          />
        </div>
        <p className="text-3xs text-muted-foreground italic mt-1">
          Regime: <span className="font-semibold capitalize text-foreground/70">{result.regime ?? "—"}</span>
          <Tip text="Regime = the current market trend detected by the AI. 'bull' means uptrend, 'bear' means downtrend, 'neutral' means sideways." />
        </p>
      </div>

      {/* Squeeze status card */}
      {sq && (
        <div
          className={cn(
            "rounded-sm border p-2.5 space-y-1.5",
            sq.is_squeeze
              ? "border-amber-500/30 bg-amber-500/10"
              : sq.breakout_state !== "none"
                ? sq.breakout_state === "bullish"
                  ? "border-primary/20 bg-primary/5"
                  : "border-destructive/20 bg-destructive/5"
                : "border-border/10 bg-surface-low"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-2xs font-bold">
              {sq.is_squeeze
                ? "Squeeze Active"
                : sq.breakout_state === "bullish"
                  ? "Bullish Breakout"
                  : sq.breakout_state === "bearish"
                    ? "Bearish Breakout"
                    : "No Squeeze"}
            </p>
            {sq.is_squeeze && (
              <span className="text-3xs font-bold text-amber-400">
                Strength {sq.squeeze_strength.toFixed(0)}%
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-3xs">
            <div>
              <p className="text-muted-foreground">Band Width</p>
              <p className="font-mono font-bold tabular-nums">{sq.bb_width_pct.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Percentile</p>
              <p className="font-mono font-bold tabular-nums">{sq.bb_width_percentile.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Breakout</p>
              <p
                className={cn(
                  "font-mono font-bold capitalize",
                  sq.breakout_state === "bullish" ? "text-primary" :
                  sq.breakout_state === "bearish" ? "text-destructive" : ""
                )}
              >
                {sq.breakout_state}
                {sq.breakout_confirmed && " \u2713"}
              </p>
            </div>
          </div>
          <p className="text-3xs text-muted-foreground italic">
            {sq.is_squeeze
              ? "Volatility is unusually tight — this can precede a larger move."
              : sq.breakout_state !== "none"
                ? `Breakout detected ${sq.bars_since_squeeze} bar(s) after squeeze.`
                : "Bands are normal width — no compression detected."}
          </p>
        </div>
      )}

      {result.reason && (
        <p className="text-3xs text-muted-foreground italic">{result.reason}</p>
      )}

      {/* Indicator breakdown */}
      {result.confirmation_details?.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border/10">
          <p className="text-3xs font-bold text-muted-foreground uppercase tracking-widest">Indicators</p>
          {result.confirmation_details.map((detail, i) => (
            <div key={i} className="flex items-center justify-between text-3xs gap-2">
              <div className="flex items-center gap-1.5">
                <span className={detail.met ? "text-primary font-bold" : "text-destructive font-bold"}>
                  {detail.met ? "\u2713" : "\u2717"}
                </span>
                <span className={detail.met ? "text-foreground" : "text-muted-foreground"}>
                  {detail.name}
                </span>
              </div>
              <span className="text-muted-foreground font-mono tabular-nums shrink-0">
                {detail.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Signal Decision Banner ───────────────────────────────────────────────────

const SIGNAL_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof ArrowUpCircle;
}> = {
  buy: {
    label: "BUY",
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    icon: ArrowUpCircle,
  },
  sell: {
    label: "SELL",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
    icon: ArrowDownCircle,
  },
  hold: {
    label: "HOLD",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
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
    <div
      className={`flex items-center gap-4 border-b ${config.border} ${config.bg} px-4 py-2.5`}
      data-testid="signal-decision"
    >
      <Icon className={`h-6 w-6 ${config.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-black tracking-tighter uppercase ${config.color}`}>
          {config.label}
        </p>
        <p className="text-3xs text-muted-foreground">
          <span className="font-mono font-bold text-foreground">{symbol}</span>
          {" · "}<span className="capitalize">{mode}</span>
          {" · "}{dryRun ? "Dry Run" : "LIVE"}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="text-center">
          <p className="text-3xs text-muted-foreground uppercase">Regime</p>
          <p className={cn("text-2xs font-bold", config.color)}>
            {result.regime ?? "\u2014"}
          </p>
        </div>
        <div className="h-6 w-px bg-border/20" />
        <div className="text-center">
          <p className="text-3xs text-muted-foreground uppercase">Confirms</p>
          <p className="font-mono font-bold text-sm text-foreground tabular-nums">
            {result.confirmation_count ?? 0}/8
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────

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
    <div
      className="mt-4 bg-surface-low border border-border/10 rounded-sm overflow-hidden"
      data-testid={title === "Order History" ? "orders" : undefined}
    >
      <div className="flex items-center justify-between h-9 px-4 border-b border-border/10">
        <button onClick={onToggle} className="flex items-center gap-2 text-left">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">{title}</span>
          {count > 0 && (
            <span className="text-3xs font-bold bg-surface-high text-muted-foreground px-1.5 py-0.5 rounded-sm">
              {count}
            </span>
          )}
        </button>
        {open && action}
      </div>
      {open && <div className="px-4 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ─── Signal Marker Builder ────────────────────────────────────────────────────

function buildSignalMarkers(
  result: SignalCheckResult,
  candles: { time: string | number; high: number; low: number }[]
): SignalMarker[] {
  if (!candles.length || !result.signal) return [];
  const sig = result.signal.toLowerCase();
  if (sig === "hold") return [];

  const lastCandle = candles[candles.length - 1];
  return [
    {
      time: lastCandle.time,
      position: sig === "buy" ? "belowBar" : "aboveBar",
      color: sig === "buy" ? "#44dfa3" : "#ff716a",
      shape: sig === "buy" ? "arrowUp" : "arrowDown",
      text: sig.toUpperCase(),
    },
  ];
}

// ─── Volume Formatter ─────────────────────────────────────────────────────────

function formatVolume(vol: number): string {
  if (vol >= 1_000_000_000) return (vol / 1_000_000_000).toFixed(1) + "B";
  if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + "M";
  if (vol >= 1_000) return (vol / 1_000).toFixed(1) + "K";
  return String(Math.round(vol));
}

// ─── Credential Badge ─────────────────────────────────────────────────────────

function CredentialBadge({ credential }: { credential: BrokerCredential }) {
  if (credential.provider === "alpaca") {
    return (
      <Badge variant="alpaca" className="shrink-0 text-3xs">
        Alpaca
      </Badge>
    );
  }
  return (
    <Badge variant="robinhood" className="shrink-0 text-3xs">
      Robinhood
    </Badge>
  );
}

// ─── Tip Tooltip ─────────────────────────────────────────────────────────────
// Lightweight inline tooltip using CSS — no extra dependency.

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center cursor-help">
      <CircleHelp className="h-3 w-3 text-muted-foreground/50 hover:text-amber-400 transition-colors" />
      <span
        className={cn(
          "pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50",
          "w-52 rounded-sm bg-surface-highest border border-border/20",
          "px-2.5 py-2 text-3xs text-muted-foreground leading-relaxed shadow-xl",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
          "whitespace-normal"
        )}
      >
        {text}
      </span>
    </span>
  );
}

// ─── Signal Plain-English Interpretation ──────────────────────────────────────

function SignalPlainEnglish({ result }: { result: SignalCheckResult }) {
  const count = result.confirmation_count ?? 0;
  const signal = result.signal?.toLowerCase() ?? "hold";
  const regime = result.regime?.toLowerCase() ?? "neutral";

  // Build a plain-English summary
  const strengthLabel =
    count >= 7 ? "strong" : count >= 5 ? "moderate" : count >= 3 ? "weak" : "very weak";

  const signalEmoji =
    signal === "buy" ? "🟢" : signal === "sell" ? "🔴" : "🟡";

  const regimeLabel =
    regime === "bull" ? "uptrend" : regime === "bear" ? "downtrend" : "sideways market";

  const recommendation =
    signal === "buy" && count >= 7
      ? "Conditions look favorable for an entry. Suitable for paper trading."
      : signal === "buy" && count >= 5
        ? "Mildly positive signal. Consider waiting for stronger confirmation."
        : signal === "sell"
          ? "The AI suggests reducing exposure or skipping a new entry."
          : "No strong directional signal. Consider waiting for a clearer setup.";

  return (
    <div className="rounded-sm border border-amber-500/15 bg-amber-500/5 px-3 py-2.5 space-y-1">
      <p className="text-3xs font-bold text-amber-300/80 uppercase tracking-widest">What this means</p>
      <p className="text-2xs text-foreground/80 leading-relaxed">
        {signalEmoji}{" "}
        <span className="font-semibold capitalize">{signal === "hold" ? "Hold / Wait" : signal}</span>{" "}
        signal with <span className="font-semibold">{strengthLabel} confidence</span> ({count}/8 indicators agree).{" "}
        The AI detects a{" "}
        <span className="font-semibold">{regimeLabel}</span>.
      </p>
      <p className="text-3xs text-muted-foreground leading-relaxed italic">
        {recommendation}
      </p>
    </div>
  );
}
