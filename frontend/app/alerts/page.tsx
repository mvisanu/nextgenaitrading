"use client";

/**
 * /alerts — Alert Configuration
 *
 * Shows alert rule cards with enable/disable Switch.
 * New Alert button opens AlertConfigForm in a Dialog.
 * Delete with confirmation.
 *
 * Protected route: requires authentication.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Bell, BellOff, Clock } from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { formatDateTime, getErrorMessage } from "@/lib/utils";
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
        <Button size="sm" onClick={() => setNewAlertOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Alert
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : alertRules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No alert rules yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create your first alert to be notified when a ticker enters a
            high-probability entry zone.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => setNewAlertOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New alert rule</DialogTitle>
          </DialogHeader>
          <AlertConfigForm onSuccess={() => setNewAlertOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingRule !== null}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete alert rule?</DialogTitle>
            <DialogDescription>
              This will permanently remove the{" "}
              <strong>
                {deletingRule
                  ? ALERT_TYPE_LABELS[deletingRule.alert_type]
                  : ""}
              </strong>{" "}
              alert for{" "}
              <strong className="font-mono">{deletingRule?.ticker}</strong>.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingRule(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => deletingRule && deleteAlert(deletingRule.id)}
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
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
              <span className="font-mono text-sm font-semibold">
                {rule.ticker}
              </span>
              <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                {rule.enabled ? (
                  <Bell className="h-3 w-3 mr-1" />
                ) : (
                  <BellOff className="h-3 w-3 mr-1" />
                )}
                {rule.enabled ? "Active" : "Disabled"}
              </Badge>
            </Label>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
            onClick={onDelete}
            title="Delete alert"
            aria-label="Delete alert"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Alert type</p>
            <p className="font-medium mt-0.5">
              {ALERT_TYPE_LABELS[rule.alert_type]}
            </p>
          </div>

          {proximityPct !== undefined && (
            <div>
              <p className="text-muted-foreground">Proximity threshold</p>
              <p className="font-medium font-mono mt-0.5">{proximityPct}%</p>
            </div>
          )}

          <div>
            <p className="text-muted-foreground">Cooldown</p>
            <p className="font-medium mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {rule.cooldown_minutes}m
            </p>
          </div>

          <div>
            <p className="text-muted-foreground">Market hours only</p>
            <p className="font-medium mt-0.5">
              {rule.market_hours_only ? "Yes" : "No"}
            </p>
          </div>
        </div>

        {rule.last_triggered_at && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Last triggered: {formatDateTime(rule.last_triggered_at)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
