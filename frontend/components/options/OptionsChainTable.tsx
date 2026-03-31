"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { IVRankBadge } from "./IVRankBadge";
import type { OptionContractOut } from "@/lib/options-api";

interface OptionsChainTableProps {
  contracts: OptionContractOut[];
  underlyingPrice: number;
  ivRank: number;
  ivPercentile: number;
  onSelectContract?: (contract: OptionContractOut) => void;
}

type SortKey = "strike" | "volume" | "open_interest" | "implied_volatility" | "delta";

function formatNum(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

export function OptionsChainTable({
  contracts,
  underlyingPrice,
  ivRank,
  ivPercentile,
  onSelectContract,
}: OptionsChainTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("strike");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMinDelta, setFilterMinDelta] = useState("");
  const [filterMaxDelta, setFilterMaxDelta] = useState("");
  const [filterMinOI, setFilterMinOI] = useState("");

  const calls = useMemo(() => contracts.filter((c) => c.option_type === "call"), [contracts]);
  const puts = useMemo(() => contracts.filter((c) => c.option_type === "put"), [contracts]);

  const allStrikes = useMemo(() => {
    const s = new Set([...calls.map((c) => c.strike), ...puts.map((c) => c.strike)]);
    return Array.from(s).sort((a, b) => a - b);
  }, [calls, puts]);

  function applyDeltaFilter(c: OptionContractOut) {
    const d = Math.abs(c.delta);
    if (filterMinDelta && d < parseFloat(filterMinDelta)) return false;
    if (filterMaxDelta && d > parseFloat(filterMaxDelta)) return false;
    if (filterMinOI && c.open_interest < parseInt(filterMinOI)) return false;
    return true;
  }

  const filteredCalls = useMemo(() => calls.filter(applyDeltaFilter), [calls, filterMinDelta, filterMaxDelta, filterMinOI]);
  const filteredPuts = useMemo(() => puts.filter(applyDeltaFilter), [puts, filterMinDelta, filterMaxDelta, filterMinOI]);

  const callsByStrike = useMemo(
    () => Object.fromEntries(filteredCalls.map((c) => [c.strike, c])),
    [filteredCalls]
  );
  const putsByStrike = useMemo(
    () => Object.fromEntries(filteredPuts.map((c) => [c.strike, c])),
    [filteredPuts]
  );

  function isITM(strike: number, type: "call" | "put") {
    if (type === "call") return strike < underlyingPrice;
    return strike > underlyingPrice;
  }

  function deltaColor(delta: number, type: "call" | "put") {
    const abs = Math.abs(delta);
    if (type === "call") {
      if (abs > 0.6) return "text-emerald-400";
      if (abs > 0.3) return "text-emerald-300/70";
      return "text-zinc-400";
    } else {
      if (abs > 0.6) return "text-red-400";
      if (abs > 0.3) return "text-red-300/70";
      return "text-zinc-400";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <IVRankBadge ivRank={ivRank} ivPercentile={ivPercentile} />
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>Min Δ</span>
          <input
            type="number"
            value={filterMinDelta}
            onChange={(e) => setFilterMinDelta(e.target.value)}
            placeholder="0.10"
            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs"
            step="0.05"
            min="0"
            max="1"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>Max Δ</span>
          <input
            type="number"
            value={filterMaxDelta}
            onChange={(e) => setFilterMaxDelta(e.target.value)}
            placeholder="0.50"
            className="w-16 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs"
            step="0.05"
            min="0"
            max="1"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span>Min OI</span>
          <input
            type="number"
            value={filterMinOI}
            onChange={(e) => setFilterMinOI(e.target.value)}
            placeholder="100"
            className="w-20 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-zinc-200 text-xs"
            min="0"
          />
        </div>
      </div>

      {/* Chain table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400">
              {/* Calls header */}
              <th className="px-2 py-1.5 text-right text-emerald-400/70">Bid</th>
              <th className="px-2 py-1.5 text-right text-emerald-400/70">Ask</th>
              <th className="px-2 py-1.5 text-right">IV%</th>
              <th className="px-2 py-1.5 text-right">Δ</th>
              <th className="px-2 py-1.5 text-right">Vol</th>
              <th className="px-2 py-1.5 text-right">OI</th>
              {/* Strike */}
              <th className="px-3 py-1.5 text-center font-semibold text-zinc-200 bg-zinc-900/50">
                STRIKE
              </th>
              {/* Puts header */}
              <th className="px-2 py-1.5 text-left">OI</th>
              <th className="px-2 py-1.5 text-left">Vol</th>
              <th className="px-2 py-1.5 text-left">Δ</th>
              <th className="px-2 py-1.5 text-left">IV%</th>
              <th className="px-2 py-1.5 text-left text-red-400/70">Ask</th>
              <th className="px-2 py-1.5 text-left text-red-400/70">Bid</th>
            </tr>
          </thead>
          <tbody>
            {allStrikes.map((strike) => {
              const call = callsByStrike[strike];
              const put = putsByStrike[strike];
              const itmCall = isITM(strike, "call");
              const itmPut = isITM(strike, "put");

              return (
                <tr
                  key={strike}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors"
                >
                  {/* Calls side */}
                  {call ? (
                    <>
                      <td
                        className={cn(
                          "px-2 py-1 text-right cursor-pointer",
                          itmCall ? "bg-emerald-950/30" : "",
                          call.illiquid ? "opacity-50" : ""
                        )}
                        onClick={() => onSelectContract?.(call)}
                        title={call.illiquid ? "Wide spread — excluded from auto-execution" : undefined}
                      >
                        {formatNum(call.bid)}
                      </td>
                      <td className={cn("px-2 py-1 text-right", itmCall ? "bg-emerald-950/30" : "")}>
                        {formatNum(call.ask)}
                      </td>
                      <td className={cn("px-2 py-1 text-right", itmCall ? "bg-emerald-950/30" : "")}>
                        {(call.implied_volatility * 100).toFixed(1)}%
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-right",
                          deltaColor(call.delta, "call"),
                          itmCall ? "bg-emerald-950/30" : ""
                        )}
                      >
                        {formatNum(call.delta, 3)}
                      </td>
                      <td className={cn("px-2 py-1 text-right text-zinc-400", itmCall ? "bg-emerald-950/30" : "")}>
                        {call.volume.toLocaleString()}
                      </td>
                      <td className={cn("px-2 py-1 text-right text-zinc-400", itmCall ? "bg-emerald-950/30" : "")}>
                        {call.open_interest.toLocaleString()}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-2 py-1 text-center text-zinc-700">—</td>
                  )}

                  {/* Strike */}
                  <td className="px-3 py-1 text-center font-semibold text-zinc-200 bg-zinc-900/50">
                    {strike.toFixed(2)}
                    {Math.abs(strike - underlyingPrice) < 1 && (
                      <span className="ml-1 text-[10px] text-primary">●</span>
                    )}
                  </td>

                  {/* Puts side */}
                  {put ? (
                    <>
                      <td className={cn("px-2 py-1 text-left text-zinc-400", itmPut ? "bg-red-950/20" : "")}>
                        {put.open_interest.toLocaleString()}
                      </td>
                      <td className={cn("px-2 py-1 text-left text-zinc-400", itmPut ? "bg-red-950/20" : "")}>
                        {put.volume.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-1 text-left",
                          deltaColor(put.delta, "put"),
                          itmPut ? "bg-red-950/20" : "",
                          put.illiquid ? "opacity-50" : ""
                        )}
                        onClick={() => onSelectContract?.(put)}
                        style={{ cursor: "pointer" }}
                        title={put.illiquid ? "Wide spread — excluded from auto-execution" : undefined}
                      >
                        {formatNum(put.delta, 3)}
                      </td>
                      <td className={cn("px-2 py-1 text-left", itmPut ? "bg-red-950/20" : "")}>
                        {(put.implied_volatility * 100).toFixed(1)}%
                      </td>
                      <td className={cn("px-2 py-1 text-left", itmPut ? "bg-red-950/20" : "")}>
                        {formatNum(put.ask)}
                      </td>
                      <td className={cn("px-2 py-1 text-left", itmPut ? "bg-red-950/20" : "")}>
                        {formatNum(put.bid)}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-2 py-1 text-center text-zinc-700">—</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {allStrikes.length === 0 && (
        <p className="text-center text-zinc-500 text-sm py-6">No contracts match the current filters.</p>
      )}
    </div>
  );
}
