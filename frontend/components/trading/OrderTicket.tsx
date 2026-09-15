"use client";

import { ALL_INTERVALS } from "@/components/dashboard/chart-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tradingHref,type TradingSelection } from "@/lib/trading-selection";
import type { BrokerCredential } from "@/types";
import Link from "next/link";
import { useEffect,useState,type ReactNode } from "react";
import { BuySellToggle } from "./desk-components";

export type TradingMode = "paper" | "dry-run" | "live";
export const executionLabels: Record<TradingMode, string> = { paper: "Paper", "dry-run": "Preview only", live: "Live" };
const descriptions: Record<TradingMode, string> = {
  paper: "Uses virtual funds saved on this device. No broker order is sent.",
  "dry-run": "Checks the order through the app without sending it to the broker. A broker connection is required; your paper balance is unchanged.",
  live: "Sends a real-money order to the selected broker account.",
};

export function OrderTicket({ selection, onSelection, tradingMode, onMode, credentials, credentialId, onCredential, loadingCredentials, cash, busy, blocked, onSubmit, children }: {
  selection: TradingSelection; onSelection: (value: Partial<TradingSelection>) => unknown;
  tradingMode: TradingMode; onMode: (value: TradingMode) => void;
  credentials: BrokerCredential[]; credentialId: number | null; onCredential: (id: number | null) => void;
  loadingCredentials: boolean; cash: number; busy: boolean; blocked: boolean;
  onSubmit: (values: { side: "buy" | "sell"; amount: number }) => void; children: ReactNode;
}) {
  const [symbol, setSymbol] = useState(selection.symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setSymbol(selection.symbol); }, [selection.symbol]);
  const value = Number(amount);
  const credential = credentials.find(item => item.id === credentialId && item.is_active);
  const symbolReady = symbol.trim().toUpperCase() === selection.symbol;
  const canSubmit = !busy && !blocked && symbolReady && (tradingMode === "paper" || !!credential);
  return <section className="space-y-5 bg-surface-low p-4">
    <h2 className="text-lg font-semibold">Prepare order</h2>
    <form className="space-y-5" onSubmit={event => {
      event.preventDefault();
      if (!canSubmit) return;
      if (!Number.isFinite(value) || value <= 0) { setError("Enter an amount greater than zero."); return; }
      setError(""); onSubmit({ side, amount: value });
    }}>
      <label className="block space-y-2 text-sm font-medium">Stock symbol
        <Input aria-label="Stock symbol" value={symbol} maxLength={20} onChange={event => setSymbol(event.target.value.toUpperCase())}
          onBlur={() => onSelection({ symbol: symbol.trim().toUpperCase() })}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); onSelection({ symbol: symbol.trim().toUpperCase() }); } }} />
      </label>
      {!symbolReady && <p role="status" className="text-sm text-muted-foreground">Enter a valid symbol and press Enter to update the order.</p>}
      <BuySellToggle value={side} onSelect={setSide} />
      <label className="block space-y-2 text-sm font-medium">Amount (USD)
        <Input type="number" min="0.01" step="0.01" aria-label="Order amount in dollars" value={amount}
          aria-invalid={!!error} aria-describedby={error ? "amount-error" : undefined}
          onChange={event => { setAmount(event.target.value); setError(""); }} />
      </label>
      {error && <p id="amount-error" role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">{[100, 250, 500, 1000].map(preset => <Button key={preset} variant="outline" size="sm" type="button" onClick={() => { setAmount(String(preset)); setError(""); }}>${preset}</Button>)}</div>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Execution mode</legend>
        <div className="flex flex-wrap gap-2">{(["paper", "dry-run", "live"] as const).map(mode => <Button key={mode} type="button"
          variant={tradingMode === mode ? mode === "live" ? "destructive" : "secondary" : "outline"}
          aria-pressed={tradingMode === mode} onClick={() => onMode(mode)}>{executionLabels[mode]}</Button>)}</div>
        <p className="text-sm text-muted-foreground">{descriptions[tradingMode]}</p>
      </fieldset>
      {(tradingMode !== "paper") && <label className="block space-y-2 text-sm font-medium">Broker account
        <select aria-label="Broker credential" value={credentialId ?? ""} disabled={loadingCredentials} onChange={event => onCredential(event.target.value ? Number(event.target.value) : null)} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
          <option value="">{loadingCredentials ? "Loading accounts…" : "Select an account"}</option>
          {credentials.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.profile_name}</option>)}
        </select>
        {!credentials.some(item => item.is_active) && !loadingCredentials && <Link className="block underline" href="/settings?view=account">Connect a broker in Settings</Link>}
      </label>}
      <div className="space-y-2 border-y border-border py-4 text-sm" aria-label="Order review">
        <p className="font-semibold">{executionLabels[tradingMode]} · {side === "buy" ? "Buy" : "Sell"} {selection.symbol}</p>
        <p>{value > 0 && Number.isFinite(value) ? `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Enter an amount"} · Market order</p>
        <p className="text-muted-foreground">{tradingMode === "paper" ? `Paper cash: $${cash.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : credential?.profile_name ?? "Select a broker account"}</p>
        <p className="text-muted-foreground">{tradingMode === "paper" ? "Opposite-side orders close up to the held quantity. The fill amount can be smaller than requested." : "The execution price is not guaranteed. Check the order ledger for confirmed fills."}</p>
      </div>
      <Button type="submit" className="min-h-12 w-full" variant={tradingMode === "live" ? "destructive" : "default"} disabled={!canSubmit}>
        {busy ? "Submitting…" : tradingMode === "dry-run" ? "Preview order" : tradingMode === "paper" ? "Place paper order" : "Submit live order"}
      </Button>
      {blocked && <p role="status" className="text-sm">Recover the pending order above before placing another.</p>}
    </form>
    <details className="border-t border-border pt-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Analysis settings · {selection.timeframe} · {selection.strategy}</summary>
      <div className="space-y-4 pt-3">
        <label className="block space-y-2 text-sm">Timeframe
          <select aria-label="Timeframe" value={selection.timeframe} onChange={event => onSelection({ timeframe: event.target.value as TradingSelection["timeframe"] })} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
            {ALL_INTERVALS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block space-y-2 text-sm">Strategy profile
          <select aria-label="Strategy profile" value={selection.strategy} onChange={event => onSelection({ strategy: event.target.value as TradingSelection["strategy"] })} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
            {["ai-pick", "buy-low-sell-high"].includes(selection.strategy) && <option value={selection.strategy}>{selection.strategy} (backtest only)</option>}
            <option value="conservative">Conservative</option><option value="aggressive">Aggressive</option><option value="squeeze">Bollinger squeeze</option>
          </select>
        </label>
        {tradingMode === "paper" && <label className="block space-y-2 text-sm">Broker connection for signal checks
          <select aria-label="Signal broker credential" value={credentialId ?? ""} disabled={loadingCredentials} onChange={event => onCredential(event.target.value ? Number(event.target.value) : null)} className="min-h-11 w-full rounded-md border border-border bg-background px-3">
            <option value="">Select a connection</option>{credentials.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.profile_name}</option>)}
          </select>
        </label>}
        {children}
        <Link href={tradingHref("/dashboard", selection)} className="inline-block py-2 text-sm underline">Open full chart</Link>
      </div>
    </details>
    <p className="text-xs text-muted-foreground">Educational software. Live trading carries risk of total loss. Past performance does not guarantee future results.</p>
  </section>;
}
