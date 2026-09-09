import { journalCSV, journalMode, summarizeJournal } from "@/lib/journal-summary";
import { tradeLogSchema, type TradeLogEntry } from "@/lib/tradeLog";

function entry(patch: Partial<TradeLogEntry> = {}): TradeLogEntry {
  return { id: "1", date: "2026-09-09", pair: "NVDA", type: "Paper Order", strategy: "conservative", timeframe: "1d", position: "Long", outcome: "", netPnl: null, totalFees: null, rFactor: null, riskPct: null, confidence: null, rangePct: null, limit: null, duration: "", preNotes: "", executionMode: "paper", ...patch };
}
test("paper and live performance are separate, previews and missing P&L cannot inflate results", () => {
  const groups = summarizeJournal([
    entry({ netPnl: 25 }), entry({ netPnl: -5 }), entry(),
    entry({ executionMode: "live", netPnl: -50 }),
    entry({ executionMode: "dry-run", netPnl: 10000 }),
  ]);
  expect(groups.find(g => g.mode === "paper")).toMatchObject({ recorded: 3, closed: 2, wins: 1, pnl: 20 });
  expect(groups.find(g => g.mode === "live")).toMatchObject({ closed: 1, wins: 0, pnl: -50 });
  expect(groups).toHaveLength(2);
});
test("manual entries without provenance are never silently classified as live", () => {
  expect(journalMode(entry({ executionMode: undefined, type: "Swing", source: "manual", dryRun: false }))).toBe("unknown");
  expect(journalMode(entry({ executionMode: undefined, dryRun: true }))).toBe("paper");
});
test("strategy survives validation and CSV safely preserves multiline notes", () => {
  const trade = entry({ strategy: "squeeze", preNotes: '=SUM(1,2)\n"notes"', netPnl: -25 });
  expect(tradeLogSchema.parse([trade])[0].strategy).toBe("squeeze");
  const csv = journalCSV([trade]);
  expect(csv).toContain('"\'=SUM(1,2)\n""notes"""');
  expect(csv).toContain('"-25"');
});
