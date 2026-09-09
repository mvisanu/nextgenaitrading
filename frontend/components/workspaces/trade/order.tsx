"use client";
import { BrokerLedger } from "@/components/trading/BrokerLedger";
import { SignalDecisionBanner,SignalResultPanel,buildSignalMarkers,formatVolume } from "@/components/trading/desk-components";
import { OrderTicket,type TradingMode } from "@/components/trading/OrderTicket";
import { PaperPortfolioView } from "@/components/trading/PaperPortfolioView";
import { useOrderExecution } from "@/components/trading/useOrderExecution";
import { LIVE_REFRESH_MS,refreshTrading,tradingKeys } from "@/lib/trading-queries";
import { useTradingSelection } from "@/lib/use-trading-selection";

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
import { Alert,AlertDescription,AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,
} from "@/components/ui/dialog";
import { brokerApi,liveApi } from "@/lib/api";
import { usePaperPortfolio } from "@/lib/paperTrading";
import { useTheme } from "@/lib/theme";
import { logLiveTrade } from "@/lib/tradeLog";
import {
cn,formatCurrency,getErrorMessage
} from "@/lib/utils";
import type {
SignalCheckResult,Timeframe
} from "@/types";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import {
CandlestickChart,
Zap
} from "lucide-react";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { toast } from "sonner";

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
  const [selection, updateSelection] = useTradingSelection();
  const committedSymbol = selection.symbol;
  const timeframe = selection.timeframe;
  const mode = selection.strategy;
  const setTimeframe = (value: Timeframe) => updateSelection({ timeframe: value });
  const signalModeSupported = mode === "conservative" || mode === "aggressive" || mode === "squeeze";
  const signalTimeframeSupported = ["1h", "4h", "1d", "1wk", "1mo"].includes(timeframe);
  const [tradingMode, setTradingMode] = useState<TradingMode>("paper");
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [signalResult, setSignalResult] = useState<SignalCheckResult | null>(null);

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
      if (!signalTimeframeSupported || !signalModeSupported) throw new Error("Choose a supported timeframe for signal checks");
      const result = await liveApi.signalCheck({
        symbol: committedSymbol,
        timeframe: timeframe as Timeframe,
        mode: mode as "conservative" | "aggressive" | "squeeze",
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
        const label = order.dry_run ? "[PREVIEW ONLY] " : "";
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
              {tradingMode === "paper" ? "PAPER TRADING" : tradingMode === "dry-run" ? "PREVIEW ONLY" : "LIVE TRADING"}
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
            Real money orders will be submitted to your broker. Switch to Paper or Preview only to return to simulation.
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
        <OrderTicket selection={selection} onSelection={updateSelection} tradingMode={tradingMode} onMode={handleModeChange}
          credentials={credentials} credentialId={selectedCredentialId} onCredential={setSelectedCredentialId} loadingCredentials={credsLoading}
          cash={portfolio.cashBalance} busy={isExecuting} blocked={!!pendingOrder} onSubmit={executeOrder}>
          {!signalModeSupported && <p className="text-sm text-muted-foreground">This strategy runs in reference backtests. Choose Conservative, Aggressive, or Bollinger squeeze to run a signal check.</p>}
          {!signalTimeframeSupported && <p className="text-sm text-muted-foreground">Signal checks support hourly, 4-hour, daily, weekly, and monthly candles. Choose one to check this strategy; your chart timeframe is preserved.</p>}
          <Button type="button" variant="outline" disabled={isSignalChecking || !brokerReady || !signalTimeframeSupported || !signalModeSupported} onClick={() => runSignalCheck()}>
            {isSignalChecking ? "Checking..." : "Run signal check"}
          </Button>
          {!brokerReady && <p className="text-sm text-muted-foreground">Select a broker connection to check signals. Paper orders do not require one.</p>}
          {signalResult && <SignalResultPanel result={signalResult} />}
        </OrderTicket>

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
      {isPaper && <PaperPortfolioView portfolio={portfolio} paperStats={paperStats} onReset={() => setShowResetConfirm(true)} />}

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
              for all subsequent order submissions. Choose Paper or Preview only to return to simulation.
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
