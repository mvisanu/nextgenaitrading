"use client";
import type {
  AutoBuyDecisionState
} from "@/types";
import {
  CheckCircle2, Circle, Clock, Shield, XCircle, Zap
} from "lucide-react";


export const STATE_CONFIG: Record<
  AutoBuyDecisionState,
  { label: string; className: string; icon: typeof Circle; tag: string }
> = {
  order_filled: {
    label: "Filled",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: CheckCircle2,
    tag: "FILLED",
  },
  ready_to_buy: {
    label: "Ready to buy",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
    tag: "READY",
  },
  ready_to_alert: {
    label: "Ready to alert",
    className: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Zap,
    tag: "ALERT",
  },
  blocked_by_risk: {
    label: "Blocked",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
    tag: "REJECTED",
  },
  order_submitted: {
    label: "Submitted",
    className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: Clock,
    tag: "EXECUTION",
  },
  order_rejected: {
    label: "Rejected",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: XCircle,
    tag: "REJECTED",
  },
  candidate: {
    label: "Candidate",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
    tag: "ANALYTICS",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted/50 text-muted-foreground border-border",
    icon: Circle,
    tag: "SYSTEM",
  },
};

// ─── Tag color for terminal log ────────────────────────────────────────────────

export function tagColor(tag: string) {
  switch (tag) {
    case "SYSTEM":    return "text-primary";
    case "ANALYTICS": return "text-blue-400";
    case "DECISION":  return "text-yellow-400";
    case "EXECUTION": return "text-orange-400";
    case "DATA":      return "text-cyan-400";
    case "READY":     return "text-emerald-400";
    case "FILLED":    return "text-green-400";
    case "ALERT":     return "text-amber-400";
    case "REJECTED":  return "text-destructive";
    default:          return "text-muted-foreground";
  }
}

// ─── Default settings (used as fallback while query is loading or user is unauthenticated) ───

export function SectionHeader({ icon: Icon, title }: { icon: typeof Shield; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h3>
    </div>
  );
}

// ─── Strategy card ─────────────────────────────────────────────────────────────
