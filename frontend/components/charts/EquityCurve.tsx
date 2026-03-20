"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type { BacktestTrade, EquityPoint } from "@/types";
import { formatPct, formatDate } from "@/lib/utils";

interface EquityCurveProps {
  trades?: BacktestTrade[];
  equityPoints?: EquityPoint[];
  height?: number;
  showPnlBars?: boolean;
}

function buildEquityFromTrades(trades: BacktestTrade[]): EquityPoint[] {
  let equity = 100;
  return trades.map((t) => {
    equity = +(equity * (1 + t.return_pct / 100)).toFixed(2);
    return {
      date: t.exit_time.split("T")[0],
      equity,
    };
  });
}

interface TooltipPayload {
  value?: number;
  dataKey?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label ? formatDate(label) : ""}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-medium">
          {p.dataKey === "equity"
            ? `Equity: ${p.value?.toFixed(2)}`
            : `PnL: ${p.value !== undefined ? formatPct(p.value) : "-"}`}
        </p>
      ))}
    </div>
  );
}

export function EquityCurve({
  trades,
  equityPoints,
  height = 240,
  showPnlBars = false,
}: EquityCurveProps) {
  const equityData =
    equityPoints ?? (trades ? buildEquityFromTrades(trades) : []);

  const pnlData = trades?.map((t) => ({
    date: t.exit_time.split("T")[0],
    pnl: t.return_pct,
  }));

  if (equityData.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground text-sm"
        style={{ height }}
      >
        No equity data
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={equityData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "#888" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#888" }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={100} stroke="#555" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="#22c55e"
            fill="#22c55e22"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {showPnlBars && pnlData && pnlData.length > 0 && (
        <ResponsiveContainer width="100%" height={120}>
          <BarChart
            data={pnlData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#888" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#888" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#555" />
            <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
              {pnlData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
