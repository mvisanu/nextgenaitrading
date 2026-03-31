"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import type { OptionsPositionOut, PortfolioGreeksOut } from "@/lib/options-api";

interface GreeksDashboardProps {
  greeks: PortfolioGreeksOut;
  positions: OptionsPositionOut[];
}

function KPICard({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number;
  unit?: string;
  highlight?: "positive" | "negative" | "neutral";
}) {
  const color =
    highlight === "positive"
      ? "text-emerald-400"
      : highlight === "negative"
      ? "text-red-400"
      : "text-zinc-200";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-xl font-mono font-semibold", color)}>
        {value >= 0 ? "+" : ""}{value.toFixed(4)}
        {unit && <span className="text-xs text-zinc-500 ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export function GreeksDashboard({ greeks, positions }: GreeksDashboardProps) {
  // Theta decay chart: simulate cumulative theta P&L from 30 DTE → 0
  const decayData = useMemo(() => {
    const thetaPerDay = greeks.net_theta;
    return Array.from({ length: 31 }, (_, i) => {
      const dte = 30 - i;
      return {
        dte,
        pnl: Math.round(thetaPerDay * i * 100) / 100,
      };
    });
  }, [greeks.net_theta]);

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
        <p className="text-sm">No open options positions</p>
        <p className="text-xs mt-1 text-zinc-600">Use the scanner to find setups</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KPICard label="Net Delta" value={greeks.net_delta} />
        <KPICard label="Net Gamma" value={greeks.net_gamma} />
        <KPICard
          label="Net Theta ($/day)"
          value={greeks.net_theta}
          highlight={greeks.net_theta >= 0 ? "positive" : "negative"}
        />
        <KPICard label="Net Vega" value={greeks.net_vega} />
      </div>

      {/* Per-position table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-2 py-1.5 text-left">Symbol</th>
              <th className="px-2 py-1.5 text-left">Strategy</th>
              <th className="px-2 py-1.5 text-right">DTE</th>
              <th className="px-2 py-1.5 text-right">Max P</th>
              <th className="px-2 py-1.5 text-right">Max L</th>
              <th className="px-2 py-1.5 text-right">POP</th>
              <th className="px-2 py-1.5 text-right">IV Rank</th>
              <th className="px-2 py-1.5 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20">
                <td className="px-2 py-1 font-semibold text-zinc-200">{pos.symbol}</td>
                <td className="px-2 py-1 text-zinc-400">{pos.strategy.replace(/_/g, " ")}</td>
                <td className="px-2 py-1 text-right">{pos.days_to_expiry_at_entry}</td>
                <td className="px-2 py-1 text-right text-emerald-400">${pos.max_profit.toFixed(0)}</td>
                <td className="px-2 py-1 text-right text-red-400">${pos.max_loss.toFixed(0)}</td>
                <td className="px-2 py-1 text-right">{(pos.probability_of_profit * 100).toFixed(0)}%</td>
                <td className="px-2 py-1 text-right">{pos.iv_rank_at_entry.toFixed(1)}</td>
                <td className="px-2 py-1 text-center">
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border",
                      pos.dry_run
                        ? "border-amber-700 text-amber-400 bg-amber-900/20"
                        : "border-emerald-700 text-emerald-400 bg-emerald-900/20"
                    )}
                  >
                    {pos.dry_run ? "DRY" : "LIVE"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Theta decay chart */}
      <div>
        <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">
          Theta Decay — Cumulative P&amp;L
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={decayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="dte"
                reversed
                tick={{ fill: "#71717a", fontSize: 10 }}
                label={{ value: "DTE", position: "insideBottomRight", fill: "#71717a", fontSize: 10 }}
              />
              <YAxis tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }}
                labelFormatter={(v) => `${v} DTE`}
                formatter={(v: number) => [`$${v.toFixed(2)}`, "Theta P&L"]}
              />
              <Line
                type="monotone"
                dataKey="pnl"
                stroke="#44DFA3"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
