"use client";
import { Badge } from "@/components/ui/badge";
import {
  cn, formatCurrency
} from "@/lib/utils";
import type {
  AutoBuyDryRunResult
} from "@/types";
import {
  CheckCircle2, XCircle
} from "lucide-react";



import { STATE_CONFIG } from "./shared";
export function DryRunResultPanel({ result }: { result: AutoBuyDryRunResult }) {
  const cfg = STATE_CONFIG[result.decision_state] ?? STATE_CONFIG.candidate;
  const StateIcon = cfg.icon;

  const passed = (result.reason_codes ?? []).filter((code: any) => {
    if (typeof code === "string") return !code.startsWith("FAILED");
    return !String(code.result).startsWith("FAILED");
  }).length;
  const total = (result.reason_codes ?? []).length;

  return (
    <div className="bg-surface-lowest p-4 space-y-3 border border-border/10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className={cn("text-xs gap-1.5 px-3 py-1", cfg.className)}
        >
          <StateIcon className="h-4 w-4" />
          {cfg.label}
        </Badge>
        <span className="font-mono text-sm font-semibold">{result.ticker}</span>
        <div className="ml-auto flex items-center gap-2">
          {total > 0 && (
            <span className="text-2xs text-muted-foreground">
              {passed}/{total} checks passed
            </span>
          )}
          <Badge variant="secondary" className="text-2xs">
            Dry run
          </Badge>
        </div>
      </div>

      {/* Reason codes */}
      {total > 0 && (
        <div className="space-y-1.5">
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">
            Safeguard checks
          </p>
          <div className="flex flex-wrap gap-1">
            {(result.reason_codes ?? []).map((code: any, i: number) => {
              const label =
                typeof code === "string"
                  ? code
                  : `${code.check}: ${code.result}`;
              const failed =
                typeof code === "string"
                  ? code.startsWith("FAILED")
                  : String(code.result).startsWith("FAILED");
              return (
                <span
                  key={i}
                  className={cn(
                    "text-2xs font-mono px-1.5 py-0.5 inline-flex items-center gap-1",
                    failed
                      ? "bg-red-500/10 text-red-400"
                      : "bg-green-500/10 text-green-400"
                  )}
                >
                  {failed ? (
                    <XCircle className="h-2.5 w-2.5" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5" />
                  )}
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Signal snapshot */}
      {Object.keys(result.signal_payload).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium">
            Signal snapshot
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs bg-surface-mid p-2.5">
            {(
              [
                ["confidence_score", "Confidence"],
                ["buy_zone_low", "Zone Low"],
                ["buy_zone_high", "Zone High"],
                ["current_price", "Current Price"],
              ] as [string, string][]
            ).map(([key, label]) => {
              const val = result.signal_payload[key];
              if (val === undefined) return null;
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono font-medium">
                    {typeof val === "number"
                      ? key === "confidence_score"
                        ? `${Math.round((val as number) * 100)}%`
                        : formatCurrency(val as number)
                      : String(val)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
