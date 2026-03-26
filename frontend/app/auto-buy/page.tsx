"use client";

/**
 * /auto-buy — Auto-Buy Controls and Decision Log
 *
 * Refactored for clarity:
 *   - Step-by-step guided layout (Setup → Configure → Test → Monitor)
 *   - Inline status indicators showing current state at a glance
 *   - Dry-run promoted as the first action for new users
 *   - Decision log with better filtering and readability
 *
 * IMPORTANT: Auto-buy is disabled by default. It must never execute without
 * passing every safeguard. No language implying guaranteed results is used.
 */

import { useEffect, useState, useMemo } from "react";
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
  Shield,
  Settings2,
  ListChecks,
  Play,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { autoBuyApi, brokerApi } from "@/lib/api";
import { logAutoBuyTrade } from "@/lib/tradeLog";
import {
  formatCurrency,
  formatDateTime,
  getErrorMessage,
  cn,
} from "@/lib/utils";
import type {
  AutoBuyDecisionState,
  AutoBuySettings,
  AutoBuyDryRunResult,
  BrokerCredential,
  UpdateAutoBuySettingsRequest,
} from "@/types";

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

// ─── Status summary strip ─────────────────────────────────────────────────────

function StatusStrip({ settings }: { settings: AutoBuySettings | undefined }) {
  if (!settings) return null;

  const items = [
    {
      label: "Engine",
      value: settings.enabled ? "Active" : "Off",
      color: settings.enabled ? "text-green-400" : "text-muted-foreground",
      dot: settings.enabled ? "bg-green-400" : "bg-muted-foreground",
    },
    {
      label: "Mode",
      value: settings.paper_mode ? "Paper" : "LIVE",
      color: settings.paper_mode ? "text-blue-400" : "text-red-400",
      dot: settings.paper_mode ? "bg-blue-400" : "bg-red-400",
    },
    {
      label: "Max Order",
      value: formatCurrency(settings.max_trade_amount),
      color: "text-foreground",
    },
    {
      label: "Confidence",
      value: `${Math.round(settings.confidence_threshold * 100)}%`,
      color: "text-foreground",
    },
    {
      label: "Drawdown Limit",
      value: `${Math.round(Math.abs(settings.max_expected_drawdown) * 100)}%`,
      color: "text-foreground",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-1.5">
          {item.dot && (
            <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", item.dot)} />
          )}
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {item.label}:
          </span>
          <span className={cn("text-xs font-semibold", item.color)}>
            {item.value}
          </span>
          {i < items.length - 1 && (
            <Separator orientation="vertical" className="h-3 ml-1.5" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible step card ────────────────────────────────────────────────────

function StepCard({
  step,
  title,
  icon: Icon,
  iconColor,
  defaultOpen = false,
  badge,
  children,
}: {
  step: number;
  title: string;
  icon: typeof Settings2;
  iconColor: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-secondary/30 transition-colors rounded-t-lg"
      >
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
          {step}
        </span>
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <span className="flex-1 font-medium text-sm">{title}</span>
        {badge}
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 px-4">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutoBuyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [enableConfirmOpen, setEnableConfirmOpen] = useState(false);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [dryRunTicker, setDryRunTicker] = useState("AAPL");
  const [dryRunResult, setDryRunResult] = useState<AutoBuyDryRunResult | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");

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
      toast.success("Settings saved");
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

      // Log to trade log
      const reasonCodes = (result.reason_codes ?? []).map((code: any) =>
        typeof code === "string" ? code : `${code.check}: ${code.result}`
      );
      logAutoBuyTrade({
        ticker: result.ticker,
        state: result.decision_state,
        dryRun: true,
        reasonCodes,
        confidenceScore:
          typeof result.signal_payload?.confidence_score === "number"
            ? result.signal_payload.confidence_score
            : null,
        currentPrice:
          typeof result.signal_payload?.current_price === "number"
            ? result.signal_payload.current_price
            : null,
        orderAmount:
          typeof result.order_payload?.notional_usd === "number"
            ? result.order_payload.notional_usd
            : null,
      });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Dry run failed"));
    },
  });

  const filteredLog = useMemo(() => {
    if (logFilter === "all") return decisionLog;
    return decisionLog.filter(
      (entry) => entry.decision_state === logFilter
    );
  }, [decisionLog, logFilter]);

  function handleEnableToggle(checked: boolean) {
    if (checked) {
      setEnableConfirmOpen(true);
    } else {
      updateSettings({ enabled: false });
    }
  }

  function confirmEnable() {
    updateSettings({ enabled: true });
    setEnableConfirmOpen(false);
  }

  function handlePaperToggle(checked: boolean) {
    if (!checked) {
      setLiveConfirmOpen(true);
    } else {
      updateSettings({ paper_mode: true });
    }
  }

  function confirmLiveMode() {
    if (!liveConfirmed) {
      toast.error("You must check the confirmation box to switch to live mode");
      return;
    }
    updateSettings({ paper_mode: false, confirm_live_trading: true });
    setLiveConfirmed(false);
    setLiveConfirmOpen(false);
    toast.warning("Live mode enabled — real broker orders may be submitted");
  }


  return (
    <AppShell title="Auto-Buy">
      {/* Current status at a glance */}
      <StatusStrip settings={settings} />

      <div className="mt-4 space-y-3">
        {/* ── Step 1: Safety & Mode ─────────────────────────────────── */}
        <StepCard
          step={1}
          title="Safety & Mode"
          icon={Shield}
          iconColor="text-amber-400"
          defaultOpen={!settings?.enabled}
          badge={
            settings ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] mr-2",
                  settings.enabled
                    ? settings.paper_mode
                      ? "text-blue-400 border-blue-400/30"
                      : "text-red-400 border-red-400/30"
                    : "text-muted-foreground"
                )}
              >
                {settings.enabled
                  ? settings.paper_mode
                    ? "Paper mode"
                    : "LIVE"
                  : "Disabled"}
              </Badge>
            ) : undefined
          }
        >
          {settingsLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : settings ? (
            <div className="space-y-3 pt-2">
              {/* Disclaimer */}
              <Alert
                data-testid="risk-disclaimer"
                className="border-amber-500/30 bg-amber-500/5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Auto-buy may place real orders in your brokerage account. Past
                  entry zone performance does not guarantee future results. Start
                  with paper mode.
                </AlertDescription>
              </Alert>

              {/* Master toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Auto-Buy Engine</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings.enabled
                      ? "Actively evaluating tickers for automated orders"
                      : "Monitoring only — no orders will be placed"}
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={handleEnableToggle}
                  disabled={isSaving}
                />
              </div>

              {/* Paper / Live */}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {settings.paper_mode ? "Paper Mode" : "Live Mode"}
                    </p>
                    {!settings.paper_mode && (
                      <Badge variant="destructive" className="text-[10px] py-0">
                        REAL MONEY
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings.paper_mode
                      ? "Orders are simulated — no real money at risk"
                      : "Real orders submitted to your broker"}
                  </p>
                </div>
                <Switch
                  checked={settings.paper_mode}
                  onCheckedChange={handlePaperToggle}
                  disabled={isSaving}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground pt-2">
              Settings will be created on first save.
            </p>
          )}
        </StepCard>

        {/* ── Step 2: Configure Thresholds ──────────────────────────── */}
        <StepCard
          step={2}
          title="Configure Thresholds"
          icon={Settings2}
          iconColor="text-primary"
          defaultOpen={false}
        >
          {settingsLoading ? (
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings ? (
            <ThresholdSettings
              settings={settings}
              brokerCredentials={brokerCredentials}
              isSaving={isSaving}
              onUpdate={(partial) => updateSettings(partial)}
            />
          ) : null}
        </StepCard>

        {/* ── Step 3: Test with Dry Run ─────────────────────────────── */}
        <StepCard
          step={3}
          title="Test with Dry Run"
          icon={FlaskConical}
          iconColor="text-purple-400"
          defaultOpen={true}
          badge={
            <Badge variant="outline" className="text-[10px] mr-2 text-purple-400 border-purple-400/30">
              Recommended first
            </Badge>
          }
        >
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Simulate the full auto-buy decision pipeline for any ticker.
                See exactly which safeguards pass or fail — without placing a real order.
              </p>
            </div>

            <div className="flex gap-2 items-center">
              <Input
                data-testid="dry-run-ticker"
                value={dryRunTicker}
                onChange={(e) => setDryRunTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="max-w-[120px] h-9"
              />
              <Button
                data-testid="dry-run-btn"
                onClick={() => runDryRun()}
                disabled={isDryRunning || !dryRunTicker.trim()}
                size="sm"
                className="h-9"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                {isDryRunning ? "Running..." : "Dry Run"}
              </Button>
            </div>

            {dryRunResult && <DryRunResultPanel result={dryRunResult} />}
          </div>
        </StepCard>

        {/* ── Step 4: Decision Log ──────────────────────────────────── */}
        <div data-testid="decision-log">
        <StepCard
          step={4}
          title="Decision Log"
          icon={ListChecks}
          iconColor="text-cyan-400"
          defaultOpen={true}
          badge={
            decisionLog.length > 0 ? (
              <Badge variant="secondary" className="text-[10px] mr-2">
                {decisionLog.length} entries
              </Badge>
            ) : undefined
          }
        >
          <div className="space-y-3 pt-2">
            {/* Filter bar */}
            <div className="flex items-center justify-between">
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="Filter by state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="order_filled">Filled</SelectItem>
                  <SelectItem value="ready_to_buy">Ready to buy</SelectItem>
                  <SelectItem value="blocked_by_risk">Blocked</SelectItem>
                  <SelectItem value="order_submitted">Submitted</SelectItem>
                  <SelectItem value="order_rejected">Rejected</SelectItem>
                  <SelectItem value="candidate">Candidate</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["auto-buy", "decision-log"],
                  })
                }
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </Button>
            </div>

            {logLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : filteredLog.length === 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Ticker</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs">Reason Codes</TableHead>
                      <TableHead className="text-xs">Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                <div className="text-center py-8">
                <ListChecks className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {logFilter === "all"
                    ? "No decisions logged yet. Try a dry run above to see how it works."
                    : "No entries match this filter."}
                </p>
              </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Ticker</TableHead>
                      <TableHead className="text-xs">State</TableHead>
                      <TableHead className="text-xs">Checks</TableHead>
                      <TableHead className="text-xs">Mode</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLog.map((entry) => {
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
                              className={cn("text-[10px] gap-1", cfg.className)}
                            >
                              <StateIcon className="h-3 w-3" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {(entry.reason_codes_json ?? []).map(
                                (code: any, i: number) => {
                                  const label =
                                    typeof code === "string"
                                      ? code
                                      : `${code.check}: ${code.result}`;
                                  const failed =
                                    typeof code === "string"
                                      ? code.startsWith("FAILED")
                                      : String(code.result).startsWith("FAILED");
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
                                }
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-[10px]">
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
          </div>
        </StepCard>
        </div>
      </div>

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
      <Dialog open={liveConfirmOpen} onOpenChange={(open) => { setLiveConfirmOpen(open); if (!open) setLivePassword(""); }}>
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
              Check the box below to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm-live"
              checked={liveConfirmed}
              onChange={(e) => setLiveConfirmed(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="confirm-live" className="text-sm">
              I understand this will use real money and accept the risk
            </label>
          </div>
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

// ─── Threshold settings (Step 2 content) ──────────────────────────────────────

function ThresholdSettings({
  settings,
  brokerCredentials,
  isSaving,
  onUpdate,
}: {
  settings: AutoBuySettings;
  brokerCredentials: BrokerCredential[];
  isSaving: boolean;
  onUpdate: (partial: UpdateAutoBuySettingsRequest) => void;
}) {
  const [maxAmount, setMaxAmount] = useState(String(settings.max_trade_amount));
  const [confidence, setConfidence] = useState(settings.confidence_threshold);
  const [drawdown, setDrawdown] = useState(Math.abs(settings.max_expected_drawdown));

  function saveNumericFields() {
    onUpdate({
      max_trade_amount: parseFloat(maxAmount) || settings.max_trade_amount,
      confidence_threshold: confidence,
      max_expected_drawdown: -Math.abs(drawdown),
    });
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Max trade amount */}
      <div className="space-y-1.5">
        <Label htmlFor="max-amount" className="text-xs">
          Max trade amount per order
        </Label>
        <div className="relative max-w-[200px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
            $
          </span>
          <Input
            id="max-amount"
            type="number"
            min="10"
            step="50"
            className="pl-7 h-9"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            onBlur={saveNumericFields}
          />
        </div>
      </div>

      {/* Confidence threshold */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="confidence-slider" className="text-xs">
            Minimum confidence to trigger
          </Label>
          <span className="text-sm font-bold text-primary tabular-nums">
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
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>30% lenient</span>
          <span>95% strict</span>
        </div>
      </div>

      {/* Max drawdown */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="drawdown-slider" className="text-xs">
            Block if expected drawdown exceeds
          </Label>
          <span className="text-sm font-bold text-destructive tabular-nums">
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
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>3% tight</span>
          <span>30% loose</span>
        </div>
      </div>

      <Separator />

      {/* Earnings blackout */}
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
          <Label htmlFor="earnings-blackout" className="cursor-pointer text-xs">
            Earnings blackout
          </Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Block auto-buy when ticker has earnings within 5 days
          </p>
        </div>
      </div>

      {/* Allowed broker accounts */}
      {brokerCredentials.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs">Allowed broker accounts</Label>
            <div className="space-y-1.5">
              {brokerCredentials
                .filter((c) => c.is_active)
                .map((cred) => {
                  const isAllowed = (
                    settings.allowed_account_ids_json ?? []
                  ).includes(cred.id);
                  return (
                    <label
                      key={cred.id}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer text-xs transition-colors",
                        isAllowed
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isAllowed}
                        onChange={(e) => {
                          const current = settings.allowed_account_ids_json ?? [];
                          const updated = e.target.checked
                            ? [...current, cred.id]
                            : current.filter((id) => id !== cred.id);
                          onUpdate({ allowed_account_ids_json: updated });
                        }}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="font-medium">{cred.profile_name}</span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] py-0 ml-auto"
                      >
                        {cred.provider}
                      </Badge>
                    </label>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dry run result panel ─────────────────────────────────────────────────────

function DryRunResultPanel({ result }: { result: AutoBuyDryRunResult }) {
  const cfg = STATE_CONFIG[result.decision_state] ?? STATE_CONFIG.candidate;
  const StateIcon = cfg.icon;

  const passed = (result.reason_codes ?? []).filter((code: any) => {
    if (typeof code === "string") return !code.startsWith("FAILED");
    return !String(code.result).startsWith("FAILED");
  }).length;
  const total = (result.reason_codes ?? []).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn("text-sm gap-1.5 px-3 py-1", cfg.className)}
        >
          <StateIcon className="h-4 w-4" />
          {cfg.label}
        </Badge>
        <span className="font-mono text-sm font-semibold">{result.ticker}</span>
        <div className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {passed}/{total} checks passed
            </span>
          )}
          <Badge variant="secondary" className="text-[10px]">
            Dry run
          </Badge>
        </div>
      </div>

      {/* Reason codes */}
      {total > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Safeguard checks
          </p>
          <div className="flex flex-wrap gap-1">
            {(result.reason_codes ?? []).map((code: any, i: number) => {
              const label =
                typeof code === "string"
                  ? code
                  : `${code.check}: ${code.result}`;
              const failed =
                typeof code === "string"
                  ? code.startsWith("FAILED")
                  : String(code.result).startsWith("FAILED");
              return (
                <span
                  key={i}
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded inline-flex items-center gap-1",
                    failed
                      ? "bg-red-500/10 text-red-400"
                      : "bg-green-500/10 text-green-400"
                  )}
                >
                  {failed ? (
                    <XCircle className="h-2.5 w-2.5" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  )}
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Signal snapshot */}
      {Object.keys(result.signal_payload).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Signal snapshot
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-secondary/30 rounded-lg p-2.5">
            {(
              [
                ["confidence_score", "Confidence"],
                ["buy_zone_low", "Zone Low"],
                ["buy_zone_high", "Zone High"],
                ["current_price", "Current Price"],
              ] as [string, string][]
            ).map(([key, label]) => {
              const val = result.signal_payload[key];
              if (val === undefined) return null;
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
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
