// frontend/app/copy-trading/page.tsx
"use client";

/**
 * /copy-trading — Politician Copy Trading
 *
 * Sovereign Terminal design matching /trailing-bot:
 * - Rankings panel: top 10 politicians by score (shared, 15-min refresh)
 * - Activate session form: amount, politician picker, dry-run toggle
 * - Active session card + copied trades table
 */

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bot,
  FlaskConical,
  Activity,
  TrendingUp,
  Loader2,
  Shield,
  Play,
  StopCircle,
  DollarSign,
  Users,
  BarChart2,
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
import { copyTradingApi } from "@/lib/copy-trading-api";
import { formatCurrency, formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type {
  CopiedTradeOut,
  CopyTradingSessionOut,
  CreateCopySessionRequest,
  PoliticianRankingOut,
} from "@/types";

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="px-2 py-0.5 text-2xs font-bold border bg-green-500/15 text-green-400 border-green-500/30">
        ACTIVE
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="px-2 py-0.5 text-2xs font-bold border bg-muted/50 text-muted-foreground border-border">
        CANCELLED
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
      {status.toUpperCase()}
    </span>
  );
}

// ─── Trade status badge ────────────────────────────────────────────────────────

function TradeStatusBadge({ alpacaStatus }: { alpacaStatus: string }) {
  const isOk = ["accepted", "filled", "simulated", "dry_run"].some((s) =>
    alpacaStatus.includes(s)
  );
  const isSkip = alpacaStatus.startsWith("skipped") || alpacaStatus === "pre_existing";
  const isErr = alpacaStatus.startsWith("error") || alpacaStatus.startsWith("rejected");

  const cls = isOk
    ? "bg-green-500/15 text-green-400 border-green-500/30"
    : isSkip
    ? "bg-muted/50 text-muted-foreground border-border"
    : isErr
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-surface-highest text-muted-foreground border-border";

  return (
    <span className={cn("px-1.5 py-0.5 text-3xs font-bold border font-mono", cls)}>
      {alpacaStatus.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

// ─── Rankings table ────────────────────────────────────────────────────────────

function RankingsTable({
  rankings,
  activeSession,
}: {
  rankings: PoliticianRankingOut[];
  activeSession: CopyTradingSessionOut | undefined;
}) {
  if (rankings.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-2xs text-muted-foreground uppercase tracking-wider">
          No rankings available — insufficient disclosure data
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      <div className="grid grid-cols-12 gap-1 px-2 py-1 border-b border-border">
        <span className="col-span-1 text-3xs text-muted-foreground uppercase tracking-wider">#</span>
        <span className="col-span-5 text-3xs text-muted-foreground uppercase tracking-wider">Politician</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">Win%</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">vs SPY%</span>
        <span className="col-span-2 text-3xs text-muted-foreground uppercase tracking-wider text-right">Score</span>
      </div>
      {rankings.map((r, i) => {
        const isFollowed =
          activeSession?.target_politician_id === r.politician_id ||
          (activeSession && !activeSession.target_politician_id && i === 0);
        return (
          <div
            key={r.politician_id}
            className={cn(
              "grid grid-cols-12 gap-1 px-2 py-2 border-b border-border/50 hover:bg-surface-high/30 transition-colors",
              isFollowed && "bg-primary/5 border-l-2 border-l-primary"
            )}
          >
            <span className="col-span-1 text-2xs font-black text-primary">{i + 1}</span>
            <div className="col-span-5 min-w-0">
              <p className="text-2xs font-bold text-foreground truncate">{r.politician_name}</p>
              {r.best_trades.length > 0 && (
                <p className="text-3xs text-muted-foreground truncate">{r.best_trades[0]}</p>
              )}
            </div>
            <span className="col-span-2 text-2xs font-mono text-right text-foreground">
              {r.win_rate.toFixed(0)}%
            </span>
            <span
              className={cn(
                "col-span-2 text-2xs font-mono text-right font-bold",
                r.avg_excess_return > 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {r.avg_excess_return > 0 ? "+" : ""}{r.avg_excess_return.toFixed(1)}%
            </span>
            <span className="col-span-2 text-2xs font-mono text-right text-primary font-bold">
              {r.score.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Session card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  tradeCount,
  onCancel,
  isCancelling,
}: {
  session: CopyTradingSessionOut;
  tradeCount: number;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  const followingName = session.target_politician_name || "Auto (best performer)";
  return (
    <div className="bg-surface-mid border border-border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-black text-sm text-foreground">
            {followingName}
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
            #{session.id} · {formatDateTime(session.activated_at)}
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

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Copy Amount</p>
          <p className="text-sm font-black text-foreground font-mono">
            {formatCurrency(session.copy_amount_usd)}
          </p>
          <p className="text-3xs text-muted-foreground">per trade</p>
        </div>
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Politician</p>
          <p className="text-xs font-bold text-foreground truncate">
            {session.target_politician_id ? session.target_politician_id : "Auto-ranked"}
          </p>
        </div>
        <div className="bg-surface-lowest p-2">
          <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-1 font-bold">Copied</p>
          <p className="text-sm font-black text-primary font-mono">{tradeCount}</p>
          <p className="text-3xs text-muted-foreground">trades</p>
        </div>
      </div>
    </div>
  );
}

// ─── Copied trades table ───────────────────────────────────────────────────────

function CopiedTradesTable({ trades }: { trades: CopiedTradeOut[] }) {
  if (trades.length === 0) {
    return (
      <div className="bg-surface-mid p-6 flex flex-col items-center gap-2 text-center">
        <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
        <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
          No trades copied yet
        </p>
        <p className="text-3xs text-muted-foreground">
          The scheduler checks for new disclosures every 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-mid overflow-hidden">
      <div className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-border bg-surface-highest">
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Disclosed</span>
        <span className="col-span-3 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Politician</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Ticker</span>
        <span className="col-span-1 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Type</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground text-right">Amount</span>
        <span className="col-span-2 text-3xs font-bold uppercase tracking-wider text-muted-foreground">Status</span>
      </div>
      {trades.map((t) => (
        <div
          key={t.id}
          className="grid grid-cols-12 gap-1 px-3 py-2 border-b border-border/30 hover:bg-surface-high/20 transition-colors"
        >
          <span className="col-span-2 text-3xs font-mono text-muted-foreground">
            {t.disclosure_date || "—"}
          </span>
          <span className="col-span-3 text-2xs text-foreground truncate">{t.politician_name}</span>
          <span className="col-span-2 text-2xs font-mono font-bold text-foreground">{t.ticker}</span>
          <span
            className={cn(
              "col-span-1 text-2xs font-bold",
              t.trade_type === "buy" ? "text-green-400" : "text-red-400"
            )}
          >
            {t.trade_type.toUpperCase()}
          </span>
          <span className="col-span-2 text-2xs font-mono text-right text-foreground">
            {t.copy_amount_usd ? formatCurrency(t.copy_amount_usd) : "—"}
          </span>
          <div className="col-span-2 flex items-center gap-1 flex-wrap">
            <TradeStatusBadge alpacaStatus={t.alpaca_status} />
            {t.dry_run && (
              <span className="text-3xs text-primary font-bold">DR</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CopyTradingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [copyAmount, setCopyAmount] = useState("300");
  const [selectedPolitician, setSelectedPolitician] = useState<string>("auto");
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  // SSR-safe instance ID
  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("CT_UNIT_" + Math.floor(Math.random() * 90 + 10));
  }, []);

  const { data: rankings = [], isLoading: rankingsLoading } = useQuery<PoliticianRankingOut[]>({
    queryKey: ["copy-trading", "rankings"],
    queryFn: copyTradingApi.getRankings,
    enabled: !!user,
    refetchInterval: 15 * 60 * 1000,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<CopyTradingSessionOut[]>({
    queryKey: ["copy-trading", "sessions"],
    queryFn: copyTradingApi.listSessions,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: allTrades = [], isLoading: tradesLoading } = useQuery<CopiedTradeOut[]>({
    queryKey: ["copy-trading", "trades"],
    queryFn: copyTradingApi.getAllTrades,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { mutate: createSession, isPending: isCreating } = useMutation({
    mutationFn: (payload: CreateCopySessionRequest) => copyTradingApi.createSession(payload),
    onSuccess: () => {
      toast.success("Copy-trading session activated");
      queryClient.invalidateQueries({ queryKey: ["copy-trading"] });
      resetForm();
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to activate session"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => copyTradingApi.cancelSession(id),
    onSuccess: () => {
      toast.success("Session cancelled");
      queryClient.invalidateQueries({ queryKey: ["copy-trading"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to cancel session"));
    },
  });

  function resetForm() {
    setCopyAmount("300");
    setSelectedPolitician("auto");
    setDryRun(true);
  }

  const isFormValid = useMemo(() => {
    const amount = parseFloat(copyAmount);
    return !isNaN(amount) && amount > 0;
  }, [copyAmount]);

  function handleActivate() {
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    submitActivate();
  }

  function submitActivate() {
    const payload: CreateCopySessionRequest = {
      copy_amount_usd: parseFloat(copyAmount),
      dry_run: dryRun,
      target_politician_id: selectedPolitician === "auto" ? null : selectedPolitician,
    };
    createSession(payload);
  }

  function confirmLiveActivate() {
    if (!liveConfirmed) {
      toast.error("Check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    submitActivate();
  }

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "active"),
    [sessions]
  );

  const sessionTradeCount = useMemo(() => {
    if (!activeSession) return 0;
    return allTrades.filter(
      (t) => t.session_id === activeSession.id && t.alpaca_status !== "pre_existing"
    ).length;
  }, [allTrades, activeSession]);

  const engineStatus = activeSession ? "RUNNING" : "STANDBY";

  return (
    <AppShell title="Copy Trading">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Politician Copy Trading
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
              activeSession
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
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── Left: Rankings + Setup form ─────────────────────────── */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <section className="bg-surface-mid p-4">
            <SectionHeader icon={BarChart2} title="Politician Rankings" />
            <p className="text-3xs text-muted-foreground mb-3 leading-relaxed">
              Ranked by historically favorable performance vs SPY. Past results do not guarantee future returns.
            </p>
            {rankingsLoading ? (
              <div className="flex flex-col gap-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : (
              <RankingsTable rankings={rankings} activeSession={activeSession} />
            )}
          </section>

          {!activeSession && (
            <section className="bg-surface-mid p-4 flex flex-col gap-4">
              <SectionHeader icon={Bot} title="Activate Copy Trading" />

              <div className="bg-destructive/5 border-l-4 border-destructive p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-3xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground/70">Disclosure delay:</strong>{" "}
                    STOCK Act allows 45-day filing delay. You may be copying trades already priced in.
                    Start with dry-run mode. Past performance of any politician is not indicative of future results.
                  </p>
                </div>
              </div>

              <div>
                <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Copy Amount (USD per trade)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="300"
                    value={copyAmount}
                    onChange={(e) => setCopyAmount(e.target.value)}
                    className="bg-surface-lowest border-border text-foreground placeholder:text-muted-foreground/60 pl-7 font-mono"
                  />
                </div>
              </div>

              <div>
                <Label className="text-2xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  Politician to Follow
                </Label>
                {rankingsLoading ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={selectedPolitician} onValueChange={setSelectedPolitician}>
                    <SelectTrigger className="bg-surface-lowest border-border text-foreground">
                      <SelectValue placeholder="Select politician" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        Auto — Best performer (re-ranked daily)
                      </SelectItem>
                      {rankings.map((r) => (
                        <SelectItem key={r.politician_id} value={r.politician_id}>
                          {r.politician_name} — {r.win_rate.toFixed(0)}% win · +{r.avg_excess_return.toFixed(1)}% vs SPY
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

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

              <Button
                onClick={handleActivate}
                disabled={!isFormValid || isCreating}
                className={cn(
                  "w-full text-xs font-bold uppercase tracking-wider",
                  !dryRun
                    ? "bg-destructive hover:bg-destructive/90"
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                    Activating...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 mr-2" />
                    Activate{!dryRun ? " (LIVE)" : ""}
                  </>
                )}
              </Button>
            </section>
          )}
        </div>

        {/* ── Right: Active session + trade history ───────────────── */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">
          {sessionsLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : activeSession ? (
            <section className="bg-surface-mid p-4">
              <SectionHeader icon={Activity} title="Active Session" />
              <SessionCard
                session={activeSession}
                tradeCount={sessionTradeCount}
                onCancel={cancelSession}
                isCancelling={isCancelling}
              />
            </section>
          ) : (
            <section className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Active Session
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Activate a session using the form on the left. The scheduler will poll for
                new congressional disclosures every 15 minutes.
              </p>
            </section>
          )}

          <section className="bg-surface-mid p-4">
            <div className="flex items-center justify-between mb-3">
              <SectionHeader icon={TrendingUp} title="Copied Trades" />
              {allTrades.length > 0 && (
                <span className="text-3xs font-bold text-primary">
                  {allTrades.length} total
                </span>
              )}
            </div>
            {tradesLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <CopiedTradesTable trades={allTrades} />
            )}
          </section>

          {sessions.filter((s) => s.status !== "active").length > 0 && (
            <section className="bg-surface-mid p-4">
              <SectionHeader icon={Activity} title="Session History" />
              <div className="flex flex-col gap-2">
                {sessions
                  .filter((s) => s.status !== "active")
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between px-3 py-2 border border-border bg-surface-low"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusBadge status={s.status} />
                        <span className="text-2xs text-foreground truncate">
                          {s.target_politician_name || "Auto-ranked"}
                        </span>
                      </div>
                      <span className="text-3xs text-muted-foreground font-mono whitespace-nowrap ml-2">
                        #{s.id} · {formatDateTime(s.activated_at)}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Live confirmation dialog */}
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
              You are about to activate copy trading in{" "}
              <strong className="text-destructive">LIVE mode</strong>. The scheduler will
              place real market orders through your broker whenever a new congressional
              disclosure appears. STOCK Act filings can be up to 45 days old — you may
              be copying trades that are already fully priced in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="bg-surface-lowest p-3 border border-destructive/20 rounded-sm">
              <p className="text-2xs font-bold uppercase text-foreground mb-2">Order parameters:</p>
              <div className="grid grid-cols-2 gap-y-1.5 text-2xs font-mono">
                <span className="text-muted-foreground">Copy amount</span>
                <span className="text-foreground font-bold">
                  {formatCurrency(parseFloat(copyAmount) || 0)} / trade
                </span>
                <span className="text-muted-foreground">Politician</span>
                <span className="text-foreground font-bold truncate">
                  {selectedPolitician === "auto"
                    ? "Auto-ranked"
                    : rankings.find((r) => r.politician_id === selectedPolitician)
                        ?.politician_name ?? selectedPolitician}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-2 mt-4">
              <input
                id="live-ct-confirm"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="live-ct-confirm"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will place real market orders and accept full
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
              onClick={confirmLiveActivate}
              disabled={!liveConfirmed || isCreating}
              className="text-xs font-bold uppercase"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Activate Live"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
