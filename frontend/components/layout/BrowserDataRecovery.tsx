"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { accountStorageKey, writeAccountData } from "@/lib/account-storage";
import { drawingSchema } from "@/lib/drawing-storage";
import { paperPortfolioSchema } from "@/lib/paper-engine";
import { tradeLogSchema } from "@/lib/tradeLog";
import { watchlistSchema } from "@/lib/watchlist";
import { holdingSchema, activitySchema } from "@/lib/manual-ledger";
import { Button } from "@/components/ui/button";

const sources = [
  { old: "ngs-drawings", name: "drawings", schema: drawingSchema },
  { old: "ngs-paper-portfolio", name: "paper-portfolio", schema: paperPortfolioSchema },
  { old: "ngs-trade-log", name: "trade-log", schema: tradeLogSchema },
  { old: "ngs-watchlist", name: "watchlist", schema: watchlistSchema },
  { old: "portfolio_holdings", name: "portfolio_holdings", schema: holdingSchema },
  { old: "portfolio_activity", name: "portfolio_activity", schema: activitySchema },
];

export function BrowserDataRecovery() {
  const { user } = useAuth();
  const [ownsData, setOwnsData] = useState(false);
  function importLegacy() {
    if (!user || !ownsData) return;
    let imported = 0, skipped = 0;
    try {
      for (const source of sources) {
        const raw = localStorage.getItem(source.old);
        if (!raw) continue;
        if (localStorage.getItem(accountStorageKey(user.id, source.name)!)) { skipped++; continue; }
        let parsed: unknown;
        try { parsed = JSON.parse(raw); } catch { skipped++; continue; }
        const result = source.schema.safeParse(parsed);
        if (!result.success) { skipped++; continue; }
        // Restore paper cash from its ledger using the corrected collateral convention.
        if (source.name === "paper-portfolio") {
          const p = paperPortfolioSchema.parse(result.data);
          p.cashBalance = p.startingBalance + p.trades.reduce((sum, trade) => sum + (trade.realizedPnl ?? 0), 0)
            - p.positions.reduce((sum, position) => sum + position.quantity * position.avgEntry, 0);
          writeAccountData(user.id, source.name, paperPortfolioSchema, p);
        } else {
          const key = accountStorageKey(user.id, source.name)!;
          localStorage.setItem(key, JSON.stringify(result.data));
          window.dispatchEvent(new Event("storage"));
        }
        imported++;
      }
      toast.info(`Imported ${imported} datasets. Skipped ${skipped} invalid or already saved datasets. Originals are preserved.`);
    } catch { toast.error("Browser storage is unavailable. Original data has been preserved."); }
  }
  function exportLegacy() {
    try {
      const values = Object.fromEntries(sources.map(s => [s.old, localStorage.getItem(s.old)]).filter(([, value]) => value !== null));
      const url = URL.createObjectURL(new Blob([JSON.stringify(values, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "older-browser-trading-data.json"; link.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Could not export browser data"); }
  }
  return <section className="mt-6 border-t border-border pt-5 space-y-3">
    <h2 className="font-semibold">Older browser data</h2>
    <p className="max-w-2xl text-sm text-muted-foreground">Saved trading data now belongs to your signed-in account. Older data remains on this browser until you choose to import it. Imports fill empty datasets only; existing account data is preserved.</p>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ownsData} onChange={e => setOwnsData(e.target.checked)} />The older data on this browser belongs to me.</label>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!user || !ownsData} onClick={importLegacy}>Import into my account</Button>
      <Button variant="ghost" disabled={!ownsData} onClick={exportLegacy}>Export older data</Button>
    </div>
  </section>;
}
