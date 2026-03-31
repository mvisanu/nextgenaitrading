"use client";

import { cn } from "@/lib/utils";

interface IVRankBadgeProps {
  ivRank: number;
  ivPercentile: number;
  className?: string;
}

export function IVRankBadge({ ivRank, ivPercentile, className }: IVRankBadgeProps) {
  const bg =
    ivRank > 50
      ? "bg-emerald-900/40 text-emerald-300 border-emerald-700"
      : ivRank >= 30
      ? "bg-amber-900/40 text-amber-300 border-amber-700"
      : "bg-zinc-800 text-zinc-400 border-zinc-600";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-mono border rounded px-2 py-0.5",
        bg,
        className
      )}
    >
      <span>IV Rank: {ivRank.toFixed(1)}</span>
      <span className="opacity-40">|</span>
      <span>IV%ile: {ivPercentile.toFixed(1)}</span>
    </span>
  );
}
