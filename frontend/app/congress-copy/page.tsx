"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Bot,
  Activity,
  AlertTriangle,
  Loader2,
  Play,
  StopCircle,
  FlaskConical,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Landmark,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { congressCopyApi } from "@/lib/congress-copy-api";
import { formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type {
  PoliticianSummary,
  CongressCopySessionOut,
  CongressTradeOut,
  CongressCopiedOrderOut,
} from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: typeof Users; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">{title}</h3>
    </div>
  );
}

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
    default:
      return (
        <span className="px-2 py-0.5 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
          {status.toUpperCase()}
        </span>
      );
  }
}

// ─── Politician card ──────────────────────────────────────────────────────────

function PoliticianCard({
  politician,
  selected,
  onSelect,
}: {
  politician: PoliticianSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = [politician.party, politician.chamber, politician.state]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 border transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-surface-lowest hover:border-primary/40"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight truncate">
            {politician.name}
          </p>
          {meta && (
            <p className="text-3xs text-muted-foreground mt-0.5 truncate">{meta}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-black text-primary font-mono">
            {politician.trade_count_90d}
          </p>
          <p className="text-3xs text-muted-foreground">trades</p>
        </div>
      </div>
    </button>
  );
}

// ─── Trade row ────────────────────────────────────────────────────────────────

function TradeRow({ trade }: { trade: CongressTradeOut }) {
  const isBuy = trade.trade_type === "purchase";
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border/30 last:border-0">
      <div
        className={cn(
          "w-5 h-5 flex items-center justify-center shrink-0",
          isBuy ? "bg-green-500/15" : "bg-red-500/15"
        )}
      >
        {isBuy ? (
          <TrendingUp className="h-3 w-3 text-green-400" />
        ) : (
          <TrendingDown className="h-3 w-3 text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-foreground font-mono">{trade.ticker}</span>
          {trade.asset_type === "option" && trade.option_type && (
            <span
              className={cn(
                "text-3xs font-bold px-1 border",
                trade.option_type === "call"
                  ? "text-green-400 border-green-500/30 bg-green-500/10"
                  : "text-red-400 border-red-500/30 bg-red-500/10"
              )}
            >
              {trade.option_type.toUpperCase()}
            </span>
          )}
          {trade.size_range && (
            <span className="text-3xs text-muted-foreground">{trade.size_range}</span>
          )}
        </div>
        {trade.asset_name && (
          <p className="text-3xs text-muted-foreground mt-0.5 truncate">{trade.asset_name}</p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-3xs font-mono text-muted-foreground">
          {trade.trade_date ?? trade.reported_at ?? "—"}
        </p>
        <p className={cn("text-2xs font-bold", isBuy ? "text-green-400" : "text-red-400")}>
          {isBuy ? "BUY" : "SELL"}
        </p>
      </div>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onCancel,
  isCancelling,
}: {
  session: CongressCopySessionOut;
  onCancel: (id: number) => void;
  isCancelling: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: trades = [], isLoading: tradesLoading } = useQuery<CongressTradeOut[]>({
    queryKey: ["congress-copy", "trades", session.id],
    queryFn: () => congressCopyApi.listTrades(session.id),
    enabled: expanded,
    staleTime: 2 * 60 * 1000,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<CongressCopiedOrderOut[]>({
    queryKey: ["congress-copy", "orders", session.id],
    queryFn: () => congressCopyApi.listOrders(session.id),
    enabled: expanded,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="bg-surface-mid border border-border">
      <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-black text-foreground">{session.politician_name}</span>
            <StatusBadge status={session.status} />
            {session.dry_run && (
              <span className="px-2 py-0.5 text-2xs font-bold border bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                <FlaskConical className="h-2.5 w-2.5" />
                DRY RUN
              </span>
            )}
          </div>
          <p className="text-3xs text-muted-foreground mt-1">
            #{session.id} · Started {formatDateTime(session.created_at)}
          </p>
          {session.last_checked_at && (
            <p className="text-3xs text-muted-foreground">
              Last checked: {formatDateTime(session.last_checked_at)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="h-7 px-2 text-2xs text-muted-foreground"
          >
            <Activity className="h-3 w-3 mr-1" />
            {expanded ? "Hide" : "Trades"}
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
                  Stop
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <Separator className="bg-border/50" />
          <div className="max-h-64 overflow-y-auto">
            {tradesLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : trades.length === 0 ? (
              <p className="p-4 text-3xs text-muted-foreground text-center">
                No copied trades yet — monitor polls every 30 minutes.
              </p>
            ) : (
              trades.map((t) => <TradeRow key={t.id} trade={t} />)
            )}
          </div>
          {/* Orders summary */}
          {orders.length > 0 && (
            <div className="border-t border-border/30 bg-surface-lowest p-3">
              <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-2 font-bold">
                Copied Orders ({orders.length})
              </p>
              <div className="flex flex-col gap-1">
                {orders.slice(0, 5).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-3xs font-mono">
                    <span className={cn("font-bold", o.side === "buy" ? "text-green-400" : "text-red-400")}>
                      {o.side.toUpperCase()} {o.symbol}
                    </span>
                    <span className="text-muted-foreground">×{o.qty}</span>
                    <span
                      className={cn(
                        "px-1 border text-3xs",
                        o.status === "dry_run"
                          ? "text-primary border-primary/30 bg-primary/5"
                          : o.status === "error"
                          ? "text-red-400 border-red-500/30 bg-red-500/5"
                          : "text-green-400 border-green-500/30 bg-green-500/5"
                      )}
                    >
                      {o.status.toUpperCase().replace("_", " ")}
                    </span>
                  </div>
                ))}
                {orders.length > 5 && (
                  <p className="text-3xs text-muted-foreground">+{orders.length - 5} more</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CongressCopyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPolitician, setSelectedPolitician] = useState<PoliticianSummary | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveConfirmed, setLiveConfirmed] = useState(false);

  // SSR-safe instance ID
  const [instanceId, setInstanceId] = useState<string | null>(null);
  useEffect(() => {
    setInstanceId("CONGRESS_" + Math.floor(Math.random() * 9000 + 1000));
  }, []);

  const { data: politicians = [], isLoading: polsLoading } = useQuery<PoliticianSummary[]>({
    queryKey: ["congress-copy", "politicians"],
    queryFn: () => congressCopyApi.listPoliticians(20),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<CongressCopySessionOut[]>({
    queryKey: ["congress-copy", "sessions"],
    queryFn: () => congressCopyApi.listSessions(),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { mutate: startSession, isPending: isStarting } = useMutation({
    mutationFn: () =>
      congressCopyApi.setup({
        politician_id: selectedPolitician!.id,
        politician_name: selectedPolitician!.name,
        politician_party: selectedPolitician!.party,
        dry_run: dryRun,
      }),
    onSuccess: (s) => {
      toast.success(`Now copying ${s.politician_name}${s.dry_run ? " (dry run)" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["congress-copy", "sessions"] });
      setSelectedPolitician(null);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to start copy session"));
    },
  });

  const { mutate: cancelSession, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => congressCopyApi.cancelSession(id),
    onSuccess: () => {
      toast.success("Session stopped");
      queryClient.invalidateQueries({ queryKey: ["congress-copy", "sessions"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to stop session"));
    },
  });

  function handleStart() {
    if (!selectedPolitician) return;
    if (!dryRun) {
      setLiveConfirmOpen(true);
      return;
    }
    startSession();
  }

  function confirmLive() {
    if (!liveConfirmed) {
      toast.error("Check the confirmation box to proceed in live mode");
      return;
    }
    setLiveConfirmOpen(false);
    setLiveConfirmed(false);
    startSession();
  }

  const activeSessions = useMemo(
    () => sessions.filter((s) => s.status === "active"),
    [sessions]
  );

  return (
    <AppShell title="Congress Copy Bot">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Congress Copy Bot</h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            Instance:{" "}
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
            STATUS: {activeSessions.length > 0 ? "COPYING" : "STANDBY"}
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
        {/* ── Politician selector ──────────────────────────────────────── */}
        <section className="col-span-12 lg:col-span-5 bg-surface-mid p-4 flex flex-col gap-4">
          <SectionHeader icon={Users} title="Select Politician to Copy" />

          <div className="bg-destructive/5 border-l-4 border-destructive p-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-3xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground/70">Educational use only.</strong> Congress
                disclosures are delayed 30–45 days by law. Past performance doesn&apos;t guarantee
                future results. Test with Dry Run first.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
            {polsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : politicians.length === 0 ? (
              <p className="text-3xs text-muted-foreground text-center py-4">
                Could not load politicians — Capitol Trades may be unavailable.
              </p>
            ) : (
              politicians.map((p) => (
                <PoliticianCard
                  key={p.id}
                  politician={p}
                  selected={selectedPolitician?.id === p.id}
                  onSelect={() =>
                    setSelectedPolitician((prev) => (prev?.id === p.id ? null : p))
                  }
                />
              ))
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
            onClick={handleStart}
            disabled={!selectedPolitician || isStarting}
            className={cn(
              "w-full text-xs font-bold uppercase tracking-wider",
              !dryRun ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isStarting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Starting...
              </>
            ) : selectedPolitician ? (
              <>
                <Play className="h-3.5 w-3.5 mr-2" />
                Copy {selectedPolitician.name.split(" ").pop()}
                {!dryRun ? " (LIVE)" : ""}
              </>
            ) : (
              <>
                <Landmark className="h-3.5 w-3.5 mr-2" />
                Select a politician above
              </>
            )}
          </Button>
        </section>

        {/* ── Session list ─────────────────────────────────────────────── */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <div className="bg-surface-mid p-4 pb-3">
            <SectionHeader icon={Bot} title="Copy Sessions" />
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
              <span className="text-3xs text-muted-foreground uppercase tracking-wider">
                Polls Capitol Trades every 30 min · Auto-refreshes every 60s
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
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-surface-mid p-8 flex flex-col items-center gap-3 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                No Sessions Yet
              </p>
              <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
                Select a politician and click Copy to start mirroring their trades.
              </p>
            </div>
          ) : (
            sessions.map((s) => (
              <SessionCard
                key={s.id}
                session={s}
                onCancel={cancelSession}
                isCancelling={isCancelling}
              />
            ))
          )}
        </section>
      </div>

      {/* Live confirm dialog */}
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
              You are about to mirror{" "}
              <strong className="text-foreground">{selectedPolitician?.name}</strong>&apos;s trades
              in <strong className="text-destructive">LIVE mode</strong> on your Alpaca account. Disclosures can be 30–45 days delayed — you may be copying stale
              information.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div className="flex items-start gap-2 mt-2">
              <input
                id="live-confirm"
                type="checkbox"
                checked={liveConfirmed}
                onChange={(e) => setLiveConfirmed(e.target.checked)}
                className="mt-0.5 accent-destructive"
              />
              <label
                htmlFor="live-confirm"
                className="text-2xs text-muted-foreground leading-relaxed cursor-pointer"
              >
                I understand this will submit real orders and I accept full responsibility for
                any trades executed.
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
              onClick={confirmLive}
              disabled={!liveConfirmed || isStarting}
              className="text-xs font-bold uppercase"
            >
              {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start Live Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
