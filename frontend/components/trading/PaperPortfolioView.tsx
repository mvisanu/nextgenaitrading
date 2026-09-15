"use client";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import type { usePaperPortfolio } from "@/lib/paperTrading";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { CollapsibleSection,PaperStatCard } from "./desk-components";
type PaperState = ReturnType<typeof usePaperPortfolio>;
export function PaperPortfolioView({ portfolio, paperStats, onReset }: { portfolio: PaperState["portfolio"]; paperStats: PaperState["stats"]; onReset: () => void }) {
  const [paperPositionsOpen, setPaperPositionsOpen] = useState(true);
  const [paperHistoryOpen, setPaperHistoryOpen] = useState(false);
  return (
        <>
          {/* Paper stats strip */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            <PaperStatCard
              label="Cash"
              value={`$${portfolio.cashBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
              color="text-primary"
            />
            <PaperStatCard
              label="Realized P&L"
              value={`${paperStats.totalRealizedPnl >= 0 ? "+" : ""}$${paperStats.totalRealizedPnl.toFixed(2)}`}
              color={paperStats.totalRealizedPnl >= 0 ? "text-primary" : "text-destructive"}
            />
            <PaperStatCard
              label="Win Rate"
              value={paperStats.closedTradeCount > 0 ? `${paperStats.winRate.toFixed(0)}%` : "\u2014"}
              color={paperStats.winRate >= 50 ? "text-primary" : "text-muted-foreground"}
            />
            <PaperStatCard
              label="Trades"
              value={String(paperStats.closedTradeCount)}
              color="text-muted-foreground"
            />
            <div className="flex items-center justify-center">
              <button
                type="button"
                className="flex items-center gap-1.5 h-7 text-2xs text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest"
                onClick={() => onReset()}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>

          {/* Paper positions */}
          <CollapsibleSection
            title="Paper Positions"
            count={portfolio.positions.length}
            open={paperPositionsOpen}
            onToggle={() => setPaperPositionsOpen(!paperPositionsOpen)}
          >
            {portfolio.positions.length === 0 ? (
              <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
                No open paper positions — execute a paper trade above
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/10">
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Qty</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Avg Entry</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Cost / collateral</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Opened</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.positions.map((pos, i) => (
                      <TableRow key={`${pos.symbol}-${i}`} className="border-border/5 hover:bg-surface-low">
                        <TableCell className="font-mono text-xs font-semibold">{pos.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                              pos.side === "long"
                                ? "text-primary bg-primary/10"
                                : "text-destructive bg-destructive/10"
                            )}
                          >
                            {pos.side.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {pos.quantity.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${pos.avgEntry.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${(pos.quantity * pos.avgEntry).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-2xs text-muted-foreground">
                          {new Date(pos.openedAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CollapsibleSection>

          {/* Paper trade history */}
          {portfolio.trades.length > 0 && (
            <CollapsibleSection
              title="Paper Trade History"
              count={portfolio.trades.length}
              open={paperHistoryOpen}
              onToggle={() => setPaperHistoryOpen(!paperHistoryOpen)}
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/10">
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Time</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Action</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...portfolio.trades].reverse().slice(0, 20).map((trade) => (
                      <TableRow key={trade.id} className="border-border/5 hover:bg-surface-low">
                        <TableCell className="text-2xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {new Date(trade.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{trade.symbol}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                              trade.side === "buy"
                                ? "text-primary bg-primary/10"
                                : "text-destructive bg-destructive/10"
                            )}
                          >
                            {trade.side.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-2xs capitalize">{trade.action}</TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${trade.notionalUsd.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          ${trade.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono tabular-nums">
                          {trade.realizedPnl != null ? (
                            <span className={trade.realizedPnl >= 0 ? "text-primary" : "text-destructive"}>
                              {trade.realizedPnl >= 0 ? "+" : ""}${trade.realizedPnl.toFixed(2)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          )}
        </>
);
}
