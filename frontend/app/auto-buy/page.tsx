"use client";

/**
 * /auto-buy — Auto-Buy Configuration (Sovereign Terminal design)
 *
 * Redesigned to match the "Sovereign Terminal" design system:
 * - Terminal-style header with engine instance + status/mode badges
 * - Two-column bento grid: Safety & Operational Mode | Strategy Selection
 * - Define Targets row (dry-run ticker, max order, confidence)
 * - Execution Timeframe row (drawdown, earnings blackout, broker accounts)
 * - Real-time Decision Log (monospace terminal output, colored tags)
 * - Reset Engine / Commit Configuration footer actions
 *
 * IMPORTANT: Auto-buy is disabled by default. No language implying guaranteed
 * results is used anywhere on this page.
 */

import { useEffect, useState, useMemo, useRef } from "react";
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
  Target,
  Timer,
  RotateCcw,
  Save,
  Brain,
  TrendingUp,
  Cpu,
  BarChart2,
  CalendarDays,
  DollarSign,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  { label: string; className: string; icon: typeof Circle; tag: string }
> = {
  order_filled: {
    label: "Filled",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: CheckCircle2,
    tag: "FILLED",
  },
  ready_to_buy: {
    label: "Ready to buy",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
    tag: "READY",
  },
  ready_to_alert: {
    label: "Ready to alert",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
    tag: "ALERT",
  },
  blocked_by_risk: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
    tag: "REJECTED",
  },
  order_submitted: {
    label: "Submitted",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Clock,
    tag: "EXECUTION",
  },
  order_rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
    tag: "REJECTED",
  },
  candidate: {
    label: "Candidate",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
    tag: "ANALYTICS",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
    tag: "SYSTEM",
  },
};

// ─── Tag color for terminal log ────────────────────────────────────────────────

function tagColor(tag: string) {
  switch (tag) {
    case "SYSTEM":    return "text-primary";
    case "ANALYTICS": return "text-blue-400";
    case "DECISION":  return "text-yellow-400";
    case "EXECUTION": return "text-orange-400";
    case "DATA":      return "text-cyan-400";
    case "READY":     return "text-emerald-400";
    case "FILLED":    return "text-green-400";
    case "ALERT":     return "text-amber-400";
    case "REJECTED":  return "text-destructive";
    default:          return "text-muted-foreground";
  }
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: typeof Shield; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Strategy card ─────────────────────────────────────────────────────────────

const STRATEGIES = [
  {
    id: "conservative",
    num: "01",
    label: "Conservative",
    desc: "Low volatility filter, 5% max draw",
    icon: Shield,
  },
  {
    id: "aggressive",
    num: "02",
    label: "Aggressive",
    desc: "High slippage tolerance, momentum play",
    icon: TrendingUp,
  },
  {
    id: "ai_pick",
    num: "03",
    label: "AI Pick",
    desc: "Neural net optimization for current market",
    icon: Brain,
    highlight: true,
  },
  {
    id: "blsh",
    num: "04",
    label: "Mean Reversion",
    desc: "Standard buy low, sell high logic",
    icon: BarChart2,
  },
];

function StrategyCard({
  strategy,
  active,
  onClick,
}: {
  strategy: (typeof STRATEGIES)[0];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = strategy.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col text-left p-3 bg-surface-lowest border-l-2 transition-all group",
        active
          ? "border-primary bg-primary/5"
          : "border-transparent hover:border-primary/50"
      )}
    >
      <span
        className={cn(
          "text-2xs font-black transition-colors",
          active ? "text-primary" : "text-muted-foreground group-hover:text-primary"
        )}
      >
        {strategy.num}
      </span>
      <span
        className={cn(
          "text-[11px] font-bold uppercase mt-2 flex items-center gap-1",
          active ? "text-primary" : "text-foreground"
        )}
      >
        {strategy.highlight && <Icon className="h-2.5 w-2.5" />}
        {strategy.label}
      </span>
      <p
        className={cn(
          "text-3xs mt-1 leading-tight uppercase",
          active ? "text-primary/70" : "text-muted-foreground"
        )}
      >
        {strategy.desc}
      </p>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutoBuyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [enableConfirmOpen, setEnableConfirmOpen] = useState(false);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [livePassword, setLivePassword] = useState("");
  const [dryRunTicker, setDryRunTicker] = useState("AAPL");
  const [dryRunResult, setDryRunResult] = useState<AutoBuyDryRunResult | null>(null);
  const [logFilter, setLogFilter] = useState<string>("all");
  const [activeStrategy, setActiveStrategy] = useState("ai_pick");
  const logEndRef = useRef<HTMLDivElement>(null);

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
    return decisionLog.filter((entry) => entry.decision_state === logFilter);
  }, [decisionLog, logFilter]);

  // Auto-scroll log to bottom when new entries arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredLog.length]);

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

  function handleReset() {
    updateSettings({
      enabled: false,
      paper_mode: true,
    });
    setDryRunResult(null);
    toast.info("Engine reset to safe defaults");
  }

  const engineStatus = settings?.enabled ? "ACTIVE" : "CONFIGURED";
  const engineMode = settings?.paper_mode !== false ? "TESTNET" : "MAINNET";

  return (
    <AppShell title="Auto-Buy">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Auto-Buy Configuration
          </h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Engine Instance: ALGO_UNIT_04
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              settings?.enabled
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-surface-highest text-primary border-primary/20"
            )}
          >
            STATUS: {engineStatus}
          </span>
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              engineMode === "MAINNET"
                ? "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}
          >
            MODE: {engineMode}
          </span>
        </div>
      </div>

      {/* ── Bento grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Section 1: Safety & Operational Mode (4 cols) */}
        <section className="col-span-12 lg:col-span-4 bg-surface-mid p-4 flex flex-col gap-4">
          <SectionHeader icon={Shield} title="Safety & Operational Mode" />

          {/* Live execution warning */}
          <div
            data-testid="risk-disclaimer"
            className="bg-destructive/5 border-l-4 border-destructive p-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-2xs font-bold text-destructive uppercase leading-tight">
                  Live Execution Warning
                </p>
                <p className="text-3xs text-muted-foreground leading-relaxed mt-1">
                  Activating the engine may bypass manual approvals. Past entry zone
                  performance does not guarantee future results. Start with Dry Run Mode.
                </p>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div className="mt-auto space-y-3">
            {settingsLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : settings ? (
              <>
                {/* Toggle Engine */}
                <div className="flex items-center justify-between p-3 bg-surface-lowest">
                  <div>
                    <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
                      Toggle Engine
                    </p>
                    <p className="text-3xs text-muted-foreground mt-0.5">
                      {settings.enabled
                        ? "Evaluating tickers for orders"
                        : "Monitoring only — no orders"}
                    </p>
                  </div>
                  <Switch
                    checked={settings.enabled}
                    onCheckedChange={handleEnableToggle}
                    disabled={isSaving}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                {/* Dry Run Mode */}
                <div className="flex items-center justify-between p-3 bg-surface-lowest">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
                        Dry Run Mode
                      </p>
                      {!settings.paper_mode && (
                        <span className="text-3xs font-bold text-destructive border border-destructive/30 px-1 py-0.5 uppercase">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-3xs text-muted-foreground mt-0.5">
                      {settings.paper_mode
                        ? "Simulated — no real money at risk"
                        : "Real orders to your broker"}
                    </p>
                  </div>
                  <Switch
                    checked={settings.paper_mode}
                    onCheckedChange={handlePaperToggle}
                    disabled={isSaving}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Settings will be created on first save.
              </p>
            )}
          </div>
        </section>

        {/* Section 2: Strategy Selection (8 cols) */}
        <section className="col-span-12 lg:col-span-8 bg-surface-mid p-4">
          <SectionHeader icon={Cpu} title="Strategy Selection" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {STRATEGIES.map((s) => (
              <StrategyCard
                key={s.id}
                strategy={s}
                active={activeStrategy === s.id}
                onClick={() => setActiveStrategy(s.id)}
              />
            ))}
          </div>
        </section>

        {/* Section 3: Define Targets (5 cols) */}
        <section className="col-span-12 lg:col-span-5 bg-surface-mid p-4">
          <SectionHeader icon={Target} title="Define Targets" />

          {settingsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-12 col-span-2" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : settings ? (
            <TargetFields
              settings={settings}
              dryRunTicker={dryRunTicker}
              setDryRunTicker={setDryRunTicker}
              isSaving={isSaving}
              onUpdate={(partial) => updateSettings(partial)}
              onDryRun={() => runDryRun()}
              isDryRunning={isDryRunning}
              dryRunResult={dryRunResult}
            />
          ) : null}
        </section>

        {/* Section 4: Execution Timeframe (7 cols) */}
        <section className="col-span-12 lg:col-span-7 bg-surface-mid p-4">
          <SectionHeader icon={Timer} title="Execution Timeframe" />

          {settingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : settings ? (
            <ExecutionSettings
              settings={settings}
              brokerCredentials={brokerCredentials}
              isSaving={isSaving}
              onUpdate={(partial) => updateSettings(partial)}
            />
          ) : null}
        </section>

        {/* Section 5: Real-time Decision Log (full width) */}
        <section
          data-testid="decision-log"
          className="col-span-12 bg-surface-mid p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
                Real-time Decision Log
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Live streaming indicator */}
              <span className="flex items-center gap-1 text-3xs font-bold text-primary animate-pulse">
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                LIVE STREAMING
              </span>
              {/* Filter */}
              <Select value={logFilter} onValueChange={setLogFilter}>
                <SelectTrigger className="h-6 w-[120px] text-3xs bg-surface-lowest border-none">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="order_filled">Filled</SelectItem>
                  <SelectItem value="ready_to_buy">Ready</SelectItem>
                  <SelectItem value="blocked_by_risk">Blocked</SelectItem>
                  <SelectItem value="order_submitted">Submitted</SelectItem>
                  <SelectItem value="order_rejected">Rejected</SelectItem>
                  <SelectItem value="candidate">Candidate</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["auto-buy", "decision-log"],
                  })
                }
                className="text-3xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear Buffer
              </button>
            </div>
          </div>

          {/* Terminal output */}
          <div className="bg-surface-lowest h-48 overflow-y-auto font-mono text-3xs p-3 space-y-1">
            {logLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground/60">
                <span className="tabular-nums">[--:--:--.---]</span>
                <span className="text-primary uppercase font-bold">[SYSTEM]</span>
                <span>Loading decision log...</span>
              </div>
            ) : filteredLog.length === 0 ? (
              <>
                <div className="flex gap-4 text-muted-foreground/60">
                  <span className="tabular-nums">[00:00:00.000]</span>
                  <span className="text-primary uppercase font-bold">[SYSTEM]</span>
                  <span>Engine status: Standby. Awaiting configuration.</span>
                </div>
                <div className="flex gap-4 text-muted-foreground/60">
                  <span className="tabular-nums">[00:00:00.001]</span>
                  <span className="text-muted-foreground uppercase font-bold">[IDLE]</span>
                  <span>
                    {logFilter === "all"
                      ? "No decisions logged yet. Run a dry run above to see how it works."
                      : "No entries match this filter."}
                  </span>
                </div>
              </>
            ) : (
              filteredLog.map((entry) => {
                const cfg = STATE_CONFIG[entry.decision_state] ?? STATE_CONFIG.candidate;
                const timestamp = new Date(entry.created_at).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                const reasonCodes: string[] = (entry.reason_codes_json ?? []).map(
                  (code: any) =>
                    typeof code === "string"
                      ? code
                      : `${code.check}: ${code.result}`
                );
                const summary = reasonCodes.slice(0, 2).join(", ");
                return (
                  <div key={entry.id} className="flex gap-4 text-muted-foreground/60">
                    <span className="tabular-nums shrink-0">[{timestamp}.000]</span>
                    <span className={cn("uppercase font-bold shrink-0", tagColor(cfg.tag))}>
                      [{cfg.tag}]
                    </span>
                    <span className="text-foreground/80">
                      {entry.ticker}
                      {" — "}
                      {cfg.label}
                      {summary ? `. ${summary}` : ""}
                      {entry.dry_run ? " [DRY RUN]" : ""}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>

          {/* Dry-run result panel below log */}
          {dryRunResult && (
            <div className="mt-3">
              <DryRunResultPanel result={dryRunResult} />
            </div>
          )}
        </section>
      </div>

      {/* ── Footer actions ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 mt-2 border-t border-border/10">
        <Button
          variant="outline"
          className="px-6 text-2xs font-bold uppercase tracking-widest border-border/40 text-muted-foreground hover:bg-surface-highest hover:text-foreground"
          onClick={handleReset}
          disabled={isSaving}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-2" />
          Reset Engine
        </Button>
        <Button
          className="px-8 text-2xs font-bold uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/10 hover:bg-primary/90"
          onClick={() => toast.success("Configuration committed")}
          disabled={isSaving || settingsLoading}
        >
          <Save className="h-3.5 w-3.5 mr-2" />
          Commit Configuration
        </Button>
      </div>

      {/* ── Enable auto-buy confirmation dialog ──────────────────── */}
      <Dialog open={enableConfirmOpen} onOpenChange={setEnableConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-500">Enable Auto-Buy?</DialogTitle>
            <DialogDescription>
              Enabling auto-buy allows the system to automatically submit orders when a
              ticker passes all risk safeguards. Orders may be placed in your configured
              broker accounts.
              <br />
              <br />
              Auto-buy is subject to multiple independent risk checks and will only execute
              when all safeguards pass. However, no system can guarantee profitable
              outcomes. Past entry zone outcomes do not imply future results.
              <br />
              <br />
              Confirm that you understand the risks before proceeding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnableConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmEnable}>I understand — Enable Auto-Buy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Live mode confirmation dialog ────────────────────────── */}
      <Dialog
        open={liveConfirmOpen}
        onOpenChange={(open) => {
          setLiveConfirmOpen(open);
          if (!open) setLivePassword("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Switch to Live Mode?</DialogTitle>
            <DialogDescription>
              Live mode will submit real orders to your brokerage account using real money.
              Paper mode is recommended until you have validated the system with dry runs.
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
            <Button variant="outline" onClick={() => setLiveConfirmOpen(false)}>
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

// ─── Target Fields (Section 3 content) ────────────────────────────────────────

function TargetFields({
  settings,
  dryRunTicker,
  setDryRunTicker,
  isSaving,
  onUpdate,
  onDryRun,
  isDryRunning,
  dryRunResult,
}: {
  settings: AutoBuySettings;
  dryRunTicker: string;
  setDryRunTicker: (v: string) => void;
  isSaving: boolean;
  onUpdate: (partial: UpdateAutoBuySettingsRequest) => void;
  onDryRun: () => void;
  isDryRunning: boolean;
  dryRunResult: AutoBuyDryRunResult | null;
}) {
  const [maxAmount, setMaxAmount] = useState(String(settings.max_trade_amount));
  const [confidence, setConfidence] = useState(settings.confidence_threshold);

  function saveNumericFields() {
    onUpdate({
      max_trade_amount: parseFloat(maxAmount) || settings.max_trade_amount,
      confidence_threshold: confidence,
    });
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {/* Symbol search — maps to dry-run ticker */}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Symbol Search
        </label>
        <div className="relative">
          <Input
            data-testid="dry-run-ticker"
            value={dryRunTicker}
            onChange={(e) => setDryRunTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            className="bg-surface-lowest border-none text-xs placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary h-9 pr-8"
          />
          <button
            data-testid="dry-run-btn"
            onClick={onDryRun}
            disabled={isDryRunning || !dryRunTicker.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            title="Run dry run"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        </div>
        {isDryRunning && (
          <p className="text-3xs text-primary mt-1 animate-pulse">Running simulation...</p>
        )}
      </div>

      {/* Max order size */}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Max Order Size
        </label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            $
          </span>
          <Input
            type="number"
            min="10"
            step="50"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            onBlur={saveNumericFields}
            className="bg-surface-lowest border-none text-xs pl-6 tabular-nums focus-visible:ring-1 focus-visible:ring-primary h-9"
            placeholder="500"
          />
        </div>
      </div>

      {/* Min confidence — maps to confidence_threshold */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-2xs font-bold text-muted-foreground uppercase">
            Min Confidence Threshold
          </label>
          <span className="text-xs font-bold text-primary tabular-nums">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            onMouseUp={saveNumericFields}
            onTouchEnd={saveNumericFields}
            className="flex-1 accent-primary h-1 cursor-pointer"
          />
          <span className="text-2xs font-bold text-foreground tabular-nums min-w-[2.5rem] text-right">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="flex justify-between text-3xs text-muted-foreground mt-0.5">
          <span>30% lenient</span>
          <span>95% strict</span>
        </div>
      </div>
    </div>
  );
}

// ─── Execution Settings (Section 4 content) ───────────────────────────────────

function ExecutionSettings({
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
  const [drawdown, setDrawdown] = useState(Math.abs(settings.max_expected_drawdown));
  const [execTimeframe, setExecTimeframe] = useState(settings.execution_timeframe ?? "1d");
  const [startDate, setStartDate] = useState(settings.start_date ?? "");
  const [endDate, setEndDate] = useState(settings.end_date ?? "");
  const [targetBuy, setTargetBuy] = useState(settings.target_buy_price != null ? String(settings.target_buy_price) : "");
  const [targetSell, setTargetSell] = useState(settings.target_sell_price != null ? String(settings.target_sell_price) : "");

  function saveDrawdown() {
    onUpdate({ max_expected_drawdown: -Math.abs(drawdown) });
  }

  function saveTimeframeFields() {
    onUpdate({
      execution_timeframe: execTimeframe,
      start_date: startDate || null,
      end_date: endDate || null,
      target_buy_price: targetBuy ? parseFloat(targetBuy) : null,
      target_sell_price: targetSell ? parseFloat(targetSell) : null,
    });
  }

  return (
    <div className="space-y-4">
      {/* Execution timeframe select */}
      <div>
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Execution Timeframe
        </label>
        <Select
          value={execTimeframe}
          onValueChange={(v) => {
            setExecTimeframe(v);
            onUpdate({ execution_timeframe: v });
          }}
        >
          <SelectTrigger className="bg-surface-lowest border-none text-xs h-9 focus:ring-1 focus:ring-primary">
            <SelectValue placeholder="Select timeframe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1m">Every 1 minute</SelectItem>
            <SelectItem value="5m">Every 5 minutes</SelectItem>
            <SelectItem value="15m">Every 15 minutes</SelectItem>
            <SelectItem value="30m">Every 30 minutes</SelectItem>
            <SelectItem value="1h">Every 1 hour</SelectItem>
            <SelectItem value="4h">Every 4 hours</SelectItem>
            <SelectItem value="1d">Daily</SelectItem>
            <SelectItem value="1wk">Weekly</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-3xs text-muted-foreground mt-0.5">
          How often the engine re-evaluates and executes the strategy
        </p>
      </div>

      {/* Start / End date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={saveTimeframeFields}
            className="bg-surface-lowest border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> End Date
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={saveTimeframeFields}
            min={startDate || undefined}
            className="bg-surface-lowest border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>
      {startDate && endDate && startDate > endDate && (
        <p className="text-3xs text-destructive -mt-2">End date must be after start date</p>
      )}

      {/* Target buy / sell prices */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-400" /> Target Buy Price
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={targetBuy}
              onChange={(e) => setTargetBuy(e.target.value)}
              onBlur={saveTimeframeFields}
              placeholder="0.00"
              className="bg-surface-lowest border-none text-xs pl-6 tabular-nums h-9 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <p className="text-3xs text-muted-foreground mt-0.5">Buy when price reaches this level</p>
        </div>
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-red-400" /> Target Sell Price
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={targetSell}
              onChange={(e) => setTargetSell(e.target.value)}
              onBlur={saveTimeframeFields}
              placeholder="0.00"
              className="bg-surface-lowest border-none text-xs pl-6 tabular-nums h-9 focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
          <p className="text-3xs text-muted-foreground mt-0.5">Sell when price reaches this level</p>
        </div>
      </div>
      {targetBuy && targetSell && parseFloat(targetSell) <= parseFloat(targetBuy) && (
        <p className="text-3xs text-destructive -mt-2">Target sell price should be higher than buy price</p>
      )}

      <Separator className="bg-border/20" />

      {/* Max drawdown slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-2xs font-bold text-muted-foreground uppercase">
            Max Drawdown Limit
          </label>
          <span className="text-2xs font-bold text-destructive tabular-nums">
            -{Math.round(drawdown * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.03}
            max={0.30}
            step={0.01}
            value={drawdown}
            onChange={(e) => setDrawdown(parseFloat(e.target.value))}
            onMouseUp={saveDrawdown}
            onTouchEnd={saveDrawdown}
            className="flex-1 accent-primary h-1 cursor-pointer"
          />
          <span className="text-2xs font-bold text-foreground tabular-nums min-w-[2.5rem] text-right">
            -{Math.round(drawdown * 100)}%
          </span>
        </div>
        <div className="flex justify-between text-3xs text-muted-foreground mt-0.5">
          <span>3% tight</span>
          <span>30% loose</span>
        </div>
      </div>

      {/* Earnings blackout */}
      <div className="flex items-center justify-between p-3 bg-surface-lowest">
        <div>
          <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
            Earnings Blackout
          </p>
          <p className="text-3xs text-muted-foreground mt-0.5">
            Block if earnings within 5 days
          </p>
        </div>
        <Switch
          id="earnings-blackout"
          checked={!settings.allow_near_earnings}
          onCheckedChange={(checked) => onUpdate({ allow_near_earnings: !checked })}
          disabled={isSaving}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Allowed broker accounts */}
      {brokerCredentials.filter((c) => c.is_active).length > 0 && (
        <div className="space-y-2">
          <label className="text-2xs font-bold text-muted-foreground uppercase block">
            Allowed Accounts
          </label>
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
                      "flex items-center gap-2.5 border px-3 py-2 cursor-pointer text-xs transition-colors",
                      isAllowed
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/20 bg-surface-lowest hover:border-primary/20"
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
                    <span className="font-medium text-2xs">{cred.profile_name}</span>
                    <span className="ml-auto text-3xs text-muted-foreground uppercase">
                      {cred.provider}
                    </span>
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

function DryRunResultPanel({ result }: { result: AutoBuyDryRunResult }) {
  const cfg = STATE_CONFIG[result.decision_state] ?? STATE_CONFIG.candidate;
  const StateIcon = cfg.icon;

  const passed = (result.reason_codes ?? []).filter((code: any) => {
    if (typeof code === "string") return !code.startsWith("FAILED");
    return !String(code.result).startsWith("FAILED");
  }).length;
  const total = (result.reason_codes ?? []).length;

  return (
    <div className="bg-surface-lowest p-4 space-y-3 border border-border/10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn("text-xs gap-1.5 px-3 py-1", cfg.className)}
        >
          <StateIcon className="h-4 w-4" />
          {cfg.label}
        </Badge>
        <span className="font-mono text-sm font-semibold">{result.ticker}</span>
        <div className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <span className="text-2xs text-muted-foreground">
              {passed}/{total} checks passed
            </span>
          )}
          <Badge variant="secondary" className="text-2xs">
            Dry run
          </Badge>
        </div>
      </div>

      {/* Reason codes */}
      {total > 0 && (
        <div className="space-y-1.5">
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">
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
                    "text-2xs font-mono px-1.5 py-0.5 inline-flex items-center gap-1",
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
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">
            Signal snapshot
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-surface-mid p-2.5">
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
