"use client";

/**
 * BuyZoneAnalysisPanel — collapsible panel for a given ticker.
 *
 * Fetches buy zone + theme score data, renders:
 *   - BuyZoneCard
 *   - HistoricalOutcomePanel
 *   - ThemeScoreBadge
 *   - Alert toggle (PATCH /api/alerts/:id enable/disable)
 *   - Auto-buy eligible badge
 *   - Recalculate button
 *
 * Integrated into /opportunities row expansion.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, RefreshCw, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BuyZoneCard } from "./BuyZoneCard";
import { HistoricalOutcomePanel } from "./HistoricalOutcomePanel";
import { ThemeScoreBadge } from "./ThemeScoreBadge";
import { buyZoneApi, themeScoreApi, alertsApi } from "@/lib/api";
import { getErrorMessage, cn } from "@/lib/utils";
import type { PriceAlertRule } from "@/types";

interface BuyZoneAnalysisPanelProps {
  ticker: string;
  /** Optional existing alert rule to show inline toggle. */
  alertRule?: PriceAlertRule;
  /** Whether the ticker is auto-buy eligible per the opportunities list. */
  autoBuyEligible?: boolean;
  className?: string;
}

export function BuyZoneAnalysisPanel({
  ticker,
  alertRule,
  autoBuyEligible = false,
  className,
}: BuyZoneAnalysisPanelProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: snapshot,
    isLoading: snapshotLoading,
    error: snapshotError,
  } = useQuery({
    queryKey: ["buy-zone", ticker],
    queryFn: () => buyZoneApi.get(ticker),
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const {
    data: themeScore,
    isLoading: themeLoading,
  } = useQuery({
    queryKey: ["theme-score", ticker],
    queryFn: () => themeScoreApi.get(ticker),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const { mutate: recalculate, isPending: isRecalculating } = useMutation({
    mutationFn: () => buyZoneApi.recalculate(ticker),
    onSuccess: (result) => {
      queryClient.setQueryData(["buy-zone", ticker], result);
      toast.success(`Buy zone recalculated for ${ticker}`);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Recalculation failed"));
    },
  });

  const { mutate: toggleAlert, isPending: isTogglingAlert } = useMutation({
    mutationFn: (enabled: boolean) =>
      alertsApi.update(alertRule!.id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Alert updated");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to update alert"));
    },
  });

  const isLoading = snapshotLoading || themeLoading;

  return (
    <div className={cn("rounded-md border border-border overflow-hidden", className)}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary transition-colors"
      >
        <span className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          Buy Zone Analysis — {ticker}
        </span>
        <div className="flex items-center gap-2">
          {autoBuyEligible && (
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
              Auto-buy eligible
            </Badge>
          )}
          {alertRule?.enabled && (
            <Badge variant="secondary" className="text-xs">
              <Bell className="h-3 w-3 mr-1" />
              Alert on
            </Badge>
          )}
        </div>
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Alert toggle */}
            {alertRule && (
              <div className="flex items-center gap-2">
                <Switch
                  id={`alert-toggle-${ticker}`}
                  checked={alertRule.enabled}
                  onCheckedChange={(checked) => toggleAlert(checked)}
                  disabled={isTogglingAlert}
                />
                <Label htmlFor={`alert-toggle-${ticker}`} className="text-xs cursor-pointer flex items-center gap-1">
                  {alertRule.enabled ? (
                    <Bell className="h-3.5 w-3.5" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Alert {alertRule.enabled ? "enabled" : "disabled"}
                </Label>
              </div>
            )}

            {/* Recalculate button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => recalculate()}
              disabled={isRecalculating}
              className="ml-auto"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5 mr-1.5", isRecalculating && "animate-spin")}
              />
              {isRecalculating ? "Recalculating..." : "Recalculate"}
            </Button>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : snapshotError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-destructive">
                Failed to load buy zone data for {ticker}.
              </p>
            </div>
          ) : snapshot ? (
            <>
              <BuyZoneCard snapshot={snapshot} />
              <HistoricalOutcomePanel snapshot={snapshot} />

              {/* Theme alignment */}
              {themeScore && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Theme alignment
                  </p>
                  <ThemeScoreBadge
                    scoresByCategory={themeScore.theme_scores_by_category}
                  />
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              No buy zone data available. Click Recalculate to compute.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
