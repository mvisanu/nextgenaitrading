import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPct(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    conservative: "Conservative",
    aggressive: "Aggressive",
    "ai-pick": "AI Pick",
    "buy-low-sell-high": "Buy Low / Sell High",
  };
  return labels[mode] ?? mode;
}

export function getRegimeVariant(
  regime: string | null
): "default" | "destructive" | "secondary" | "outline" {
  if (!regime) return "secondary";
  const lower = regime.toLowerCase();
  if (lower.includes("bull")) return "default";
  if (lower.includes("bear")) return "destructive";
  return "secondary";
}

export function getSignalVariant(
  signal: string | null
): "default" | "destructive" | "secondary" | "outline" {
  if (!signal) return "secondary";
  const lower = signal.toLowerCase();
  if (lower === "buy") return "default";
  if (lower === "sell") return "destructive";
  return "secondary";
}

export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
