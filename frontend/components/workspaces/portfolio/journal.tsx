"use client";

import { WorkspaceSection } from "@/components/layout/WorkspaceSection";
import { JournalDetails } from "@/components/trading/JournalDetails";
import { Button } from "@/components/ui/button";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { journalCSV,journalMode,journalModeLabels,journalStrategy,summarizeJournal,type JournalMode } from "@/lib/journal-summary";
import { useTradeLog,type TradeLogEntry } from "@/lib/tradeLog";
import { cn } from "@/lib/utils";
import { Fragment,useState } from "react";

function newTrade(): TradeLogEntry {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: crypto.randomUUID(),
    date: today,
    pair: "",
    type: "",
    timeframe: "1d",
    position: "Long",
    outcome: "",
    netPnl: null,
    totalFees: null,
    rFactor: null,
    riskPct: null,
    confidence: null,
    rangePct: null,
    limit: null,
    duration: "",
    preNotes: "",
    source: "manual",
  };
}


const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function TradeLogPage() {
  const [trades, setTrades] = useTradeLog();
  const [mode, setMode] = useState<JournalMode | "all">("all");
  const [outcome, setOutcome] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = trades.filter(t => (mode === "all" || journalMode(t) === mode) && (outcome === "all" || t.outcome === outcome));
  const summaries = summarizeJournal(filtered);
  function addTrade() {
    const trade = newTrade();
    setMode("all"); setOutcome("all");
    setTrades(previous => [...previous, trade]); setExpanded(trade.id);
  }
  function exportCSV() {
    const url = URL.createObjectURL(new Blob([journalCSV(filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url;
    link.download = `trade-journal-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
    URL.revokeObjectURL(url);
  }
  return <WorkspaceSection title="Trade journal" actions={<div className="flex gap-2"><Button variant="outline" onClick={exportCSV}>Export filtered CSV</Button><Button onClick={addTrade}>New entry</Button></div>}>
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-2 text-sm">Execution mode<select aria-label="Filter execution mode" className="block min-h-11 rounded-md border border-border bg-background px-3" value={mode} onChange={e => { setMode(e.target.value as JournalMode | "all"); setExpanded(null); }}>
          <option value="all">All entries</option>{Object.entries(journalModeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label className="space-y-2 text-sm">Outcome<select aria-label="Filter outcome" className="block min-h-11 rounded-md border border-border bg-background px-3" value={outcome} onChange={e => setOutcome(e.target.value)}>
          <option value="all">All outcomes</option><option value="win">Win</option><option value="loss">Loss</option><option value="breakeven">Breakeven</option><option value="">No realized result</option>
        </select></label>
        <p className="pb-3 text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}. Open a row to edit details and notes</p>
      </div>
      <div className="overflow-x-auto">
        <Table className="block sm:table">
          <TableHeader className="sr-only sm:not-sr-only"><TableRow>{["Date", "Stock", "Strategy", "Status", "Net P&L"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody className="block sm:table-row-group">
            {!filtered.length && <TableRow className="block sm:table-row"><TableCell colSpan={5} className="block py-12 sm:table-cell text-center">
              <p className="font-medium">{trades.length ? "No entries match these filters" : "No trades recorded yet"}</p>
              <p className="mt-2 text-sm text-muted-foreground">{trades.length ? "Choose another execution mode or outcome." : "Paper trades and submitted app orders appear here. You can also add a manual entry."}</p>
            </TableCell></TableRow>}
            {[...filtered].reverse().map(trade => <Fragment key={trade.id}>
              <TableRow className="grid cursor-pointer grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-4 sm:table-row sm:py-0" onClick={() => setExpanded(expanded === trade.id ? null : trade.id)}>
                <TableCell className="col-span-2 p-0 text-xs text-muted-foreground sm:p-4 sm:text-sm">{trade.date}</TableCell>
                <TableCell className="p-0 sm:p-4"><button aria-label={`Details for ${trade.pair || "new entry"}`} aria-expanded={expanded === trade.id} className="min-h-11 font-semibold underline underline-offset-4" onClick={e => { e.stopPropagation(); setExpanded(expanded === trade.id ? null : trade.id); }}>{trade.pair || "New entry"}</button></TableCell>
                <TableCell className="col-start-1 row-start-3 break-words p-0 sm:p-4">{journalStrategy(trade)}</TableCell>
                <TableCell className="col-start-2 row-start-3 max-w-36 p-0 text-right sm:p-4 sm:text-left"><span className="block">{journalModeLabels[journalMode(trade)]}</span><span className="text-xs text-muted-foreground">{journalMode(trade) === "dry-run" ? "No execution" : trade.outcome || "No realized result"}</span></TableCell>
                <TableCell className={cn("col-start-2 row-start-2 self-center p-0 text-right tabular-nums sm:p-4", trade.netPnl != null && trade.netPnl < 0 ? "text-destructive" : "text-foreground")}><span className="mr-2 text-xs text-muted-foreground sm:hidden">Net P&L</span>{trade.netPnl == null ? "--" : money(trade.netPnl)}</TableCell>
              </TableRow>
              {expanded === trade.id && <TableRow className="block sm:table-row"><TableCell colSpan={5} className="block p-0 sm:table-cell"><JournalDetails trade={trade}
                onChange={patch => setTrades(previous => previous.map(item => item.id === trade.id ? { ...item, ...patch } : item))}
                onDelete={() => { setTrades(previous => previous.filter(item => item.id !== trade.id)); setExpanded(null); }} /></TableCell></TableRow>}
            </Fragment>)}
          </TableBody>
        </Table>
      </div>
      <section className="space-y-3 border-t border-border pt-5">
        <h2 className="text-lg font-semibold">Results by strategy</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">Based on the filtered journal entries with recorded realized P&L. Paper and live results stay separate; previews are excluded. Missing results are not counted as losses. This journal is not a complete broker statement.</p>
        <Table><TableHeader><TableRow>{["Strategy", "Mode", "Realized entries", "Win rate", "Net P&L"].map(label => <TableHead key={label}>{label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{summaries.map(group => <TableRow key={JSON.stringify([group.mode, group.strategy])}>
            <TableCell>{group.strategy}</TableCell><TableCell>{journalModeLabels[group.mode]}</TableCell><TableCell>{group.closed} / {group.recorded}</TableCell>
            <TableCell>{group.closed ? `${(group.wins / group.closed * 100).toFixed(1)}%` : "--"}</TableCell><TableCell>{group.closed ? money(group.pnl) : "--"}</TableCell>
          </TableRow>)}{!summaries.length && <TableRow><TableCell colSpan={5}>No executed or manual entries in this selection.</TableCell></TableRow>}</TableBody>
        </Table>
      </section>
    </div>
  </WorkspaceSection>;
}
