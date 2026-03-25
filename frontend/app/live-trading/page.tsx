"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { PriceChart } from "@/components/charts/PriceChart";
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
import {
  formatDateTime,
  formatCurrency,
  getErrorMessage,
  getRegimeVariant,
  getSignalVariant,
} from "@/lib/utils";
import type {
  BrokerCredential,
  SignalCheckResult,
  Timeframe,
} from "@/types";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  MinusCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import type { SignalMarker } from "@/types";

const executeSchema = z.object({
  side: z.enum(["buy", "sell"]),
  amount: z.preprocess(
    (v) => Number(v),
    z.number().positive("Amount must be positive")
  ),
});
type ExecuteFormValues = z.infer<typeof executeSchema>;

export default function LiveTradingPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/live-trading");
    }
  }, [authLoading, user, router]);
  const [selectedCredentialId, setSelectedCredentialId] = useState<
    number | null
  >(null);
  const [symbol, setSymbol] = useState("AAPL");
  // committedSymbol is only updated on blur or Enter — prevents API calls on every keystroke
  const [committedSymbol, setCommittedSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
  const [mode, setMode] = useState<"conservative" | "aggressive">("conservative");
  const [dryRun, setDryRun] = useState(true);
  const [showLiveConfirm, setShowLiveConfirm] = useState(false);
  const [signalResult, setSignalResult] = useState<SignalCheckResult | null>(
    null
  );

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
    // Only fetch when we have a plausible symbol (at least 1 letter, min 2 chars)
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
    mutationFn: (values: ExecuteFormValues) => {
      if (!selectedCredentialId)
        throw new Error("Select a broker credential");
      return liveApi.execute({
        symbol: committedSymbol,
        side: values.side,
        notional_usd: values.amount,
        credential_id: selectedCredentialId,
        dry_run: dryRun,
        strategy_run_id: signalResult?.strategy_run_id,
      });
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["live", "positions"] });
      const label = order.dry_run ? "[DRY RUN] " : "";
      const amt = order.notional_usd ? ` $${order.notional_usd}` : "";
      toast.success(`${label}Order submitted: ${order.side?.toUpperCase()}${amt} ${symbol}`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Order execution failed"));
    },
  });

  const selectedCredential = credentials.find(
    (c) => c.id === selectedCredentialId
  );

  function handleDryRunToggle(checked: boolean) {
    if (!checked) {
      // About to enable live mode — require confirmation
      setShowLiveConfirm(true);
    } else {
      setDryRun(true);
    }
  }

  function confirmLiveMode() {
    setDryRun(false);
    setShowLiveConfirm(false);
    toast.warning("LIVE MODE enabled — real money at risk");
  }

  function refreshData() {
    queryClient.invalidateQueries({ queryKey: ["live", "positions"] });
    queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
    toast.info("Refreshed");
  }

  if (authLoading || !user) return null;

  return (
    <AppShell title="Live Trading">
      {/* Persistent risk disclaimer — always visible */}
      <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">Financial Risk Disclaimer</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          This platform is educational software. Live trading with real money carries
          significant financial risk, including total loss of capital. Past strategy
          performance does not guarantee future results. Always paper-trade first
          before using real funds.
        </AlertDescription>
      </Alert>

      {/* Live Mode Banner */}
      {!dryRun && (
        <Alert variant="destructive" className="mb-6">
          <Zap className="h-4 w-4" />
          <AlertTitle>LIVE MODE ACTIVE</AlertTitle>
          <AlertDescription>
            Real money orders will be submitted to your broker. Disable dry-run to return to simulation mode.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Signal Check &amp; Order Execution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Broker selector */}
            <div className="space-y-1.5">
              <Label>Broker Credential</Label>
              <div className="flex items-center gap-2">
                {credsLoading ? (
                  <Skeleton className="h-10 flex-1" />
                ) : credentials.length === 0 ? (
                  <Alert className="flex-1 border-amber-500/30 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-sm">
                      No broker credentials found.{" "}
                      <a href="/profile" className="underline font-medium text-primary hover:text-primary/80">
                        Go to Profile
                      </a>{" "}
                      to add your Alpaca or Robinhood API keys first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Select
                    onValueChange={(v) => setSelectedCredentialId(Number(v))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a credential..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credentials.filter((c) => c.is_active).map((cred) => (
                        <SelectItem
                          key={cred.id}
                          value={String(cred.id)}
                        >
                          {cred.profile_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedCredential && (
                  <CredentialBadge credential={selectedCredential} />
                )}
              </div>
            </div>

            {/* Symbol + Timeframe */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Symbol</Label>
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
                />
              </div>
              <div className="space-y-1.5">
                <Label>Timeframe</Label>
                <Select
                  value={timeframe}
                  onValueChange={(v) => setTimeframe(v as Timeframe)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1d">1d</SelectItem>
                    <SelectItem value="1h">1h</SelectItem>
                    <SelectItem value="4h">4h</SelectItem>
                    <SelectItem value="1wk">1wk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Strategy Mode */}
            <div className="space-y-1.5">
              <Label>Strategy Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "conservative" | "aggressive")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dry Run Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                checked={dryRun}
                onCheckedChange={handleDryRunToggle}
                id="dry-run"
              />
              <Label htmlFor="dry-run">
                Dry Run{" "}
                <span className="text-muted-foreground text-xs">
                  {dryRun ? "(simulation)" : "(LIVE — real orders)"}
                </span>
              </Label>
            </div>

            {/* Check Signal */}
            <Button
              onClick={() => runSignalCheck()}
              disabled={isSignalChecking || !selectedCredentialId}
              className="w-full"
            >
              {isSignalChecking ? "Checking..." : "Check Signal"}
            </Button>

            {/* Signal Result */}
            {signalResult && (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Regime:</span>
                  <Badge variant={getRegimeVariant(signalResult.regime)}>
                    {signalResult.regime}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Signal:</span>
                  <Badge variant={getSignalVariant(signalResult.signal)}>
                    {signalResult.signal?.toUpperCase() ?? '—'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {signalResult.confirmation_count}/8 confirmations
                  </span>
                </div>
                {signalResult.reason && (
                  <p className="text-xs text-muted-foreground italic">{signalResult.reason}</p>
                )}
                {signalResult.confirmation_details?.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border">
                    <p className="text-xs font-medium text-muted-foreground">Indicator Breakdown</p>
                    {signalResult.confirmation_details.map((detail, i) => (
                      <div key={i} className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={detail.met ? "text-green-400" : "text-red-400"}>
                            {detail.met ? "\u2713" : "\u2717"}
                          </span>
                          <span className={detail.met ? "text-foreground" : "text-muted-foreground"}>
                            {detail.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground font-mono text-[11px] shrink-0">
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Execute Order */}
            <form
              onSubmit={handleExecuteSubmit((v) => executeOrder(v))}
              className="space-y-3 pt-2 border-t border-border"
            >
              <p className="text-xs text-muted-foreground font-medium">Execute Order</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Side</Label>
                  <Select
                    defaultValue="buy"
                    onValueChange={(v) =>
                      setExecuteValue("side", v as "buy" | "sell")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">Buy</SelectItem>
                      <SelectItem value="sell">Sell</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="100.00"
                      className="pl-7"
                      {...registerExecute("amount")}
                    />
                  </div>
                  {executeErrors.amount && (
                    <p className="text-xs text-destructive">
                      {executeErrors.amount.message?.toString()}
                    </p>
                  )}
                </div>
              </div>
              <Button
                type="submit"
                variant={dryRun ? "default" : "destructive"}
                className="w-full"
                disabled={isExecuting || !selectedCredentialId}
              >
                {isExecuting
                  ? "Submitting..."
                  : dryRun
                  ? "Execute (Dry Run)"
                  : "Execute LIVE Order"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Price Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Price Chart — {symbol}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData?.candles ? (
              <PriceChart
                data={chartData.candles}
                signals={signalResult ? buildSignalMarkers(signalResult, chartData.candles) : []}
                symbol={symbol}
                height={300}
              />
            ) : (
              <Skeleton className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signal Decision Banner */}
      {signalResult && <SignalDecisionBanner result={signalResult} symbol={committedSymbol} mode={mode} dryRun={dryRun} />}

      {/* Positions Table */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Open Positions</CardTitle>
          <Button variant="ghost" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {positionsLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : positions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No open positions
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg Entry</TableHead>
                  <TableHead className="text-right">Mark Price</TableHead>
                  <TableHead className="text-right">Unrealized PnL</TableHead>
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
                        <span
                          className={
                            pos.unrealized_pnl >= 0
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
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
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="mt-6" data-testid="orders">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Order History</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No orders yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fill Price</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.symbol}</TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={
                          order.side === "buy" ? "default" : "destructive"
                        }
                        className="text-xs"
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
                      {order.filled_price
                        ? formatCurrency(order.filled_price)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {order.dry_run && (
                        <Badge variant="secondary" className="text-xs mr-1">
                          DRY
                        </Badge>
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
        </CardContent>
      </Card>

      {/* Live Mode Confirmation Dialog */}
      <Dialog open={showLiveConfirm} onOpenChange={setShowLiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Enable Live Trading?
            </DialogTitle>
            <DialogDescription>
              You are switching to <strong>LIVE mode</strong>. Real money will be used
              for all subsequent order submissions. This action cannot be undone
              automatically — you must re-enable dry-run to return to simulation.
              <br />
              <br />
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
    </AppShell>
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
    <Card className={`mt-6 ${config.border} ${config.bg}`} data-testid="signal-decision">
      <CardContent className="py-5">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          {/* Left: big signal */}
          <div className="flex items-center gap-4">
            <Icon className={`h-12 w-12 ${config.color}`} />
            <div>
              <p className={`text-3xl font-bold tracking-tight ${config.color}`}>
                {config.label}
              </p>
              <p className="text-sm text-muted-foreground">
                Signal for <span className="font-mono font-medium text-foreground">{symbol}</span>
                {" · "}
                <span className="capitalize">{mode}</span>
                {" · "}
                {dryRun ? "Dry Run" : "LIVE"}
              </p>
            </div>
          </div>

          {/* Right: details */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="rounded-md border border-border bg-background/50 px-3 py-1.5 text-center">
              <p className="text-xs text-muted-foreground">Regime</p>
              <Badge variant={getRegimeVariant(result.regime)} className="mt-0.5">
                {result.regime ?? "—"}
              </Badge>
            </div>
            <div className="rounded-md border border-border bg-background/50 px-3 py-1.5 text-center">
              <p className="text-xs text-muted-foreground">Confirmations</p>
              <p className="font-mono font-bold text-foreground">
                {result.confirmation_count ?? 0}
              </p>
            </div>
            <div className="rounded-md border border-border bg-background/50 px-3 py-1.5 text-center">
              <p className="text-xs text-muted-foreground">Run ID</p>
              <p className="font-mono text-xs text-muted-foreground">
                #{result.strategy_run_id}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
      color: sig === "buy" ? "#26a69a" : "#ef5350",
      shape: sig === "buy" ? "arrowUp" : "arrowDown",
      text: sig.toUpperCase(),
    },
  ];
}

// ─── Credential Badge ────────────────────────────────────────────────────────

function CredentialBadge({ credential }: { credential: BrokerCredential }) {
  if (credential.provider === "alpaca") {
    return (
      <Badge variant="alpaca" className="shrink-0 text-xs">
        Alpaca · Stocks &amp; ETFs
      </Badge>
    );
  }
  return (
    <Badge variant="robinhood" className="shrink-0 text-xs">
      Robinhood · Crypto only
    </Badge>
  );
}
