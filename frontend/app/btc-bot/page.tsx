"use client";

/**
 * /btc-bot — BTC Trailing-Stop Bot dashboard
 *
 * Three sections:
 *  1. Active session card (entry, blended, floor, qty, P&L) — or
 *     Cooldown card (re-entry countdown + cancel button)
 *  2. Action history (paginated, filterable)
 *  3. Footer linking to /crons for scheduler management
 */

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Bitcoin,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { btcBotApi } from "@/lib/btc-bot-api";
import type { BtcBotAction, BtcBotSession } from "@/lib/btc-bot-api";

function formatDecimal(v: string | null, decimals = 2): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatDateTime(iso: string | null): string {
  if (iso == null) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatCountdown(iso: string | null): string {
  if (iso == null) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const m = Math.floor(ms / 60_000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const colorClass =
    tone === "positive" ? "text-green-400" :
    tone === "warning"  ? "text-yellow-400" :
                          "text-foreground";
  return (
    <div>
      <p className="text-3xs uppercase tracking-wider text-muted-foreground/70 font-bold mb-0.5">
        {label}
      </p>
      <p className={`text-sm font-mono ${colorClass}`}>{value}</p>
    </div>
  );
}

function ActiveSessionCard({ session, onClose }: { session: BtcBotSession; onClose: () => void }) {
  return (
    <section className="bg-surface-mid border border-border p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
            Active Session #{session.id}
          </h3>
        </div>
        <span className="text-3xs text-muted-foreground font-mono">
          Started {formatDateTime(session.created_at)}
        </span>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
        <Stat label="Original entry" value={`$${formatDecimal(session.original_entry_price)}`} />
        <Stat label="Blended entry" value={`$${formatDecimal(session.blended_entry_price)}`} />
        <Stat label="Total qty" value={`${formatDecimal(session.total_qty, 8)} BTC`} />
        <Stat
          label="Current floor"
          value={`$${formatDecimal(session.current_floor)}`}
          tone="warning"
        />
        <Stat
          label="Trailing"
          value={session.trailing_active ? "ON" : "OFF"}
          tone={session.trailing_active ? "positive" : "neutral"}
        />
        <Stat label="Ladders fired" value={`${session.ladder_next} / 3`} />
      </div>

      <Button variant="outline" size="sm" onClick={onClose} className="text-2xs uppercase tracking-wider">
        <XCircle className="h-3.5 w-3.5 mr-1.5" />
        Force close
      </Button>
    </section>
  );
}

function CooldownCard({ session, onCancel }: { session: BtcBotSession; onCancel: () => void }) {
  return (
    <section className="bg-surface-mid border border-yellow-500/30 p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-yellow-400" />
          <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-yellow-400">
            Cooldown #{session.id}
          </h3>
        </div>
        <span className="text-3xs text-muted-foreground font-mono">
          Re-entry in {formatCountdown(session.cooldown_until)}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <Stat label="Realized PnL" value={`$${formatDecimal(session.realized_pnl)}`} tone={
          session.realized_pnl && Number(session.realized_pnl) >= 0 ? "positive" : "warning"
        } />
        <Stat label="Cooldown ends" value={formatDateTime(session.cooldown_until)} />
      </div>

      <Button variant="outline" size="sm" onClick={onCancel} className="text-2xs uppercase tracking-wider">
        <XCircle className="h-3.5 w-3.5 mr-1.5" />
        Cancel cooldown
      </Button>
    </section>
  );
}

function NoSessionCard() {
  return (
    <section className="bg-surface-mid border border-border p-8 text-center">
      <Bitcoin className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
        No Active Session
      </p>
      <p className="text-3xs text-muted-foreground mt-2 max-w-md mx-auto">
        The cron will auto-open a new session on its next tick if credentials are configured.
        Manage cadence at <Link href="/crons" className="text-primary underline">/crons</Link>.
      </p>
    </section>
  );
}

const ACTION_COLOURS: Record<string, string> = {
  initial_buy:        "text-green-400",
  ladder_l1:          "text-green-400",
  ladder_l2:          "text-green-400",
  ladder_l3:          "text-green-400",
  trailing_activate:  "text-blue-400",
  trailing_advance:   "text-blue-400",
  stop_out:           "text-red-400",
  cooldown_start:     "text-yellow-400",
  cooldown_exit:      "text-yellow-400",
  adopted_position:   "text-purple-400",
  manual_close:       "text-orange-400",
  error:              "text-red-500",
};

function ActionHistory({ actions, loading }: { actions: BtcBotAction[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
      </div>
    );
  }
  if (actions.length === 0) {
    return (
      <p className="text-3xs text-muted-foreground py-8 text-center">No actions recorded yet.</p>
    );
  }
  return (
    <div className="text-xs">
      <div className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/30 bg-surface-lowest text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
        <div className="col-span-3">Time</div>
        <div className="col-span-1">#</div>
        <div className="col-span-3">Action</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Qty Δ</div>
        <div className="col-span-1 text-right">Order</div>
      </div>
      {actions.map((a) => (
        <div key={a.id} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-border/20 hover:bg-surface-high/30">
          <div className="col-span-3 font-mono text-3xs text-muted-foreground">{formatDateTime(a.created_at)}</div>
          <div className="col-span-1 font-mono text-3xs text-muted-foreground">#{a.session_id}</div>
          <div className={`col-span-3 text-2xs font-bold ${ACTION_COLOURS[a.action] ?? "text-foreground"}`}>
            {a.action.replaceAll("_", " ")}
          </div>
          <div className="col-span-2 text-right font-mono">{a.btc_price ? `$${formatDecimal(a.btc_price)}` : "—"}</div>
          <div className="col-span-2 text-right font-mono">{a.qty_delta ?? "—"}</div>
          <div className="col-span-1 text-right font-mono text-3xs text-muted-foreground truncate">
            {a.alpaca_order_id?.slice(0, 8) ?? "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BtcBotPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);

  const { data: session, isPending: sessionPending, refetch } = useQuery({
    queryKey: ["btc-bot", "session"],
    queryFn: () => btcBotApi.getCurrentSession(),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: actions = [], isPending: actionsPending } = useQuery({
    queryKey: ["btc-bot", "actions", actionFilter],
    queryFn: () => btcBotApi.listActions({ action: actionFilter, limit: 100 }),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["btc-bot"] });
  }

  const closeMut = useMutation({
    mutationFn: (id: number) => btcBotApi.closeSession(id),
    onSuccess: () => { toast.success("Session closed"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelCooldownMut = useMutation({
    mutationFn: (id: number) => btcBotApi.cancelCooldown(id),
    onSuccess: () => { toast.success("Cooldown cancelled"); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="BTC Bot">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">BTC Trailing-Stop Bot</h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            FLOOR · Trailing · 3-Level Ladder
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refetch()} className="h-8 px-3 text-2xs font-bold uppercase">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {sessionPending ? (
        <Skeleton className="h-48 w-full mb-6" />
      ) : session === null || session === undefined ? (
        <div className="mb-6"><NoSessionCard /></div>
      ) : session.status === "active" ? (
        <div className="mb-6">
          <ActiveSessionCard session={session} onClose={() => closeMut.mutate(session.id)} />
        </div>
      ) : session.status === "cooldown" ? (
        <div className="mb-6">
          <CooldownCard session={session} onCancel={() => cancelCooldownMut.mutate(session.id)} />
        </div>
      ) : (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/5 text-red-400 text-xs">
          Session #{session.id} is in <strong>{session.status}</strong> state.
        </div>
      )}

      <section className="bg-surface-mid border border-border">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">Action History</h3>
          </div>
          <select
            value={actionFilter ?? ""}
            onChange={(e) => setActionFilter(e.target.value || undefined)}
            className="text-3xs bg-surface-lowest border border-border px-2 py-1"
          >
            <option value="">All actions</option>
            <option value="initial_buy">initial_buy</option>
            <option value="ladder_l1">ladder_l1</option>
            <option value="ladder_l2">ladder_l2</option>
            <option value="ladder_l3">ladder_l3</option>
            <option value="trailing_activate">trailing_activate</option>
            <option value="trailing_advance">trailing_advance</option>
            <option value="stop_out">stop_out</option>
            <option value="cooldown_start">cooldown_start</option>
            <option value="cooldown_exit">cooldown_exit</option>
            <option value="manual_close">manual_close</option>
            <option value="error">error</option>
          </select>
        </header>
        <ActionHistory actions={actions} loading={actionsPending} />
      </section>

      <p className="mt-4 text-3xs text-muted-foreground/50 uppercase tracking-wider">
        Cron: <code className="text-primary">btc_bot_monitor</code> · Manage cadence at{" "}
        <Link href="/crons" className="text-primary underline">/crons</Link>
      </p>
    </AppShell>
  );
}
