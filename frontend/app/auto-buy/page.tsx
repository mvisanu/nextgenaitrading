"use client";

/**
 * /auto-buy — Auto-Buy Controls and Decision Log
 *
 * Settings panel:
 *   - Master enable Switch (requires confirmation Dialog)
 *   - Paper / Live mode toggle (second confirmation for live)
 *   - Max trade amount
 *   - Confidence threshold slider
 *   - Max expected drawdown slider
 *   - Earnings blackout toggle
 *   - Allowed broker accounts multi-select
 *
 * Decision log table with color-coded state badges.
 *
 * Protected route: requires authentication.
 *
 * IMPORTANT: Auto-buy is disabled by default. It must never execute without
 * passing every safeguard. No language implying guaranteed results is used.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Zap,
  FlaskConical,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
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
import { autoBuyApi, brokerApi } from "@/lib/api";
import {
  formatCurrency,
  formatDateTime,
  getErrorMessage,
  cn,
} from "@/lib/utils";
import type { AutoBuyDecisionState, AutoBuySettings } from "@/types";

// ─── Decision state badge config ──────────────────────────────────────────────

const STATE_CONFIG: Record<
  AutoBuyDecisionState,
  { label: string; className: string; icon: typeof Circle }
> = {
  order_filled: {
    label: "Filled",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: CheckCircle2,
  },
  ready_to_buy: {
    label: "Ready to buy",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
  },
  ready_to_alert: {
    label: "Ready to alert",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
  },
  blocked_by_risk: {
    label: "Blocked by risk",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  order_submitted: {
    label: "Order submitted",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Clock,
  },
  order_rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
  },
  candidate: {
    label: "Candidate",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
  },
};

export default function AutoBuyPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/auto-buy");
    }
  }, [authLoading, user, router]);

  const [enableConfirmOpen, setEnableConfirmOpen] = useState(false);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [dryRunTicker, setDryRunTicker] = useState("AAPL");
  const [dryRunResult, setDryRunResult] = useState<
    import("@/types").AutoBuyDryRunResult | null
  >(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["auto-buy", "settings"],
    queryFn: autoBuyApi.getSettings,
    enabled: !!user,
  });

  const { data: decisionLog = [], isLoading: logLoading } = useQuery({
    queryKey: ["auto-buy", "decision-log"],
    queryFn: () => autoBuyApi.decisionLog(50),
    enabled: !!user,
  });

  const { data: brokerCredentials = [] } = useQuery({
    queryKey: ["broker", "credentials"],
    queryFn: brokerApi.list,
    enabled: !!user,
  });

  const { mutate: updateSettings, isPending: isSaving } = useMutation({
    mutationFn: autoBuyApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-buy", "settings"] });
      toast.success("Auto-buy settings saved");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    },
  });

  const { mutate: runDryRun, isPending: isDryRunning } = useMutation({
    mutationFn: () => autoBuyApi.dryRun(dryRunTicker.trim().toUpperCase()),
    onSuccess: (result) => {
      setDryRunResult(result);
      toast.success(`Dry run complete for ${result.ticker}`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Dry run failed"));
    },
  });

  function handleEnableToggle(checked: boolean) {
    if (checked) {
      // Enabling — require confirmation
      setEnableConfirmOpen(true);
    } else {
      // Disabling — immediate, no confirmation needed
      updateSettings({ enabled: false });
    }
  }

  function confirmEnable() {
    updateSettings({ enabled: true });
    setEnableConfirmOpen(false);
  }

  function handlePaperToggle(checked: boolean) {
    // checked = paper mode ON, unchecked = live mode
    if (!checked) {
      // About to switch to live — require confirmation
      setLiveConfirmOpen(true);
    } else {
      updateSettings({ paper_mode: true });
    }
  }

  function confirmLiveMode() {
    updateSettings({ paper_mode: false });
    setLiveConfirmOpen(false);
    toast.warning("Live mode enabled — real broker orders may be submitted");
  }

  if (authLoading || !user) return null;

  return (
    <AppShell title="Auto-Buy">
      {/* Risk disclaimer — always visible */}
      <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">
          Auto-buy is optional and disabled by default
        </AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Auto-buy may result in real orders being placed in your brokerage
          account. It is always subject to multiple independent risk checks
          before execution. Past entry zone performance does not guarantee
          future results. Use paper mode to validate the system before enabling
          live execution.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Settings panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {settingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : settings ? (
              <SettingsForm
                settings={settings}
                brokerCredentials={brokerCredentials}
                isSaving={isSaving}
                onEnableToggle={handleEnableToggle}
                onPaperToggle={handlePaperToggle}
                onUpdate={(partial) => updateSettings(partial)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Auto-buy settings not found. They will be created on first
                save.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dry run panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dry Run Simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Simulate the full auto-buy decision pipeline for any ticker
              without submitting a real order.
            </p>
            <div className="flex gap-2">
              <Input
                value={dryRunTicker}
                onChange={(e) => setDryRunTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="max-w-[120px]"
              />
              <Button
                onClick={() => runDryRun()}
                disabled={
                  isDryRunning || !dryRunTicker.trim()
                }
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                {isDryRunning ? "Running..." : "Dry Run"}
              </Button>
            </div>

            {/* Dry run result */}
            {dryRunResult && (
              <DryRunResultPanel result={dryRunResult} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Decision log */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Decision Log</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["auto-buy", "decision-log"],
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : decisionLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No decisions logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Reason codes</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {decisionLog.map((entry) => {
                    const cfg =
                      STATE_CONFIG[entry.decision_state] ??
                      STATE_CONFIG.candidate;
                    const StateIcon = cfg.icon;
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(entry.created_at)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {entry.ticker}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs gap-1", cfg.className)}
                          >
                            <StateIcon className="h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(entry.reason_codes_json ?? []).map((code: any, i: number) => {
                              const label = typeof code === "string" ? code : `${code.check}: ${code.result}`;
                              const failed = typeof code === "string" ? code.startsWith("FAILED") : String(code.result).startsWith("FAILED");
                              return (
                              <span
                                key={i}
                                className={cn(
                                  "text-[10px] font-mono px-1.5 py-0.5 rounded",
                                  failed
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-green-500/10 text-green-400"
                                )}
                              >
                                {label}
                              </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {entry.dry_run ? "Dry run" : "Live"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enable auto-buy confirmation dialog */}
      <Dialog open={enableConfirmOpen} onOpenChange={setEnableConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-500">
              Enable Auto-Buy?
            </DialogTitle>
            <DialogDescription>
              Enabling auto-buy allows the system to automatically submit
              orders when a ticker passes all risk safeguards. Orders may be
              placed in your configured broker accounts.
              <br />
              <br />
              Auto-buy is subject to multiple independent risk checks and will
              only execute when all safeguards pass. However, no system can
              guarantee profitable outcomes. Past entry zone outcomes do not
              imply future results.
              <br />
              <br />
              Confirm that you understand the risks before proceeding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEnableConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={confirmEnable}>
              I understand — Enable Auto-Buy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live mode confirmation dialog */}
      <Dialog open={liveConfirmOpen} onOpenChange={setLiveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Switch to Live Mode?
            </DialogTitle>
            <DialogDescription>
              Live mode will submit real orders to your brokerage account using
              real money. Paper mode is recommended until you have validated
              the system with dry runs.
              <br />
              <br />
              Are you sure you want to switch to live execution?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLiveConfirmOpen(false)}
            >
              Cancel — keep paper mode
            </Button>
            <Button variant="destructive" onClick={confirmLiveMode}>
              Yes, switch to live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Settings form ─────────────────────────────────────────────────────────────

interface SettingsFormProps {
  settings: AutoBuySettings;
  brokerCredentials: import("@/types").BrokerCredential[];
  isSaving: boolean;
  onEnableToggle: (checked: boolean) => void;
  onPaperToggle: (checked: boolean) => void;
  onUpdate: (partial: import("@/types").UpdateAutoBuySettingsRequest) => void;
}

function SettingsForm({
  settings,
  brokerCredentials,
  isSaving,
  onEnableToggle,
  onPaperToggle,
  onUpdate,
}: SettingsFormProps) {
  const [maxAmount, setMaxAmount] = useState(
    String(settings.max_trade_amount)
  );
  const [confidence, setConfidence] = useState(settings.confidence_threshold);
  const [drawdown, setDrawdown] = useState(
    Math.abs(settings.max_expected_drawdown)
  );

  function saveNumericFields() {
    onUpdate({
      max_trade_amount: parseFloat(maxAmount) || settings.max_trade_amount,
      confidence_threshold: confidence,
      max_expected_drawdown: -Math.abs(drawdown),
    });
  }

  return (
    <div className="space-y-5">
      {/* Master enable */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div>
          <p className="text-sm font-medium">Auto-Buy Enabled</p>
          <p className="text-xs text-muted-foreground">
            {settings.enabled
              ? "System is actively evaluating tickers for automated orders"
              : "System is monitoring only — no orders will be placed"}
          </p>
        </div>
        <Switch
          checked={settings.enabled}
          onCheckedChange={onEnableToggle}
          disabled={isSaving}
        />
      </div>

      {/* Paper / Live toggle */}
      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div>
          <p className="text-sm font-medium">
            {settings.paper_mode ? "Paper Mode" : "Live Mode"}
          </p>
          <p className="text-xs text-muted-foreground">
            {settings.paper_mode
              ? "Orders are simulated — no real money at risk"
              : "Real orders will be submitted to your broker"}
          </p>
          {!settings.paper_mode && (
            <Badge variant="destructive" className="text-xs mt-1">
              LIVE — real money
            </Badge>
          )}
        </div>
        <Switch
          checked={settings.paper_mode}
          onCheckedChange={onPaperToggle}
          disabled={isSaving}
        />
      </div>

      {/* Max trade amount */}
      <div className="space-y-1.5">
        <Label htmlFor="max-amount">Max trade amount (USD)</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
            <Input
              id="max-amount"
              type="number"
              min="10"
              step="50"
              className="pl-7"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              onBlur={saveNumericFields}
            />
          </div>
        </div>
      </div>

      {/* Confidence threshold slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="confidence-slider">
            Confidence threshold (minimum to trigger)
          </Label>
          <span className="text-sm font-semibold text-primary">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <input
          id="confidence-slider"
          type="range"
          min={0.3}
          max={0.95}
          step={0.05}
          value={confidence}
          onChange={(e) => setConfidence(parseFloat(e.target.value))}
          onMouseUp={saveNumericFields}
          onTouchEnd={saveNumericFields}
          className="w-full accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>30% — lenient</span>
          <span>95% — strict</span>
        </div>
      </div>

      {/* Max expected drawdown slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="drawdown-slider">
            Max expected drawdown (block if worse)
          </Label>
          <span className="text-sm font-semibold text-destructive">
            -{Math.round(drawdown * 100)}%
          </span>
        </div>
        <input
          id="drawdown-slider"
          type="range"
          min={0.03}
          max={0.30}
          step={0.01}
          value={drawdown}
          onChange={(e) => setDrawdown(parseFloat(e.target.value))}
          onMouseUp={saveNumericFields}
          onTouchEnd={saveNumericFields}
          className="w-full accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>3% — tight</span>
          <span>30% — loose</span>
        </div>
      </div>

      {/* Earnings blackout toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id="earnings-blackout"
          checked={!settings.allow_near_earnings}
          onCheckedChange={(checked) =>
            onUpdate({ allow_near_earnings: !checked })
          }
          disabled={isSaving}
        />
        <div>
          <Label htmlFor="earnings-blackout" className="cursor-pointer">
            Earnings blackout
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Block auto-buy when ticker has earnings within 5 days
          </p>
        </div>
      </div>

      {/* Allowed broker accounts */}
      {brokerCredentials.length > 0 && (
        <div className="space-y-2">
          <Label>Allowed broker accounts</Label>
          <div className="space-y-1.5">
            {brokerCredentials.filter((c) => c.is_active).map((cred) => {
              const isAllowed = (settings.allowed_account_ids_json ?? []).includes(
                cred.id
              );
              return (
                <label
                  key={cred.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer text-xs transition-colors",
                    isAllowed
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-secondary"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isAllowed}
                    onChange={(e) => {
                      const current = settings.allowed_account_ids_json;
                      const updated = e.target.checked
                        ? [...current, cred.id]
                        : current.filter((id) => id !== cred.id);
                      onUpdate({ allowed_account_ids_json: updated });
                    }}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="font-medium">{cred.profile_name}</span>
                  <Badge variant="secondary" className="text-[10px] py-0 ml-auto">
                    {cred.provider}
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dry run result panel ─────────────────────────────────────────────────────

function DryRunResultPanel({
  result,
}: {
  result: import("@/types").AutoBuyDryRunResult;
}) {
  const cfg = STATE_CONFIG[result.decision_state] ?? STATE_CONFIG.candidate;
  const StateIcon = cfg.icon;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn("text-sm gap-1.5 px-3 py-1", cfg.className)}
        >
          <StateIcon className="h-4 w-4" />
          {cfg.label}
        </Badge>
        <span className="font-mono text-sm font-semibold">{result.ticker}</span>
        <Badge variant="secondary" className="text-xs ml-auto">
          Dry run
        </Badge>
      </div>

      {/* Reason codes */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Safeguard checks:
        </p>
        <div className="flex flex-wrap gap-1">
          {result.reason_codes.map((code: any, i: number) => {
            const label = typeof code === "string" ? code : `${code.check}: ${code.result}`;
            const failed = typeof code === "string" ? code.startsWith("FAILED") : String(code.result).startsWith("FAILED");
            return (
              <span
                key={i}
                className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded",
                  failed
                    ? "bg-red-500/10 text-red-400"
                    : "bg-green-500/10 text-green-400"
                )}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Signal snapshot */}
      {Object.keys(result.signal_payload).length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Signal snapshot:
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {(
              [
                ["confidence_score", "Confidence"],
                ["buy_zone_low", "Zone Low"],
                ["buy_zone_high", "Zone High"],
                ["current_price", "Price"],
              ] as [string, string][]
            ).map(([key, label]) => {
              const val = result.signal_payload[key];
              if (val === undefined) return null;
              return (
                <div key={key} className="flex gap-1.5">
                  <span className="text-muted-foreground">{label}:</span>
                  <span className="font-mono font-medium">
                    {typeof val === "number"
                      ? key === "confidence_score"
                        ? `${Math.round((val as number) * 100)}%`
                        : formatCurrency(val as number)
                      : String(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
