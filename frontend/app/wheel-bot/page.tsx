"use client";

/**
 * /wheel-bot — Wheel Strategy Bot (V7, Sovereign Terminal design)
 *
 * Automates the Wheel Strategy on TSLA (or any symbol) using a dedicated
 * Alpaca paper/live account. Stage machine: sell_put → assigned → sell_call → called_away.
 */

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  CheckCircle2,
  Loader2,
  Shield,
  Play,
  Activity,
  StopCircle,
  Cpu,
  TrendingUp,
  RotateCcw,
  FileText,
  CircleDot,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
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
import { wheelBotApi } from "@/lib/wheel-bot-api";
import { brokerApi } from "@/lib/api";
import { formatCurrency, formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type { BrokerCredential, WheelBotSessionResponse, WheelBotSummaryResponse } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER = ["sell_put", "assigned", "sell_call", "called_away"] as const;
type WheelStage = (typeof STAGE_ORDER)[number];

const STAGE_LABELS: Record<WheelStage, string> = {
  sell_put: "SELL PUT",
  assigned: "ASSIGNED",
  sell_call: "SELL CALL",
  called_away: "CALLED AWAY",
};

const STAGE_DESC: Record<WheelStage, string> = {
  sell_put: "Sell cash-secured put below market",
  assigned: "Put exercised — shares received",
  sell_call: "Sell covered call above cost basis",
  called_away: "Call exercised — shares sold, cycling",
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Shield;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active":
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-green-500/15 text-green-400 border-green-500/30">
          ACTIVE
        </span>
      );
    case "cancelled":
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-muted/50 text-muted-foreground border-border">
          CANCELLED
        </span>
      );
    case "completed":
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-primary/15 text-primary border-primary/30">
          COMPLETED
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
          {status.toUpperCase()}
        </span>
      );
  }
}

// ─── Stage machine visualization ─────────────────────────────────────────────

function StageMachine({ currentStage }: { currentStage: string }) {
  return (
    <div className="bg-surface-lowest p-3">
      <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-3 font-bold">
        Stage Machine
      </p>
      <div className="flex items-center gap-1 flex-wrap">
        {STAGE_ORDER.map((stage, i) => {
          const isActive = stage === currentStage;
          const isPast =
            STAGE_ORDER.indexOf(currentStage as WheelStage) > i;
          return (
            <div key={stage} className="flex items-center gap-1">
              <div
                className={cn(
                  "px-2 py-1 text-3xs font-bold border transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary border-primary/40"
                    : isPast
                    ? "bg-green-500/10 text-green-400/70 border-green-500/20"
                    : "bg-surface-mid text-muted-foreground border-border"
                )}
              >
                {isActive && (
                  <CircleDot className="inline h-2.5 w-2.5 mr-1 animate-pulse" />
                )}
                {STAGE_LABELS[stage]}
              </div>
              {i < STAGE_ORDER.length - 1 && (
                <span className="text-muted-foreground text-3xs">→</span>
              )}
            </div>
          );
        })}
        {/* Cycle back arrow */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground text-3xs">→</span>
          <div className="px-2 py-1 text-3xs font-bold border border-dashed border-primary/20 text-primary/40 flex items-center gap-1">
            <RotateCcw className="h-2 w-2" />
            CYCLE
          </div>
        </div>
      </div>
      {currentStage in STAGE_DESC && (
        <p className="text-3xs text-muted-foreground mt-2">
          Current:{" "}
          <span className="text-foreground/70">
            {STAGE_DESC[currentStage as WheelStage]}
          </span>
        </p>
      )}
    </div>
  );
}

// ─── Daily summary panel ──────────────────────────────────────────────────────

function DailySummaryPanel({
  sessionId,
  enabled,
}: {
  sessionId: number;
  enabled: boolean;
}) {
  const { data: summary, isLoading } = useQuery<WheelBotSummaryResponse>({
    queryKey: ["wheel-bot", "summary", sessionId],
    queryFn: () => wheelBotApi.getSummary(sessionId),
    enabled,
    staleTime: 5 * 60_000, // 5 min
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (!summary) return null;

  return (
    <div className="bg-surface-lowest p-3 mt-3">
      <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-2 font-bold flex items-center gap-1">
        <FileText className="h-2.5 w-2.5" />
        Daily Summary
      </p>
      {summary.summary ? (
        <pre className="text-3xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
          {summary.summary}
        </pre>
      ) : (
        <p className="text-3xs text-muted-foreground">
          No summary available yet.
        </p>
      )}
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: WheelBotSessionResponse;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}

function SessionCard({ session, onCancel, isCancelling }: SessionCardProps) {
  const [showSummary, setShowSummary] = useState(false);

  return (
    <div className="bg-surface-mid border border-border p-4 flex flex-col gap-3">
      {/* Card header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-base text-foreground">
            {session.symbol}
          </span>
          <StatusBadge status={session.status} />
          {session.dry_run && (
            <span className="px-2 py-0.5 text-2xs font-bold border bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
              <FlaskConical className="h-2.5 w-2.5" />
              DRY RUN
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-3xs text-muted-foreground font-mono">
            #{session.id} · {formatDateTime(session.created_at)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSummary((v) => !v)}
            className="h-7 px-2 text-2xs text-muted-foreground hover:text-foreground"
          >
            <FileText className="h-3 w-3 mr-1" />
            Summary
          </Button>
          {session.status === "active" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onCancel(session.id)}
              disabled={isCancelling}
              className="h-7 px-3 text-2xs font-bold uppercase"
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <StopCircle className="h-3 w-3 mr-1" />
                  Cancel
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator className="bg-border/50" />

      {/* Stage machine */}
      <StageMachine currentStage={session.stage} />

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total premium */}
        <div className="bg-surface-lowest p-2 col-span-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
            Total Premium Collected
          </p>
          <p className="text-sm font-black text-green-400 font-mono">
            {formatCurrency(session.total_premium_collected)}
          </p>
        </div>

        {/* Shares / cost basis */}
        <div className="bg-surface-lowest p-2 col-span-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
            Shares / Cost Basis
          </p>
          {session.shares_qty > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-black text-foreground font-mono">
                {session.shares_qty} shares
              </span>
              {session.cost_basis_per_share !== null && (
                <span className="text-2xs text-muted-foreground">
                  @ {formatCurrency(session.cost_basis_per_share)}/sh
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs font-bold text-muted-foreground font-mono">
              No shares held
            </p>
          )}
        </div>

        {/* Active contract */}
        {session.active_contract_symbol && (
          <div className="bg-surface-lowest p-2 col-span-2 sm:col-span-4">
            <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
              Active Contract
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-primary font-mono">
                {session.active_contract_symbol}
              </span>
              {session.active_strike !== null && (
                <div>
                  <p className="text-3xs text-muted-foreground">Strike</p>
                  <p className="text-xs font-bold text-foreground font-mono">
                    {formatCurrency(session.active_strike)}
                  </p>
                </div>
              )}
              {session.active_premium_received !== null && (
                <div>
                  <p className="text-3xs text-muted-foreground">Premium</p>
                  <p className="text-xs font-bold text-amber-400 font-mono">
                    {formatCurrency(session.active_premium_received)}
                  </p>
                </div>
              )}
              {session.active_expiry && (
                <div>
                  <p className="text-3xs text-muted-foreground">Expiry</p>
                  <p className="text-xs font-bold text-foreground font-mono">
                    {session.active_expiry}
                  </p>
                </div>
              )}
              {session.active_order_id && (
                <div>
                  <p className="text-3xs text-muted-foreground">Order ID</p>
                  <p className="text-3xs font-mono text-muted-foreground truncate max-w-[120px]">
                    {session.active_order_id}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last action */}
        {session.last_action && (
          <div className="bg-surface-lowest p-2 col-span-2 sm:col-span-4">
            <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
              Last Action
            </p>
            <p className="text-2xs text-muted-foreground leading-relaxed">
              {session.last_action}
            </p>
          </div>
        )}
      </div>

      {/* Daily summary (toggled) */}
      {showSummary && (
        <DailySummaryPanel
          sessionId={session.id}
          enabled={showSummary}
        />
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WheelBotPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("TSLA");
  const [credentialId, setCredentialId] = useState<string>("");
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  // SSR-safe instance ID
  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("WHEEL_" + Math.floor(Math.random() * 9000 + 1000));
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: brokerCredentials = [], isLoading: brokersLoading } = useQuery<BrokerCredential[]>({
    queryKey: ["broker", "credentials"],
    queryFn: brokerApi.list,
    enabled: !!user,
  });

  const alpacaCredentials = useMemo(
    () => brokerCredentials.filter((c) => c.provider === "alpaca" && c.is_active),
    [brokerCredentials]
  );

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<
    WheelBotSessionResponse[]
  >({
    queryKey: ["wheel-bot", "sessions"],
    queryFn: wheelBotApi.listSessions,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: setupBot, isPending: isSubmitting } = useMutation({
    mutationFn: () =>
      wheelBotApi.setup({
        symbol: symbol.trim().toUpperCase(),
        dry_run: dryRun,
        credential_id: credentialId ? parseInt(credentialId, 10) : null,
      }),
    onSuccess: (session) => {
      toast.success(
        `Wheel bot deployed for ${session.symbol}${session.dry_run ? " (dry run)" : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["wheel-bot", "sessions"] });
      setSymbol("TSLA");
      setCredentialId("");
      setDryRun(true);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to deploy wheel bot"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => wheelBotApi.cancelSession(id),
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["wheel-bot", "sessions"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to cancel session"));
    },
  });

  // ── Submit helpers ────────────────────────────────────────────────────────────
  function handleDeploy() {
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    setupBot();
  }

  function confirmLiveDeploy() {
    if (!liveConfirmed) {
      toast.error("You must check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    setupBot();
  }

  // ── Derived display ───────────────────────────────────────────────────────────
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );
  const engineStatus = activeSessions.length > 0 ? "RUNNING" : "STANDBY";
  const isFormComplete = useMemo(
    () => symbol.trim().length > 0 && credentialId !== "",
    [symbol, credentialId]
  );

  const selectedCredential = useMemo(
    () => alpacaCredentials.find((c) => c.id === parseInt(credentialId, 10)) ?? null,
    [alpacaCredentials, credentialId]
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Wheel Bot">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Wheel Strategy Bot
          </h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Engine Instance:{" "}
            {instanceId ?? (
              <span className="inline-block w-24 h-3 bg-surface-highest animate-pulse rounded-sm align-middle" />
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              activeSessions.length > 0
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : "bg-surface-highest text-primary border-primary/20"
            )}
          >
            STATUS: {engineStatus}
          </span>
          <span
            className={cn(
              "px-2 py-1 text-2xs font-bold border",
              dryRun
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )}
          >
            MODE: {dryRun ? "DRY RUN" : "LIVE"}
          </span>
          {activeSessions.length > 0 && (
            <span className="px-2 py-1 text-2xs font-bold border bg-green-500/10 text-green-400 border-green-500/20">
              {activeSessions.length} ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4">

        {/* ── Setup form (5 cols) ──────────────────────────────────── */}
        <section className="col-span-12 lg:col-span-5 bg-surface-mid p-4 flex flex-col gap-4">
          <SectionHeader icon={Bot} title="Deploy Wheel Bot" />

          {/* Strategy overview */}
          <div className="bg-surface-lowest border border-border/50 p-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-primary" />
              Wheel Strategy Rules
            </p>
            <div className="flex flex-col gap-1.5 text-3xs text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0">01</span>
                <span>Sell cash-secured put @ 90% of current price (14–28 day expiry)</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0">02</span>
                <span>If assigned: 100 shares acquired at strike price</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0">03</span>
                <span>Sell covered call @ 110% of cost basis</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0">04</span>
                <span>50% profit early close — buy back + reopen</span>
              </div>
              <div className="flex gap-2">
                <span className="text-primary font-bold shrink-0">05</span>
                <span>If called away: cycle repeats from sell_put</span>
              </div>
            </div>
          </div>

          {/* Live execution warning */}
          <div className="bg-destructive/5 border-l-4 border-destructive p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-2xs font-bold text-destructive uppercase leading-tight">
                  Options Risk Warning
                </p>
                <p className="text-3xs text-muted-foreground leading-relaxed mt-1">
                  <strong className="text-foreground/70">New to this?</strong>{" "}
                  Keep <em>Dry Run ON</em> — no real options contracts are placed.
                  Live mode requires a funded, options-enabled Alpaca account
                  saved in Profile &rarr; Credentials.
                </p>
              </div>
            </div>
          </div>

          {/* Broker account selector */}
          <div>
            <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Alpaca Account
            </Label>
            {brokersLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : alpacaCredentials.length === 0 ? (
              <div className="bg-surface-lowest border border-border/50 p-2.5 text-3xs text-muted-foreground">
                No Alpaca credentials saved.{" "}
                <a href="/profile" className="text-primary hover:underline">
                  Add them in Profile &rarr; Credentials.
                </a>
              </div>
            ) : (
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger className="bg-surface-lowest border-border text-foreground">
                  <SelectValue placeholder="Select Alpaca account…" />
                </SelectTrigger>
                <SelectContent className="bg-surface-mid border-border">
                  {alpacaCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={String(cred.id)}>
                      <span className="font-mono text-xs">{cred.profile_name}</span>
                      {cred.base_url?.includes("paper") && (
                        <span className="ml-2 text-3xs text-primary/70">[paper]</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-3xs text-muted-foreground mt-1">
              Uses the selected Alpaca account for options orders.
            </p>
          </div>

          {/* Symbol input */}
          <div>
            <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Symbol
            </Label>
            <Input
              placeholder="TSLA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-surface-lowest border-border text-foreground placeholder:text-primary/40 font-mono uppercase"
            />
            <p className="text-3xs text-muted-foreground mt-1">
              Default: TSLA. Any optionable equity supported.
            </p>
          </div>

          {/* Scheduler info */}
          <div className="bg-surface-lowest border border-border/50 p-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
              <Cpu className="h-3 w-3 text-primary" />
              Auto-Scheduler
            </p>
            <div className="grid grid-cols-2 gap-2 text-3xs">
              <div>
                <p className="text-muted-foreground">Monitor interval</p>
                <p className="text-foreground font-bold font-mono">Every 15 min</p>
              </div>
              <div>
                <p className="text-muted-foreground">Market hours only</p>
                <p className="text-green-400 font-bold font-mono">Yes</p>
              </div>
              <div>
                <p className="text-muted-foreground">Daily summary</p>
                <p className="text-foreground font-bold font-mono">16:05 ET</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account</p>
                <p className="text-foreground font-bold font-mono truncate">
                  {selectedCredential ? selectedCredential.profile_name : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Dry-run toggle */}
          <div className="flex items-center justify-between p-3 bg-surface-lowest">
            <div>
              <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
                Dry Run Mode
              </p>
              <p className="text-3xs text-muted-foreground mt-0.5">
                {dryRun
                  ? "Simulating — no real options orders placed"
                  : "LIVE — real options orders will execute"}
              </p>
            </div>
            <Switch
              checked={dryRun}
              onCheckedChange={setDryRun}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* Deploy button */}
          <Button
            onClick={handleDeploy}
            disabled={!isFormComplete || isSubmitting}
            className={cn(
              "w-full text-xs font-bold uppercase tracking-wider",
              !dryRun
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-2" />
                Deploy Wheel Bot{!dryRun ? " (LIVE)" : ""}
              </>
            )}
          </Button>
        </section>

        {/* ── Session panel (7 cols) ───────────────────────────────── */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-mid p-4 pb-3">
            <SectionHeader icon={Activity} title="Wheel Sessions" />
            <div className="flex items-center gap-2 mt-1">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span className="text-3xs text-muted-foreground uppercase tracking-wider">
                Auto-refreshes every 60s
              </span>
              {sessions.length > 0 && (
                <span className="ml-auto text-3xs font-bold text-primary">
                  {sessions.length} total · {activeSessions.length} active
                </span>
              )}
            </div>
          </div>

          {sessionsLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <RotateCcw className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Active Session
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Deploy the Wheel Strategy Bot using the form on the left. The bot
                will automatically cycle through sell_put → assigned → sell_call →
                called_away.
              </p>
              <div className="w-full max-w-sm mt-2">
                <StageMachine currentStage="" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Active sessions first */}
              {activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onCancel={cancelSession}
                  isCancelling={isCancelling}
                />
              ))}
              {/* Completed / cancelled sessions */}
              {sessions
                .filter((s) => s.status !== "active")
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onCancel={cancelSession}
                    isCancelling={isCancelling}
                  />
                ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Live mode confirmation dialog ─────────────────────────── */}
      <Dialog
        open={liveConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setLiveConfirmed(false);
          setLiveConfirmOpen(open);
        }}
      >
        <DialogContent className="bg-surface-mid border-destructive/40 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Live Mode — Real Options Orders
            </DialogTitle>
            <DialogDescription className="text-2xs text-muted-foreground leading-relaxed pt-1">
              You are about to deploy the Wheel Bot in{" "}
              <strong className="text-destructive">LIVE mode</strong>. Real options
              contracts will be sold through{" "}
              <strong className="text-primary">
                {selectedCredential?.profile_name ?? "your selected Alpaca account"}
              </strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="bg-surface-lowest p-3 border border-destructive/20 rounded-sm">
              <p className="text-2xs font-bold uppercase text-foreground mb-2">
                Order parameters:
              </p>
              <div className="grid grid-cols-2 gap-y-1.5 text-2xs font-mono">
                <span className="text-muted-foreground">Account</span>
                <span className="text-foreground font-bold">
                  {selectedCredential?.profile_name ?? "—"}
                </span>
                <span className="text-muted-foreground">Symbol</span>
                <span className="text-foreground font-bold">
                  {symbol.trim().toUpperCase() || "—"}
                </span>
                <span className="text-muted-foreground">First action</span>
                <span className="text-primary font-bold">Sell cash-secured put</span>
                <span className="text-muted-foreground">Strike target</span>
                <span className="text-foreground font-bold">90% of market price</span>
                <span className="text-muted-foreground">Expiry window</span>
                <span className="text-foreground font-bold">14–28 days</span>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-4">
              <input
                id="wheel-live-confirm"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="wheel-live-confirm"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will sell real options contracts, I have sufficient
                cash in my Alpaca account, and I accept full responsibility for any
                trades executed.
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLiveConfirmed(false);
                setLiveConfirmOpen(false);
              }}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmLiveDeploy}
              disabled={!liveConfirmed || isSubmitting}
              className="text-xs font-bold uppercase"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Deploy Live"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
