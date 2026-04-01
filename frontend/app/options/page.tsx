"use client";

/**
 * /options — Options Trading Dashboard
 *
 * Two modes:
 *  • Beginner  — guided flow: direction picker → plain-English trade cards
 *  • Pro       — four-panel terminal: chain scanner, Greeks, P&L model, signal feed
 */

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  FlaskConical,
  Radio,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  GraduationCap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { OptionsChainTable } from "@/components/options/OptionsChainTable";
import { GreeksDashboard } from "@/components/options/GreeksDashboard";
import { PLChart } from "@/components/options/PLChart";
import { SignalCard } from "@/components/options/SignalCard";
import { BeginnerTradeCard } from "@/components/options/BeginnerTradeCard";
import {
  optionsApi,
  type OptionContractOut,
} from "@/lib/options-api";

// ── Constants ─────────────────────────────────────────────────────────────────

const PANEL_CARD =
  "bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 min-h-0";
const PANEL_TITLE =
  "text-xs font-semibold text-zinc-400 uppercase tracking-wider";

type ViewMode = "beginner" | "pro";
type Direction = "all" | "bullish" | "bearish" | "neutral";

const DIRECTIONS: { key: Direction; label: string; sublabel: string; icon: typeof TrendingUp; activeClass: string; iconClass: string }[] = [
  {
    key: "bullish",
    label: "Going Up",
    sublabel: "I think it will rise",
    icon: TrendingUp,
    activeClass: "border-emerald-500/60 bg-emerald-900/20 shadow-emerald-900/30",
    iconClass: "text-emerald-400",
  },
  {
    key: "neutral",
    label: "Staying Flat",
    sublabel: "I think it won't move much",
    icon: Minus,
    activeClass: "border-sky-500/60 bg-sky-900/20 shadow-sky-900/30",
    iconClass: "text-sky-400",
  },
  {
    key: "bearish",
    label: "Going Down",
    sublabel: "I think it will fall",
    icon: TrendingDown,
    activeClass: "border-red-500/60 bg-red-900/20 shadow-red-900/30",
    iconClass: "text-red-400",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OptionsPage() {
  const queryClient = useQueryClient();

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [symbol, setSymbol] = useState("AAPL");
  const [symbolInput, setSymbolInput] = useState("AAPL");
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [underlyingPrice, setUnderlyingPrice] = useState(100);
  const [selectedContract, setSelectedContract] = useState<OptionContractOut | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [showLiveDialog, setShowLiveDialog] = useState(false);

  // ── Mode state ────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>("beginner");
  const [direction, setDirection] = useState<Direction>("all");

  // ── Queries ───────────────────────────────────────────────────────────────────

  const { data: expirations, isLoading: loadingExp } = useQuery({
    queryKey: ["options-expirations", symbol],
    queryFn: () => optionsApi.getExpirations(symbol),
    enabled: !!symbol,
  });

  useEffect(() => {
    if (expirations && expirations.expirations.length > 0 && !selectedExpiration) {
      setSelectedExpiration(expirations.expirations[0]);
    }
  }, [expirations, selectedExpiration]);

  const { data: chain, isLoading: loadingChain } = useQuery({
    queryKey: ["options-chain", symbol, selectedExpiration, underlyingPrice],
    queryFn: () => optionsApi.getChain(symbol, selectedExpiration, underlyingPrice),
    // Only fetch chain in Pro mode — it triggers N Greeks computations server-side
    enabled: viewMode === "pro" && !!symbol && !!selectedExpiration,
  });

  const { data: ivRank } = useQuery({
    queryKey: ["options-iv", symbol],
    queryFn: () => optionsApi.getIVRank(symbol),
    enabled: !!symbol,
  });

  const { data: signals, isLoading: loadingSignals } = useQuery({
    queryKey: ["options-signals"],
    queryFn: optionsApi.getSignals,
    // signals shown in both beginner and pro modes — always enabled
    refetchInterval: 60_000,
  });

  const { data: positions } = useQuery({
    queryKey: ["options-positions"],
    queryFn: optionsApi.getPositions,
    // positions panel only visible in Pro mode
    enabled: viewMode === "pro",
    refetchInterval: 30_000,
  });

  const { data: greeks } = useQuery({
    queryKey: ["options-portfolio-greeks"],
    queryFn: optionsApi.getPortfolioGreeks,
    // Greeks dashboard only rendered in Pro mode
    enabled: viewMode === "pro",
    refetchInterval: 30_000,
  });

  const { data: riskModel } = useQuery({
    queryKey: ["options-risk", selectedContract?.symbol, selectedContract?.strike, underlyingPrice],
    queryFn: () =>
      optionsApi.getRisk(
        selectedContract!.symbol,
        selectedContract!.option_type === "call" ? "bull_call_debit" : "cash_secured_put",
        underlyingPrice
      ),
    enabled: !!selectedContract,
  });

  // ── Execute from chain selection (Pro mode) ───────────────────────────────────
  const executeFromChain = useMutation({
    mutationFn: () => {
      if (!selectedContract) throw new Error("No contract selected");
      const strategy =
        selectedContract.option_type === "call" ? "bull_call_debit" : "bear_put_debit";
      return optionsApi.execute({
        symbol,
        strategy,
        legs: [
          {
            symbol: selectedContract.symbol,
            strike: selectedContract.strike,
            option_type: selectedContract.option_type,
            expiration: selectedContract.expiration,
            delta: selectedContract.delta,
            theta: selectedContract.theta,
          },
        ],
        iv_rank: ivRank?.iv_rank ?? 0,
        iv_percentile: ivRank?.iv_percentile ?? 0,
        underlying_trend: selectedContract.option_type === "call" ? "bullish" : "bearish",
        confidence: 0.5,
        dry_run: dryRun,
        underlying_price: underlyingPrice,
      });
    },
    onSuccess: (result) => {
      toast.success(result.dry_run ? "Paper trade placed!" : "Live trade submitted!", {
        description: `${selectedContract?.symbol} · ${selectedContract?.option_type?.toUpperCase()}`,
      });
      queryClient.invalidateQueries({ queryKey: ["options-positions"] });
      queryClient.invalidateQueries({ queryKey: ["options-portfolio-greeks"] });
    },
    onError: (err: Error) => {
      toast.error("Could not place trade", { description: err.message });
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────────

  const filteredSignals = useMemo(() => {
    if (!signals) return [];
    if (direction === "all") return signals;
    return signals.filter((s) => s.underlying_trend === direction);
  }, [signals, direction]);

  const unblocked = useMemo(() => filteredSignals.filter((s) => !s.blocked), [filteredSignals]);
  const blocked = useMemo(() => filteredSignals.filter((s) => s.blocked), [filteredSignals]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleSymbolSearch() {
    const s = symbolInput.trim().toUpperCase();
    if (s) {
      setSymbol(s);
      setSelectedExpiration("");
      setSelectedContract(null);
    }
  }

  function handleLiveToggle(wantLive: boolean) {
    if (wantLive) {
      setShowLiveDialog(true);
    } else {
      setDryRun(true);
    }
  }

  function confirmLive() {
    setDryRun(false);
    setShowLiveDialog(false);
  }

  function switchToProForSymbol(sym: string) {
    setSymbolInput(sym);
    setSymbol(sym);
    setSelectedExpiration("");
    setViewMode("pro");
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1600px] mx-auto">

      {/* ── Universal header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Symbol search */}
        <div className="flex items-center gap-2">
          <Input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleSymbolSearch()}
            placeholder="Symbol…"
            className="w-28 h-8 text-sm font-mono bg-zinc-900 border-zinc-700"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={handleSymbolSearch}
          >
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Mode toggle — Beginner / Pro */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-700 p-0.5 bg-zinc-900">
          <button
            onClick={() => setViewMode("beginner")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "beginner"
                ? "bg-zinc-700 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Beginner
          </button>
          <button
            onClick={() => setViewMode("pro")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              viewMode === "pro"
                ? "bg-zinc-700 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Gauge className="w-3.5 h-3.5" />
            Pro
          </button>
        </div>

        {/* Paper / Live mode selector */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-zinc-700 p-0.5 bg-zinc-900">
          <button
            onClick={() => handleLiveToggle(false)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              dryRun
                ? "bg-amber-900/60 text-amber-300 border border-amber-700"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <FlaskConical className="w-3 h-3" />
            Paper
          </button>
          <button
            onClick={() => handleLiveToggle(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
              !dryRun
                ? "bg-red-900/60 text-red-300 border border-red-700"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Radio className="w-3 h-3" />
            Live
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          BEGINNER MODE
      ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === "beginner" && (
        <div className="flex flex-col gap-5">

          {/* Paper mode info banner */}
          {dryRun && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-800/30 bg-amber-900/10 px-4 py-3">
              <FlaskConical className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm text-amber-300 font-medium">You&apos;re in Paper Trading mode</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  All trades are simulated — no real money at risk. Switch to Live when you&apos;re ready.
                </p>
              </div>
            </div>
          )}

          {/* Direction picker */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-200">
                What do you think <span className="text-[#44DFA3]">{symbol}</span> will do?
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Choose a direction to see matching trade recommendations
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {DIRECTIONS.map(({ key, label, sublabel, icon: Icon, activeClass, iconClass }) => (
                <button
                  key={key}
                  onClick={() => setDirection(direction === key ? "all" : key)}
                  className={cn(
                    "group rounded-xl border p-4 flex flex-col items-center gap-2 text-center transition-all duration-200 shadow-lg",
                    direction === key
                      ? activeClass
                      : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                      direction === key ? "bg-zinc-900/60" : "bg-zinc-800/60 group-hover:bg-zinc-800"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-5 h-5 transition-colors",
                        direction === key ? iconClass : "text-zinc-500 group-hover:text-zinc-400"
                      )}
                    />
                  </div>
                  <div>
                    <div
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        direction === key ? "text-zinc-100" : "text-zinc-400 group-hover:text-zinc-300"
                      )}
                    >
                      {label}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">{sublabel}</div>
                  </div>
                </button>
              ))}
            </div>

            {direction !== "all" && (
              <button
                onClick={() => setDirection("all")}
                className="self-start text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                ✕ Clear selection — show all
              </button>
            )}
          </div>

          {/* Trade recommendations */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-300">
                {direction === "all"
                  ? "Recommended Trades"
                  : `Recommended ${direction.charAt(0).toUpperCase() + direction.slice(1)} Trades`}
                {!loadingSignals && unblocked.length > 0 && (
                  <span className="ml-2 text-xs text-zinc-600 font-normal">
                    {unblocked.length} available
                  </span>
                )}
              </h2>
              {loadingSignals && (
                <RefreshCw className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
              )}
            </div>

            {loadingSignals ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                ))}
              </div>
            ) : unblocked.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unblocked.map((signal, i) => (
                  <BeginnerTradeCard
                    key={`${signal.symbol}-${signal.strategy}-${i}`}
                    signal={signal}
                    dryRun={dryRun}
                    underlyingPrice={underlyingPrice}
                    onApproved={() => {
                      queryClient.invalidateQueries({ queryKey: ["options-positions"] });
                      queryClient.invalidateQueries({ queryKey: ["options-portfolio-greeks"] });
                    }}
                    onViewDetails={switchToProForSymbol}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8 text-center flex flex-col items-center gap-3">
                <div className="text-2xl">📡</div>
                <p className="text-sm text-zinc-400 font-medium">
                  {direction !== "all"
                    ? `No ${direction} trades found right now`
                    : "No signal-based trades available right now"}
                </p>
                <p className="text-xs text-zinc-600 max-w-xs">
                  Signals refresh every 60 seconds and require Alpaca API keys with options access.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  {direction !== "all" && (
                    <button
                      onClick={() => setDirection("all")}
                      className="text-xs text-[#44DFA3] hover:text-[#44DFA3]/80 transition-colors border border-[#44DFA3]/30 hover:border-[#44DFA3]/50 rounded-lg px-3 py-1.5"
                    >
                      Show all directions →
                    </button>
                  )}
                  <button
                    onClick={() => setViewMode("pro")}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700 hover:border-zinc-600 rounded-lg px-3 py-1.5"
                  >
                    Trade manually in Pro View →
                  </button>
                </div>
              </div>
            )}

            {/* Blocked signals — collapsed at bottom */}
            {blocked.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 py-1">
                  <span className="group-open:rotate-90 transition-transform inline-block">›</span>
                  {blocked.length} trade{blocked.length !== 1 ? "s" : ""} currently blocked by risk rules
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                  {blocked.map((signal, i) => (
                    <BeginnerTradeCard
                      key={`blocked-${signal.symbol}-${i}`}
                      signal={signal}
                      dryRun={dryRun}
                      underlyingPrice={underlyingPrice}
                      onViewDetails={switchToProForSymbol}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* Open positions summary */}
          {positions && positions.length > 0 && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-300">
                  Your Open Trades
                  <span className="ml-2 text-xs text-zinc-600 font-normal">
                    {positions.length} position{positions.length !== 1 ? "s" : ""}
                  </span>
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                {positions.map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold text-zinc-200 text-sm">{pos.symbol}</span>
                      <span className="text-xs text-zinc-500 truncate">
                        {pos.strategy.replace(/_/g, " ")}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border shrink-0",
                          pos.dry_run
                            ? "border-amber-800/50 text-amber-500 bg-amber-900/10"
                            : "border-red-800/50 text-red-400 bg-red-900/10"
                        )}
                      >
                        {pos.dry_run ? "Paper" : "Live"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs font-mono">
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-600">Max Win</div>
                        <div className="text-emerald-400">+${pos.max_profit.toFixed(0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-600">Max Loss</div>
                        <div className="text-red-400">${pos.max_loss.toFixed(0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-zinc-600">Win %</div>
                        <div className="text-zinc-300">
                          {(pos.probability_of_profit * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pro-view nudge */}
          <div className="flex items-center justify-center gap-3 py-2 text-xs text-zinc-600">
            <span>Want the full options chain, Greeks, and P&L charts?</span>
            <button
              onClick={() => setViewMode("pro")}
              className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
            >
              Switch to Pro view →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PRO MODE — four-panel terminal layout
      ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === "pro" && (
        <>
          {/* Pro header controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Expiration picker */}
            {expirations && expirations.expirations.length > 0 && (
              <select
                value={selectedExpiration}
                onChange={(e) => setSelectedExpiration(e.target.value)}
                className="h-8 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 px-2 font-mono"
              >
                {expirations.expirations.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {/* Underlying price */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Underlying $</span>
              <Input
                type="number"
                value={underlyingPrice}
                onChange={(e) => setUnderlyingPrice(parseFloat(e.target.value) || 100)}
                className="w-24 h-8 text-sm font-mono bg-zinc-900 border-zinc-700"
                step="0.01"
                min="0.01"
              />
            </div>
          </div>

          {/* Four-panel grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Scanner — top-left */}
            <div className={PANEL_CARD}>
              <div className="flex items-center justify-between">
                <span className={PANEL_TITLE}>Options Chain — {symbol}</span>
                {loadingChain && (
                  <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin" />
                )}
              </div>
              {loadingChain ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : chain && chain.length > 0 ? (
                <div className="overflow-auto max-h-[420px]">
                  <OptionsChainTable
                    contracts={chain}
                    underlyingPrice={underlyingPrice}
                    ivRank={ivRank?.iv_rank ?? 0}
                    ivPercentile={ivRank?.iv_percentile ?? 0}
                    onSelectContract={setSelectedContract}
                  />
                </div>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-8">
                  {selectedExpiration
                    ? `No chain data for ${symbol} ${selectedExpiration}`
                    : "Select an expiration date to load the chain"}
                </p>
              )}
            </div>

            {/* Greeks — top-right */}
            <div className={PANEL_CARD}>
              <span className={PANEL_TITLE}>Portfolio Greeks</span>
              {greeks && positions ? (
                <GreeksDashboard greeks={greeks} positions={positions} />
              ) : (
                <div className="space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}
            </div>

            {/* P&L — bottom-left */}
            <div className={PANEL_CARD}>
              <div className="flex items-center justify-between">
                <span className={PANEL_TITLE}>
                  P&amp;L Model
                  {selectedContract && (
                    <span className="ml-2 font-mono text-zinc-300 normal-case">
                      {selectedContract.symbol} ${selectedContract.strike}{" "}
                      {selectedContract.option_type}
                    </span>
                  )}
                </span>
                {selectedContract && (
                  <span className="text-[10px] text-zinc-500">
                    Click &quot;Place Trade&quot; to execute
                  </span>
                )}
              </div>
              <PLChart riskModel={riskModel ?? null} underlyingPrice={underlyingPrice} />

              {/* Buy button for selected contract */}
              {selectedContract ? (
                <div className="pt-2 border-t border-zinc-800 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span className="font-mono text-zinc-300">{selectedContract.symbol}</span>
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded border border-zinc-700 text-zinc-400">
                      {selectedContract.option_type}
                    </span>
                    <span>Strike ${selectedContract.strike}</span>
                    <span className="ml-auto text-zinc-600">
                      Bid {selectedContract.bid.toFixed(2)} / Ask {selectedContract.ask.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => executeFromChain.mutate()}
                    disabled={executeFromChain.isPending}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all",
                      dryRun
                        ? "bg-[#44DFA3]/10 hover:bg-[#44DFA3]/20 border border-[#44DFA3]/40 text-[#44DFA3]"
                        : "bg-red-900/25 hover:bg-red-900/40 border border-red-700/50 text-red-300",
                      executeFromChain.isPending && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {executeFromChain.isPending
                      ? "Placing…"
                      : dryRun
                      ? `Place Paper Trade — ${selectedContract.option_type === "call" ? "Buy Call" : "Buy Put"}`
                      : `Place Live Trade — ${selectedContract.option_type === "call" ? "Buy Call" : "Buy Put"}`}
                  </button>
                </div>
              ) : (
                <div className="pt-2 border-t border-zinc-800 text-xs text-zinc-600 text-center">
                  Click any contract in the Options Chain to select it, then place a trade here.
                </div>
              )}
            </div>

            {/* Signals — bottom-right */}
            <div className={PANEL_CARD}>
              <div className="flex items-center justify-between">
                <span className={PANEL_TITLE}>Signal Feed</span>
                {loadingSignals && (
                  <RefreshCw className="w-3 h-3 text-zinc-600 animate-spin" />
                )}
              </div>
              <div className="flex flex-col gap-2 overflow-auto max-h-[520px]">
                {loadingSignals ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 w-full" />
                  ))
                ) : signals && signals.length > 0 ? (
                  signals.map((signal, i) => (
                    <SignalCard
                      key={`${signal.symbol}-${i}`}
                      signal={signal}
                      riskModel={null}
                      dryRun={dryRun}
                      onViewChain={(sym) => {
                        setSymbolInput(sym);
                        setSymbol(sym);
                        setSelectedExpiration("");
                      }}
                      onApproved={() => {
                        queryClient.invalidateQueries({ queryKey: ["options-positions"] });
                        queryClient.invalidateQueries({
                          queryKey: ["options-portfolio-greeks"],
                        });
                      }}
                    />
                  ))
                ) : (
                  <p className="text-sm text-zinc-500 text-center py-8">
                    No signals generated yet. Signals refresh every 60 seconds.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Live trading confirmation dialog ─────────────────────────────────── */}
      <Dialog open={showLiveDialog} onOpenChange={setShowLiveDialog}>
        <DialogContent className="bg-zinc-950 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              Enable Live Options Trading?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-zinc-400 text-sm space-y-2 pt-2">
                <p>
                  You are about to switch from paper simulation to{" "}
                  <strong className="text-zinc-200">live order execution</strong>. Approved signals
                  will be submitted directly to your broker using real funds.
                </p>
                <p>
                  Options trading carries significant risk including the potential loss of your entire
                  investment. This platform is for educational purposes only and does not constitute
                  financial advice.
                </p>
                <p>Ensure your broker account is configured and funded before proceeding.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowLiveDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-red-700 hover:bg-red-600 text-white"
              onClick={confirmLive}
            >
              I understand — Enable Live
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
