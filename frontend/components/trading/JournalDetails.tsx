"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { journalMode,journalModeLabels,journalStrategy } from "@/lib/journal-summary";
import type { TradeLogEntry } from "@/lib/tradeLog";

export function JournalDetails({ trade, onChange, onDelete }: { trade: TradeLogEntry; onChange: (patch: Partial<TradeLogEntry>) => void; onDelete: () => void }) {
  return <div className="space-y-4 bg-surface-low p-4 text-sm">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1">Date<Input aria-label="Trade date" type="date" value={trade.date} onChange={e => onChange({ date: e.target.value })} /></label>
      <label className="space-y-1">Stock<Input aria-label="Trade stock" value={trade.pair} onChange={e => onChange({ pair: e.target.value.toUpperCase() })} /></label>
      <label className="space-y-1">Strategy<Input aria-label="Trade strategy" value={trade.strategy ?? journalStrategy(trade)} onChange={e => onChange({ strategy: e.target.value })} /></label>
      <label className="space-y-1">Trade type<Input value={trade.type} onChange={e => onChange({ type: e.target.value })} /></label>
      <label className="space-y-1">Timeframe<Input value={trade.timeframe} onChange={e => onChange({ timeframe: e.target.value })} /></label>
      <label className="space-y-1">Side<select aria-label="Trade side" className="min-h-11 w-full rounded-md border border-border bg-background px-3" value={trade.position} onChange={e => onChange({ position: e.target.value as "Long" | "Short" })}><option>Long</option><option>Short</option></select></label>
      <label className="space-y-1">Outcome<select aria-label="Trade outcome" className="min-h-11 w-full rounded-md border border-border bg-background px-3" value={trade.outcome} onChange={e => onChange({ outcome: e.target.value as TradeLogEntry["outcome"] })}><option value="">No realized result</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option></select></label>
      {(trade.source === "manual" || !trade.source) && <label className="space-y-1">Execution mode<select aria-label="Recorded execution mode" className="min-h-11 w-full rounded-md border border-border bg-background px-3" value={trade.executionMode ?? ""} onChange={e => onChange({ executionMode: e.target.value ? e.target.value as TradeLogEntry["executionMode"] : undefined })}><option value="">Manual / unknown</option><option value="paper">Paper</option><option value="live">Live</option><option value="dry-run">Preview only</option></select></label>}
      {([ ["netPnl", "Net P&L"], ["amountUsd", "Amount (USD)"], ["totalFees", "Fees"], ["rFactor", "R multiple"], ["riskPct", "Risk (%)"], ["confidence", "Confidence"], ["rangePct", "Range (%)"], ["limit", "Sizing reference"] ] as const).map(([field, label]) => <label key={field} className="space-y-1">{label}
        <Input aria-label={label} type="number" step="any" defaultValue={trade[field] ?? ""} onBlur={e => {
          const number = e.target.value === "" ? null : Number(e.target.value);
          if (number != null && !Number.isFinite(number)) return;
          onChange(field === "netPnl" ? { netPnl: number, outcome: number == null ? "" : number > 0 ? "win" : number < 0 ? "loss" : "breakeven" } : { [field]: number });
        }} />
      </label>)}
      <label className="space-y-1">Duration<Input value={trade.duration} onChange={e => onChange({ duration: e.target.value })} /></label>
    </div>
    <p className="text-muted-foreground">Recorded mode: {journalModeLabels[journalMode(trade)]} · Source: {trade.source ?? "manual"}. Editing journal notes does not change broker orders.</p>
    <label className="block space-y-2">Notes<textarea aria-label="Trade notes" className="min-h-24 w-full rounded-md border border-border bg-background p-3" value={trade.preNotes} onChange={e => onChange({ preNotes: e.target.value })} /></label>
    <Button variant="outline" onClick={onDelete}>Delete journal entry</Button>
  </div>;
}
