"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const STRATEGY_MAP: Record<
  string,
  { label: string; className: string; icon?: boolean }
> = {
  covered_call: { label: "Covered Call", className: "bg-amber-900/50 text-amber-300 border-amber-700" },
  cash_secured_put: { label: "Cash-Secured Put", className: "bg-amber-900/50 text-amber-300 border-amber-700" },
  bull_call_debit: { label: "Bull Call Debit", className: "bg-emerald-900/50 text-emerald-300 border-emerald-700" },
  bull_put_spread: { label: "Bull Put Spread", className: "bg-emerald-900/50 text-emerald-300 border-emerald-700" },
  bear_call_spread: { label: "Bear Call Spread", className: "bg-red-900/50 text-red-300 border-red-700" },
  bear_put_debit: { label: "Bear Put Debit", className: "bg-red-900/50 text-red-300 border-red-700" },
  iron_condor: { label: "Iron Condor", className: "bg-purple-900/50 text-purple-300 border-purple-700" },
  iron_butterfly: { label: "Iron Butterfly", className: "bg-purple-900/50 text-purple-300 border-purple-700" },
  long_straddle: { label: "Long Straddle", className: "bg-blue-900/50 text-blue-300 border-blue-700" },
  long_strangle: { label: "Long Strangle", className: "bg-blue-900/50 text-blue-300 border-blue-700" },
  naked_call: { label: "Naked Call", className: "bg-orange-900/50 text-orange-300 border-orange-700", icon: true },
  naked_put: { label: "Naked Put", className: "bg-orange-900/50 text-orange-300 border-orange-700", icon: true },
};

interface StrategyBadgeProps {
  strategy: string;
  className?: string;
}

export function StrategyBadge({ strategy, className }: StrategyBadgeProps) {
  const config = STRATEGY_MAP[strategy] ?? {
    label: strategy.replace(/_/g, " "),
    className: "bg-zinc-800 text-zinc-300 border-zinc-600",
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium border px-2 py-0.5 flex items-center gap-1",
        config.className,
        className
      )}
    >
      {config.icon && <AlertTriangle className="w-3 h-3" />}
      {config.label}
    </Badge>
  );
}
