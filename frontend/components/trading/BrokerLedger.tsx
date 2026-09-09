"use client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { liveApi } from "@/lib/api";
import {
  cn, formatCurrency, formatDateTime, getErrorMessage
} from "@/lib/utils";
import {
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";


import type { BrokerOrder, PositionSnapshot } from "@/types";
import { CollapsibleSection } from "./desk-components";
export function BrokerLedger({ positions, orders, positionsLoading, ordersLoading, refreshData }: {
  positions: PositionSnapshot[]; orders: BrokerOrder[]; positionsLoading: boolean; ordersLoading: boolean; refreshData: () => void;
}) {
  const [positionsOpen, setPositionsOpen] = useState(true);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  async function checkStatus(key: string) {
    setChecking(key);
    try { await liveApi.reconcile(key); refreshData(); }
    catch (error) { toast.error(getErrorMessage(error, "Could not confirm order status")); }
    finally { setChecking(null); }
  }
  const openPositionCount = positions.filter(p => p.is_open).length;
  return <>
        <CollapsibleSection
          title="Open Positions"
          count={openPositionCount}
          open={positionsOpen}
          onToggle={() => setPositionsOpen(!positionsOpen)}
          action={
            <button
              type="button"
              onClick={refreshData}
              className="flex items-center gap-1 text-3xs text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          }
        >
          {positionsLoading ? (
            <Skeleton className="h-24 w-full bg-surface-mid" />
          ) : positions.filter((p) => p.is_open).length === 0 ? (
            <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
              No open positions
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
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Mark Price</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Unrealized PnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.filter((p) => p.is_open).map((pos) => (
                    <TableRow key={pos.id} className="border-border/5 hover:bg-surface-low">
                      <TableCell className="font-mono text-xs">{pos.symbol}</TableCell>
                      <TableCell className="text-2xs">{pos.position_side}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{pos.quantity}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatCurrency(pos.avg_entry_price)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {pos.mark_price ? formatCurrency(pos.mark_price) : "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {pos.unrealized_pnl !== null ? (
                          <span className={pos.unrealized_pnl >= 0 ? "text-primary" : "text-destructive"}>
                            {formatCurrency(pos.unrealized_pnl)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleSection>

      {/* ── Order History ── */}
        <CollapsibleSection
          title="Order History"
          count={orders.length}
          open={ordersOpen}
          onToggle={() => setOrdersOpen(!ordersOpen)}
        >
          {ordersLoading ? (
            <Skeleton className="h-24 w-full bg-surface-mid" />
          ) : orders.length === 0 ? (
            <p className="text-2xs text-muted-foreground py-4 text-center uppercase tracking-widest">
              No orders yet
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/10">
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Symbol</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Side</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground text-right">Fill Price</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Type</TableHead>
                    <TableHead className="text-3xs uppercase tracking-widest text-muted-foreground">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className="border-border/5 hover:bg-surface-low">
                      <TableCell className="font-mono text-xs">{order.symbol}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-3xs font-bold uppercase px-1.5 py-0.5 rounded-sm",
                            order.side === "buy"
                              ? "text-primary bg-primary/10"
                              : "text-destructive bg-destructive/10"
                          )}
                        >
                          {order.side?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-2xs">
                        {order.status}
                        {order.client_order_id && !order.dry_run && !["filled", "canceled", "expired", "rejected", "not_implemented"].includes(order.status ?? "submission_unknown") && (
                          <Button variant="ghost" size="sm" disabled={checking !== null} onClick={() => checkStatus(order.client_order_id!)}>Check status</Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {order.notional_usd
                          ? formatCurrency(order.notional_usd)
                          : order.filled_quantity ?? order.quantity ?? "-"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {order.filled_price ? formatCurrency(order.filled_price) : "-"}
                      </TableCell>
                      <TableCell className="text-2xs">
                        {order.dry_run && (
                          <span className="text-3xs font-bold uppercase bg-surface-high text-muted-foreground px-1 py-0.5 rounded-sm mr-1">DRY</span>
                        )}
                        {order.order_type}
                      </TableCell>
                      <TableCell className="text-2xs text-muted-foreground">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CollapsibleSection>


</>;
}
