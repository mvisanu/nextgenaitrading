"use client";
import { DryRunResultPanel } from "@/components/automation/DryRunResultPanel";
import { ExecutionSettings } from "@/components/automation/ExecutionSettings";
import { SectionHeader, STATE_CONFIG, tagColor } from "@/components/automation/shared";
import { TargetFields } from "@/components/automation/TargetFields";
import { useAutoBuySettings } from "@/components/automation/useAutoBuySettings";
import { tradingKeys } from "@/lib/trading-queries";

/** Auto-buy controls, saved settings, and the execution decision log. */

import { useAuth } from "@/components/layout/AppShell";
import { WorkspaceSection as AppShell } from "@/components/layout/WorkspaceSection";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  cn
} from "@/lib/utils";
import type {
  AutoBuyDryRunResult, AutoBuySettings
} from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Cpu, ListChecks, RotateCcw, Shield, Target, Timer
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Decision state badge config ──────────────────────────────────────────────

const DEFAULT_SETTINGS: AutoBuySettings = {
  id: 0,
  user_id: 0,
  enabled: false,
  paper_mode: true,
  confidence_threshold: 0.65,
  max_trade_amount: 500,
  max_position_percent: 0.05,
  max_expected_drawdown: -0.05,
  allow_near_earnings: false,
  allowed_account_ids_json: [],
  execution_timeframe: "1h",
  start_date: null,
  end_date: null,
  target_buy_price: null,
  target_sell_price: null,
  created_at: "",
  updated_at: "",
};

// ─── Section header ────────────────────────────────────────────────────────────

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
  const logEndRef = useRef<HTMLDivElement>(null);

  const { settings, settingsLoading, settingsError, decisionLog, logLoading, brokerCredentials, updateSettings, isSaving, runDryRun, isDryRunning } = useAutoBuySettings(dryRunTicker, setDryRunResult);

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
  }

  function handleReset() {
    updateSettings({
      enabled: false,
      paper_mode: true,
    });
    setDryRunResult(null);
    toast.info("Requested paper mode with automation disabled");
  }

  const engineStatus = settings?.enabled ? "ACTIVE" : "CONFIGURED";
  const engineMode = settings?.paper_mode !== false ? "BROKER PAPER" : "LIVE";

  if (settingsError) return <AppShell title="Auto-Buy"><div role="alert" className="p-4 space-y-3"><p>Automation settings could not be loaded. Retry before making changes.</p><Button onClick={() => queryClient.invalidateQueries({ queryKey: tradingKeys.settings(user?.id) })}>Retry</Button></div></AppShell>;

  return (
    <AppShell title="Auto-Buy">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Auto-Buy Configuration
          </h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Stock entry automation
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
              engineMode === "LIVE"
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
                  <strong className="text-foreground/70">New to this?</strong> Keep <em>Dry Run Mode ON</em> — the engine will show you what it would buy without using real money. Only turn it off when you&apos;re comfortable and have tested it.
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
          <SectionHeader icon={Cpu} title="How entries are selected" />
          <p className="text-sm text-muted-foreground leading-relaxed">Auto-buy uses saved buy-zone signals and the confidence, drawdown, earnings, order-size and duplicate-order checks below. Review a symbol with a dry run to see the checks behind a decision.</p>
          <p className="mt-3 text-sm text-muted-foreground">Spread checks are not available in this engine; the displayed liquidity check is a minimum-price filter.</p>
          <a href="/strategies" className="inline-block mt-3 text-sm text-primary underline">Research and test strategy techniques</a>
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
          ) : (
            <TargetFields
              settings={settings ?? DEFAULT_SETTINGS}
              dryRunTicker={dryRunTicker}
              setDryRunTicker={setDryRunTicker}
              isSaving={isSaving}
              onUpdate={(partial) => updateSettings(partial)}
              onDryRun={() => runDryRun()}
              isDryRunning={isDryRunning}
              dryRunResult={dryRunResult}
            />
          )}
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
          ) : (
            <ExecutionSettings
              settings={settings ?? DEFAULT_SETTINGS}
              brokerCredentials={brokerCredentials}
              isSaving={isSaving}
              onUpdate={(partial) => updateSettings(partial)}
            />
          )}
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
                    queryKey: tradingKeys.decisions(user?.id),
                  })
                }
                className="text-3xs font-bold uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Refresh log
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
          Disable and use paper mode
        </Button>
        <p className="text-sm text-muted-foreground">{isSaving ? "Saving settings..." : "Changes save when you finish editing each field."}</p>
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
