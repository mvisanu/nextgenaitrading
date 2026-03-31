"use client";

import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { OptionsRiskModelOut } from "@/lib/options-api";

interface PLChartProps {
  riskModel: OptionsRiskModelOut | null;
  underlyingPrice: number;
}

export function PLChart({ riskModel, underlyingPrice }: PLChartProps) {
  if (!riskModel) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
        Select a contract or signal to model P&amp;L
      </div>
    );
  }

  const chartData = Object.entries(riskModel.profit_at_expiry)
    .map(([price, pnl]) => ({ price: parseFloat(price), pnl }))
    .sort((a, b) => a.price - b.price);

  const maxVal = Math.max(...chartData.map((d) => d.pnl));
  const minVal = Math.min(...chartData.map((d) => d.pnl));

  return (
    <div className="flex flex-col gap-3">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="plGradientPos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#44DFA3" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#44DFA3" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="plGradientNeg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.0} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="price"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickFormatter={(v) => `$${v >= 0 ? "+" : ""}${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 6 }}
              labelFormatter={(v) => `Price: $${parseFloat(v as string).toFixed(2)}`}
              formatter={(v: number) => [`${v >= 0 ? "+" : ""}$${v.toFixed(2)}`, "P&L at Expiry"]}
            />
            {/* Zero line */}
            <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
            {/* Current price */}
            <ReferenceLine
              x={underlyingPrice}
              stroke="#a1a1aa"
              strokeDasharray="4 4"
              label={{ value: "Now", position: "top", fill: "#a1a1aa", fontSize: 10 }}
            />
            {/* Breakevens */}
            {riskModel.breakeven_prices.map((be, i) => (
              <ReferenceLine
                key={i}
                x={be}
                stroke="#f59e0b"
                strokeDasharray="4 2"
                label={{ value: `BE $${be.toFixed(0)}`, position: "top", fill: "#f59e0b", fontSize: 9 }}
              />
            ))}
            {/* Max profit/loss horizontal markers */}
            {riskModel.max_profit > 0 && (
              <ReferenceLine
                y={riskModel.max_profit}
                stroke="#44DFA3"
                strokeDasharray="6 2"
                label={{ value: `Max +$${riskModel.max_profit.toFixed(0)}`, position: "right", fill: "#44DFA3", fontSize: 9 }}
              />
            )}
            {riskModel.max_loss < 0 && (
              <ReferenceLine
                y={riskModel.max_loss}
                stroke="#f87171"
                strokeDasharray="6 2"
                label={{ value: `Max -$${Math.abs(riskModel.max_loss).toFixed(0)}`, position: "right", fill: "#f87171", fontSize: 9 }}
              />
            )}
            {/* P&L area */}
            <Area
              type="monotone"
              dataKey="pnl"
              fill="url(#plGradientPos)"
              stroke="#44DFA3"
              strokeWidth={1.5}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
        <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Max Profit</div>
          <div className="text-emerald-400 font-semibold">+${riskModel.max_profit.toFixed(2)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Max Loss</div>
          <div className="text-red-400 font-semibold">${riskModel.max_loss.toFixed(2)}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
          <div className="text-zinc-500 text-[10px] uppercase">POP</div>
          <div className="text-zinc-200 font-semibold">
            {(riskModel.probability_of_profit * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Risk/Reward</div>
          <div className="text-zinc-200 font-semibold">{riskModel.risk_reward_ratio.toFixed(2)}x</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Theta/Day</div>
          <div
            className={
              riskModel.theta_per_day >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"
            }
          >
            {riskModel.theta_per_day >= 0 ? "+" : ""}${riskModel.theta_per_day.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Risk gate failures */}
      {!riskModel.passes_risk_gate && riskModel.risk_gate_failures.length > 0 && (
        <div className="rounded border border-red-800 bg-red-950/20 p-2 text-xs text-red-300 space-y-0.5">
          {riskModel.risk_gate_failures.map((f, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <span className="text-red-500 mt-0.5">✕</span>
              {f}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
