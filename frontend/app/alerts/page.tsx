"use client";

/**
 * /alerts — Alert Configuration
 *
 * Sovereign Terminal design system applied.
 * Protected route: requires authentication.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Bell, Clock } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { AlertConfigForm } from "@/components/alerts/AlertConfigForm";
import { alertsApi } from "@/lib/api";
import { formatDateTime, getErrorMessage, cn } from "@/lib/utils";
import type { PriceAlertRule, AlertType } from "@/types";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  entered_buy_zone: "Entered high-probability entry zone",
  near_buy_zone: "Near entry zone",
  below_invalidation: "Below invalidation level",
  confidence_improved: "Confidence score improved",
  theme_score_increased: "Theme score increased",
  macro_deterioration: "Macro / theme deterioration",
};

export default function AlertsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<PriceAlertRule | null>(null);

  const { data: alertRules = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: alertsApi.list,
    enabled: !!user,
  });

  const { mutate: toggleAlert, isPending: isToggling } = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      alertsApi.update(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to update alert"));
    },
  });

  const { mutate: deleteAlert, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => alertsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert rule deleted");
      setDeletingRule(null);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to delete alert"));
    },
  });

  return (
    <AppShell
      title="Alerts"
      actions={
        <Button
          size="sm"
          onClick={() => setNewAlertOpen(true)}
          className="bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs h-8 px-3"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Alert
        </Button>
      }
    >
      {/* Page header */}
      <div className="mb-4">
        <p className="text-xl font-bold text-foreground">Alerts</p>
        <p className="text-sm text-muted-foreground">Price alert rules for your watchlist tickers</p>
      </div>

      {/* Section label */}
      {!isLoading && alertRules.length > 0 && (
        <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
          Active rules — {alertRules.length}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full bg-surface-mid" />
          ))}
        </div>
      ) : alertRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-10 w-10 rounded-full bg-surface-high flex items-center justify-center mb-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground">No alert rules yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Create your first alert to be notified when a ticker enters a
            high-probability entry zone.
          </p>
          <Button
            size="sm"
            className="mt-4 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs"
            onClick={() => setNewAlertOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Alert
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {alertRules.map((rule) => (
            <AlertRuleCard
              key={rule.id}
              rule={rule}
              onToggle={(enabled) =>
                toggleAlert({ id: rule.id, enabled })
              }
              onDelete={() => setDeletingRule(rule)}
              isToggling={isToggling}
            />
          ))}
        </div>
      )}

      {/* New alert dialog */}
      <Dialog open={newAlertOpen} onOpenChange={setNewAlertOpen}>
        <DialogContent className="max-w-md bg-surface-low border border-border/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-foreground">
              New alert rule
            </DialogTitle>
          </DialogHeader>
          <AlertConfigForm onSuccess={() => setNewAlertOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingRule !== null}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <DialogContent className="bg-surface-low border border-border/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-foreground">
              Delete alert rule?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently remove the{" "}
              <strong className="text-foreground">
                {deletingRule
                  ? ALERT_TYPE_LABELS[deletingRule.alert_type]
                  : ""}
              </strong>{" "}
              alert for{" "}
              <strong className="font-mono text-foreground">{deletingRule?.ticker}</strong>.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeletingRule(null)}
              disabled={isDeleting}
              className="text-xs hover:bg-surface-high/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => deletingRule && deleteAlert(deletingRule.id)}
              className="text-xs font-bold uppercase tracking-widest"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Alert rule card ──────────────────────────────────────────────────────────

interface AlertRuleCardProps {
  rule: PriceAlertRule;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  isToggling: boolean;
}

function AlertRuleCard({
  rule,
  onToggle,
  onDelete,
  isToggling,
}: AlertRuleCardProps) {
  const proximityPct = (
    rule.threshold_json as { proximity_pct?: number }
  )?.proximity_pct;

  return (
    <div
      className={cn(
        "rounded-md border border-border/10 bg-surface-low p-3 transition-colors",
        rule.enabled ? "border-l-2 border-l-primary" : "border-l-2 border-l-border/20"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <Switch
            id={`alert-${rule.id}`}
            checked={rule.enabled}
            onCheckedChange={onToggle}
            disabled={isToggling}
          />
          <Label
            htmlFor={`alert-${rule.id}`}
            className="cursor-pointer flex items-center gap-2"
          >
            <span className="font-mono text-sm font-bold text-foreground">
              {rule.ticker}
            </span>
            {/* Status dot + label */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 text-3xs font-bold px-2 py-0.5 rounded-sm",
                rule.enabled
                  ? "bg-primary/15 text-primary"
                  : "bg-surface-high text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  rule.enabled ? "bg-primary" : "bg-muted-foreground/50"
                )}
              />
              {rule.enabled ? "Active" : "Paused"}
            </span>
          </Label>
        </div>
        <button
          type="button"
          className="text-muted-foreground/40 hover:text-destructive transition-colors"
          onClick={onDelete}
          title="Delete alert"
          aria-label="Delete alert"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
        <div>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Alert type</p>
          <p className="text-foreground/90 tabular-nums">
            {ALERT_TYPE_LABELS[rule.alert_type]}
          </p>
        </div>

        {proximityPct !== undefined && (
          <div>
            <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Proximity</p>
            <p className="font-mono font-bold text-foreground tabular-nums">{proximityPct}%</p>
          </div>
        )}

        <div>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Cooldown</p>
          <p className="font-mono text-foreground flex items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {rule.cooldown_minutes}m
          </p>
        </div>

        <div>
          <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Market hours</p>
          <p className="text-foreground">
            {rule.market_hours_only ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {rule.last_triggered_at && (
        <p className="text-2xs text-muted-foreground mt-2.5 pt-2 border-t border-border/10">
          Last triggered: {formatDateTime(rule.last_triggered_at)}
        </p>
      )}
    </div>
  );
}
