"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
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
  RefreshCw,
  Zap,
} from "lucide-react";

const executeSchema = z.object({
  side: z.enum(["buy", "sell"]),
  quantity: z.preprocess(
    (v) => Number(v),
    z.number().positive("Quantity must be positive")
  ),
});
type ExecuteFormValues = z.infer<typeof executeSchema>;

export default function LiveTradingPage() {
  const queryClient = useQueryClient();
  const [selectedCredentialId, setSelectedCredentialId] = useState<
    number | null
  >(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("1d");
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
    queryKey: ["live", "chart-data", symbol, timeframe],
    queryFn: () => liveApi.chartData(symbol, timeframe),
    enabled: !!symbol,
  });

  const { mutate: runSignalCheck, isPending: isSignalChecking } = useMutation({
    mutationFn: () => {
      if (!selectedCredentialId) throw new Error("Select a broker credential");
      return liveApi.signalCheck({
        symbol,
        timeframe,
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
    defaultValues: { side: "buy", quantity: 0 },
  });

  const { mutate: executeOrder, isPending: isExecuting } = useMutation({
    mutationFn: (values: ExecuteFormValues) => {
      if (!selectedCredentialId)
        throw new Error("Select a broker credential");
      return liveApi.execute({
        symbol,
        side: values.side,
        quantity: values.quantity,
        credential_id: selectedCredentialId,
        dry_run: dryRun,
        strategy_run_id: signalResult?.strategy_run_id,
      });
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["live", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["live", "positions"] });
      const label = order.dry_run ? "[DRY RUN] " : "";
      toast.success(`${label}Order submitted: ${order.side?.toUpperCase()} ${symbol}`);
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
                ) : (
                  <Select
                    onValueChange={(v) => setSelectedCredentialId(Number(v))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a credential..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credentials.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No credentials saved — add one in Profile
                        </SelectItem>
                      ) : (
                        credentials.filter((c) => c.is_active).map((cred) => (
                          <SelectItem
                            key={cred.id}
                            value={String(cred.id)}
                          >
                            {cred.profile_name}
                          </SelectItem>
                        ))
                      )}
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
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Regime:</span>
                  <Badge variant={getRegimeVariant(signalResult.regime)}>
                    {signalResult.regime}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Signal:</span>
                  <Badge variant={getSignalVariant(signalResult.signal)}>
                    {signalResult.signal.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {signalResult.confirmation_count} confirmations
                  </span>
                </div>
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
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0"
                    {...registerExecute("quantity")}
                  />
                  {executeErrors.quantity && (
                    <p className="text-xs text-destructive">
                      {executeErrors.quantity.message?.toString()}
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
              <PriceChart data={chartData.candles} symbol={symbol} height={300} />
            ) : (
              <Skeleton className="h-[300px] w-full" />
            )}
          </CardContent>
        </Card>
      </div>

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
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Recent Orders</CardTitle>
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
                  <TableHead className="text-right">Qty</TableHead>
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
                      {order.filled_quantity ?? order.quantity ?? "-"}
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
