"use client";

/**
 * /trailing-bot — Trailing Stop Bot (Sovereign Terminal design)
 *
 * UX: dollar-based entry + auto floor% + ladder rules by drop% and dollar amount.
 */

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Play,
  Layers,
  Activity,
  StopCircle,
  DollarSign,
  Cpu,
  Percent,
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
import { trailingBotApi } from "@/lib/trailing-bot-api";
import { brokerApi } from "@/lib/api";
import {
  formatCurrency,
  formatDateTime,
  getErrorMessage,
  cn,
} from "@/lib/utils";
import type {
  TrailingBotSessionOut,
  TrailingBotSetupRequest,
  BrokerCredential,
} from "@/types";

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
    case "stopped_out":
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-red-500/15 text-red-400 border-red-500/30">
          STOPPED OUT
        </span>
      );
    case "cancelled":
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-muted/50 text-muted-foreground border-border">
          CANCELLED
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

// ─── Ladder row (drop% + dollar amount) ──────────────────────────────────────

interface LadderRowProps {
  index: number;
  dropPct: string;
  buyAmount: string;
  onDropPctChange: (val: string) => void;
  onBuyAmountChange: (val: string) => void;
}

function LadderRow({
  index,
  dropPct,
  buyAmount,
  onDropPctChange,
  onBuyAmountChange,
}: LadderRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-2xs font-black text-primary w-5 shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1">
        <Label className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 block">
          Drop %
        </Label>
        <div className="relative">
          <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            max="90"
            step="1"
            placeholder="20"
            value={dropPct}
            onChange={(e) => onDropPctChange(e.target.value)}
            className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-8 pl-7"
          />
        </div>
      </div>
      <div className="flex-1">
        <Label className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 block">
          Buy Amount
        </Label>
        <div className="relative">
          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="1000"
            value={buyAmount}
            onChange={(e) => onBuyAmountChange(e.target.value)}
            className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 text-xs h-8 pl-7"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: TrailingBotSessionOut;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}

function SessionCard({ session, onCancel, isCancelling }: SessionCardProps) {
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

      {/* Two-column detail grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Initial buy */}
        <div className="bg-surface-lowest p-2 col-span-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
            Initial Buy
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm font-black text-green-400 font-mono">
              {formatCurrency(session.buy_amount_usd)}
            </span>
            {session.entry_price !== null && (
              <>
                <span className="text-2xs text-muted-foreground">@</span>
                <span className="text-sm font-black text-foreground font-mono">
                  {formatCurrency(session.entry_price)}
                </span>
                <span className="text-2xs text-muted-foreground">
                  = {session.initial_qty.toFixed(4)} units
                </span>
              </>
            )}
          </div>
          {session.initial_order_id && (
            <p className="text-3xs text-muted-foreground font-mono mt-0.5 truncate">
              Order: {session.initial_order_id}
            </p>
          )}
        </div>

        {/* Floor / trailing */}
        <div className="bg-surface-lowest p-2 col-span-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
            Floor / Trailing Stop
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <p className="text-3xs text-muted-foreground">Hard Floor ({session.floor_pct}%)</p>
              <p className="text-xs font-black text-red-400 font-mono">
                {formatCurrency(session.floor_price)}
              </p>
            </div>
            {session.current_floor !== null && (
              <div>
                <p className="text-3xs text-muted-foreground">Current Floor</p>
                <p className="text-xs font-black text-amber-400 font-mono">
                  {formatCurrency(session.current_floor)}
                </p>
              </div>
            )}
            <div>
              <p className="text-3xs text-muted-foreground">Trail Active</p>
              <p
                className={cn(
                  "text-xs font-black font-mono",
                  session.trailing_active
                    ? "text-green-400"
                    : "text-muted-foreground"
                )}
              >
                {session.trailing_active ? "YES" : "NO"}
              </p>
            </div>
          </div>
        </div>

        {/* Trailing parameters */}
        <div className="bg-surface-lowest p-2 col-span-2 sm:col-span-4">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">
            Trail Parameters
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-3xs text-muted-foreground">Trigger</p>
              <p className="text-xs font-bold text-foreground font-mono">
                +{session.trailing_trigger_pct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-3xs text-muted-foreground">Trail</p>
              <p className="text-xs font-bold text-foreground font-mono">
                {session.trailing_trail_pct.toFixed(1)}% below
              </p>
            </div>
            <div>
              <p className="text-3xs text-muted-foreground">Step</p>
              <p className="text-xs font-bold text-foreground font-mono">
                every +{session.trailing_step_pct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Ladder rules */}
      {session.ladder_rules.length > 0 && (
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-2 font-bold flex items-center gap-1">
            <Layers className="h-2.5 w-2.5" />
            Ladder Rules ({session.ladder_rules.length})
          </p>
          <div className="flex flex-col gap-1">
            {session.ladder_rules.map((rule, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center justify-between px-2 py-1 border-l-2",
                  rule.filled
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border"
                )}
              >
                <span className="text-3xs font-black text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-2xs text-amber-400 font-bold font-mono">
                  -{rule.drop_pct > 0 ? rule.drop_pct.toFixed(0) : "?"}%
                </span>
                <span className="text-2xs font-mono text-foreground">
                  {formatCurrency(rule.price)}
                </span>
                <span className="text-2xs text-muted-foreground">
                  {rule.buy_amount_usd > 0 ? formatCurrency(rule.buy_amount_usd) : `${rule.qty.toFixed(4)} units`}
                </span>
                {rule.order_id && (
                  <span className="text-3xs font-mono text-muted-foreground truncate max-w-[80px]">
                    {rule.order_id}
                  </span>
                )}
                {rule.filled ? (
                  <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrailingBotPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Form state ───────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [floorPct, setFloorPct] = useState("10");
  const [credentialId, setCredentialId] = useState<string>("");
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  // Two ladder rows: drop % + dollar amount
  const [ladder, setLadder] = useState([
    { dropPct: "20", buyAmount: "1000" },
    { dropPct: "30", buyAmount: "2000" },
  ]);

  // SSR-safe instance ID
  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("BOT_UNIT_" + Math.floor(Math.random() * 90 + 10));
  }, []);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: brokerCredentials = [], isLoading: brokersLoading } = useQuery<
    BrokerCredential[]
  >({
    queryKey: ["broker", "credentials"],
    queryFn: brokerApi.list,
    enabled: !!user,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<
    TrailingBotSessionOut[]
  >({
    queryKey: ["trailing-bot", "sessions"],
    queryFn: trailingBotApi.list,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const { mutate: setupBot, isPending: isSubmitting } = useMutation({
    mutationFn: (payload: TrailingBotSetupRequest) =>
      trailingBotApi.setup(payload),
    onSuccess: (session) => {
      toast.success(
        `Trailing bot deployed for ${session.symbol}${session.dry_run ? " (dry run)" : ""}`
      );
      queryClient.invalidateQueries({ queryKey: ["trailing-bot", "sessions"] });
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to deploy trailing bot"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => trailingBotApi.cancel(id),
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["trailing-bot", "sessions"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to cancel session"));
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function resetForm() {
    setSymbol("");
    setBuyAmount("");
    setFloorPct("10");
    setCredentialId("");
    setDryRun(true);
    setLadder([
      { dropPct: "20", buyAmount: "1000" },
      { dropPct: "30", buyAmount: "2000" },
    ]);
  }

  function updateLadderDropPct(index: number, val: string) {
    setLadder((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], dropPct: val };
      return next;
    });
  }

  function updateLadderBuyAmount(index: number, val: string) {
    setLadder((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], buyAmount: val };
      return next;
    });
  }

  const isFormComplete = useMemo(() => {
    const sym = symbol.trim();
    const amount = parseFloat(buyAmount);
    const floor = parseFloat(floorPct);
    return (
      sym.length > 0 &&
      !isNaN(amount) && amount > 0 &&
      !isNaN(floor) && floor > 0 && floor <= 50 &&
      credentialId !== ""
    );
  }, [symbol, buyAmount, floorPct, credentialId]);

  // ── Submit handler ────────────────────────────────────────────────────────────
  function handleDeploy() {
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    submitDeploy();
  }

  function submitDeploy() {
    const validLadder = ladder
      .filter((row) => row.dropPct !== "" && row.buyAmount !== "")
      .map((row) => ({
        drop_pct: parseFloat(row.dropPct),
        buy_amount_usd: parseFloat(row.buyAmount),
      }))
      .filter(
        (row) =>
          !isNaN(row.drop_pct) && row.drop_pct > 0 &&
          !isNaN(row.buy_amount_usd) && row.buy_amount_usd > 0
      );

    const payload: TrailingBotSetupRequest = {
      credential_id: parseInt(credentialId, 10),
      symbol: symbol.trim().toUpperCase(),
      buy_amount_usd: parseFloat(buyAmount),
      floor_pct: parseFloat(floorPct),
      ladder_rules: validLadder,
      dry_run: dryRun,
    };
    setupBot(payload);
  }

  function confirmLiveDeploy() {
    if (!liveConfirmed) {
      toast.error("You must check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    submitDeploy();
  }

  // ── Derived display ───────────────────────────────────────────────────────────
  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );
  const engineStatus = activeSessions.length > 0 ? "RUNNING" : "STANDBY";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Trailing Bot">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Trailing Stop Bot
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
            MODE: {dryRun ? "TESTNET" : "MAINNET"}
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
          <SectionHeader icon={Bot} title="Deploy New Bot" />

          {/* Live execution warning */}
          <div className="bg-destructive/5 border-l-4 border-destructive p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-2xs font-bold text-destructive uppercase leading-tight">
                  Live Execution Warning
                </p>
                <p className="text-3xs text-muted-foreground leading-relaxed mt-1">
                  <strong className="text-foreground/70">New to this?</strong>{" "}
                  Keep <em>Dry Run ON</em> — the bot simulates order flow without
                  placing real trades.
                </p>
              </div>
            </div>
          </div>

          {/* Symbol + Buy Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Symbol
              </Label>
              <Input
                placeholder="AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="bg-surface-lowest border-border text-foreground placeholder:text-primary/40 font-mono uppercase"
              />
            </div>
            <div>
              <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Buy Amount
              </Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1000"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 pl-7 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Floor % — auto-calculated hint */}
          <div>
            <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Hard Floor — Stop Loss %
            </Label>
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="number"
                min="1"
                max="50"
                step="1"
                placeholder="10"
                value={floorPct}
                onChange={(e) => setFloorPct(e.target.value)}
                className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 pl-7 font-mono"
              />
            </div>
            <p className="text-3xs text-muted-foreground mt-1">
              Sell everything if price drops <strong className="text-foreground/70">{floorPct || "10"}%</strong> below your fill price. Stop-loss order placed automatically at fill.
            </p>
          </div>

          {/* Trailing rules info block */}
          <div className="bg-surface-lowest border border-border/50 p-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-primary" />
              Auto Trailing Rules
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-3xs text-muted-foreground">Trigger</p>
                <p className="text-xs font-bold text-green-400 font-mono">+10%</p>
              </div>
              <div>
                <p className="text-3xs text-muted-foreground">Trail</p>
                <p className="text-xs font-bold text-amber-400 font-mono">5% below</p>
              </div>
              <div>
                <p className="text-3xs text-muted-foreground">Step</p>
                <p className="text-xs font-bold text-foreground font-mono">every +5%</p>
              </div>
            </div>
            <p className="text-3xs text-muted-foreground mt-2 leading-relaxed">
              When price rises 10%, the floor advances to 5% below current price. It only moves up, never down.
            </p>
          </div>

          {/* Broker account */}
          <div>
            <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Broker Account
            </Label>
            {brokersLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={credentialId} onValueChange={setCredentialId}>
                <SelectTrigger className="bg-surface-lowest border-border text-foreground">
                  <SelectValue placeholder="Select broker account" />
                </SelectTrigger>
                <SelectContent>
                  {brokerCredentials.map((cred) => (
                    <SelectItem key={cred.id} value={String(cred.id)}>
                      {cred.profile_name} ({cred.provider})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!brokersLoading && brokerCredentials.length === 0 && (
              <p className="text-3xs text-destructive mt-1">
                No broker accounts found. Add one in Profile settings.
              </p>
            )}
          </div>

          {/* Ladder-in rules */}
          <div className="bg-surface-lowest p-3">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-3 w-3 text-primary" />
              <p className="text-2xs font-bold uppercase tracking-wider text-foreground">
                Ladder-In Rules (optional)
              </p>
            </div>
            <p className="text-3xs text-muted-foreground mb-3">
              Buy more at set drop levels. Price calculated automatically from your fill.
            </p>
            <div className="flex flex-col gap-3">
              {ladder.map((row, i) => (
                <LadderRow
                  key={i}
                  index={i}
                  dropPct={row.dropPct}
                  buyAmount={row.buyAmount}
                  onDropPctChange={(val) => updateLadderDropPct(i, val)}
                  onBuyAmountChange={(val) => updateLadderBuyAmount(i, val)}
                />
              ))}
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
                  ? "Simulating — no real orders placed"
                  : "LIVE — real broker orders will execute"}
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
                Deploy Bot{!dryRun ? " (LIVE)" : ""}
              </>
            )}
          </Button>
        </section>

        {/* ── Session history (7 cols) ─────────────────────────────── */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          <div className="bg-surface-mid p-4 pb-3">
            <SectionHeader icon={Activity} title="Bot Sessions" />
            <div className="flex items-center gap-2 mt-1">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span className="text-3xs text-muted-foreground uppercase tracking-wider">
                Auto-refreshes every 30s
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
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <TrendingDown className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Sessions Yet
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Deploy a trailing bot using the form on the left. Sessions appear
                here once deployed.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
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
              Live Mode — Real Orders
            </DialogTitle>
            <DialogDescription className="text-2xs text-muted-foreground leading-relaxed pt-1">
              You are about to deploy a trailing bot in{" "}
              <strong className="text-destructive">LIVE mode</strong>. Real market
              and stop orders will be placed through your broker.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="bg-surface-lowest p-3 border border-destructive/20 rounded-sm">
              <p className="text-2xs font-bold uppercase text-foreground mb-2">
                Confirm order parameters:
              </p>
              <div className="grid grid-cols-2 gap-y-1.5 text-2xs font-mono">
                <span className="text-muted-foreground">Symbol</span>
                <span className="text-foreground font-bold">
                  {symbol.trim().toUpperCase() || "—"}
                </span>
                <span className="text-muted-foreground">Buy Amount</span>
                <span className="text-green-400 font-bold">
                  {buyAmount ? formatCurrency(parseFloat(buyAmount)) : "—"}
                </span>
                <span className="text-muted-foreground">Floor Stop</span>
                <span className="text-destructive font-bold">
                  {floorPct || "10"}% below fill
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2 mt-4">
              <input
                id="live-confirm-checkbox"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="live-confirm-checkbox"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will submit real orders and I accept full
                responsibility for any trades executed.
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
