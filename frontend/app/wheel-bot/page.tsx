"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  wheelBotApi,
  WheelBotSession,
} from "@/lib/wheel-bot-api";

export default function WheelBotPage() {
  const qc = useQueryClient();
  const [dryRun, setDryRun] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["wheel-sessions"],
    queryFn: wheelBotApi.list,
    refetchInterval: 60_000,
  });

  const { data: summary } = useQuery({
    queryKey: ["wheel-summary", selectedId],
    queryFn: () => wheelBotApi.summary(selectedId!),
    enabled: selectedId !== null,
  });

  const setupMutation = useMutation({
    mutationFn: () => wheelBotApi.setup({ symbol: "TSLA", dry_run: dryRun }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wheel-sessions"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => wheelBotApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wheel-sessions"] }),
  });

  const hasActive = sessions.some((s: WheelBotSession) => s.status === "active");

  return (
    <AppShell title="Wheel Bot — TSLA">
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Wheel Strategy — TSLA
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Automated cash-secured puts → covered calls cycle on Tesla. Checks
            every 15 minutes during market hours.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start New Wheel Cycle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
              />
              <Label htmlFor="dry-run">
                {dryRun
                  ? "Paper trading (dry-run)"
                  : "Live trading — real orders will be placed"}
              </Label>
            </div>

            {!dryRun && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Live mode places real orders against your Alpaca account.
                Confirm you understand the risks before proceeding.
              </p>
            )}

            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || hasActive}
            >
              {setupMutation.isPending
                ? "Starting…"
                : hasActive
                ? "Session Already Active"
                : "Start Wheel Bot"}
            </Button>
            {setupMutation.isError && (
              <p className="text-sm text-destructive">
                {(setupMutation.error as Error).message}
              </p>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading sessions…</p>
        )}

        {sessions.map((session: WheelBotSession) => (
          <SessionCard
            key={session.id}
            session={session}
            onSelect={() =>
              setSelectedId(session.id === selectedId ? null : session.id)
            }
            selected={session.id === selectedId}
            onCancel={() => cancelMutation.mutate(session.id)}
            cancelPending={cancelMutation.isPending}
          />
        ))}

        {selectedId !== null && summary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Daily Summary — {summary.date}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <SummaryRow
                  label="Stage"
                  value={
                    summary.stage === "sell_put"
                      ? "Stage 1: Sell Put"
                      : "Stage 2: Sell Call"
                  }
                />
                <SummaryRow
                  label="Active Contract"
                  value={summary.active_contract_symbol ?? "—"}
                />
                <SummaryRow
                  label="Shares Held"
                  value={String(summary.shares_qty)}
                />
                <SummaryRow
                  label="Cost Basis/Share"
                  value={
                    summary.cost_basis_per_share != null
                      ? `$${summary.cost_basis_per_share.toFixed(2)}`
                      : "—"
                  }
                />
                <SummaryRow
                  label="Total Premium"
                  value={`$${summary.total_premium_collected.toFixed(2)}`}
                />
                <SummaryRow
                  label="Account Equity"
                  value={`$${summary.account_equity.toLocaleString()}`}
                />
                <SummaryRow
                  label="Cash"
                  value={`$${summary.account_cash.toLocaleString()}`}
                />
                <SummaryRow
                  label="Total Return"
                  value={`${summary.total_return_pct.toFixed(2)}%`}
                />
              </dl>
              {summary.last_action && (
                <p className="mt-4 text-xs text-muted-foreground">
                  <span className="font-medium">Last action:</span>{" "}
                  {summary.last_action}
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function SessionCard({
  session,
  onSelect,
  selected,
  onCancel,
  cancelPending,
}: {
  session: WheelBotSession;
  onSelect: () => void;
  selected: boolean;
  onCancel: () => void;
  cancelPending: boolean;
}) {
  const stageLabel =
    session.stage === "sell_put"
      ? "Stage 1 — Selling Puts"
      : "Stage 2 — Selling Calls";

  return (
    <Card className={selected ? "ring-2 ring-primary" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">
          {session.symbol} Wheel — #{session.id}
        </CardTitle>
        <div className="flex items-center gap-2">
          {session.dry_run && <Badge variant="secondary">Paper</Badge>}
          <Badge
            variant={
              (session.status === "active" ? "default" : "outline") as
                | "default"
                | "outline"
            }
          >
            {session.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-primary">{stageLabel}</p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <SummaryRow
            label="Active Contract"
            value={session.active_contract_symbol ?? "—"}
          />
          <SummaryRow
            label="Strike"
            value={
              session.active_strike != null
                ? `$${session.active_strike.toFixed(2)}`
                : "—"
            }
          />
          <SummaryRow label="Expiry" value={session.active_expiry ?? "—"} />
          <SummaryRow
            label="Premium Received"
            value={
              session.active_premium_received != null
                ? `$${(session.active_premium_received * 100).toFixed(2)}`
                : "—"
            }
          />
          <SummaryRow label="Shares" value={String(session.shares_qty)} />
          <SummaryRow
            label="Total Premium"
            value={`$${session.total_premium_collected.toFixed(2)}`}
          />
        </dl>

        {session.last_action && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Last action:</span>{" "}
            {session.last_action}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onSelect}>
            {selected ? "Hide Summary" : "View Summary"}
          </Button>
          {session.status === "active" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCancel}
              disabled={cancelPending}
            >
              Cancel Session
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
