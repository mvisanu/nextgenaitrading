"use client";
import { readAccountData,useAccountStorage,writeAccountData,type AccountId } from "@/lib/account-storage";
import { liveApi } from "@/lib/api";
import { ApiError } from "@/lib/http";
import type { PaperOrder,PaperTrade } from "@/lib/paper-engine";
import type { BrokerOrder,ExecuteOrderRequest } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { z } from "zod";

const requestSchema = z.object({
  client_order_id: z.string().uuid(), symbol: z.string().min(1), side: z.enum(["buy", "sell"]),
  notional_usd: z.number().finite().positive(), credential_id: z.number().int().positive(),
  dry_run: z.boolean(), strategy_run_id: z.number().int().positive().optional(), mode_name: z.string().optional(),
});
const contextSchema = z.object({
  accountId: z.union([z.string(), z.number()]), timeframe: z.string(), mode: z.string(),
  signal: z.string().nullable().optional(), confirmationCount: z.number().nullable().optional(),
});
export const pendingOrderSchema = z.object({ request: requestSchema, context: contextSchema }).nullable();
const KEY = "pending-order";
type Context = z.infer<typeof contextSchema>;
export type ExecutedOrder = BrokerOrder & {
  _context: Context; _paper?: boolean; _realizedPnl?: number | null; _action?: string; _tradeId?: string;
};
type PaperResult = { success: true; trade: PaperTrade } | { success: false; error: string };

export function useOrderExecution(options: {
  accountId: AccountId; symbol: string; credentialId: number | null; isPaper: boolean; dryRun: boolean;
  price?: number; timeframe: string; mode: string; signal?: string | null;
  confirmationCount?: number | null; strategyRunId?: number;
  executePaperOrder: (order: PaperOrder) => PaperResult;
  onSuccess: (order: ExecutedOrder) => void; onError: (error: Error) => void;
}) {
  const locked = useRef(false);
  const [pending] = useAccountStorage(options.accountId, KEY, pendingOrderSchema, null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (values: { side: "buy" | "sell"; amount: number } | "recover"): Promise<ExecutedOrder> => {
      if (locked.current) throw new Error("An order request is already in progress");
      locked.current = true;
      try {
        if (options.accountId == null) throw new Error("Sign in before placing an order");
        const saved = readAccountData(options.accountId, KEY, pendingOrderSchema, null);
        if (values !== "recover" && saved) throw new Error("Recover the saved order before starting another");
        if (values === "recover" && !saved) throw new Error("No saved order to recover");
        const context: Context = saved?.context ?? {
          accountId: options.accountId, timeframe: options.timeframe, mode: options.mode,
          signal: options.signal, confirmationCount: options.confirmationCount,
        };
        if (values !== "recover") {
          if (!Number.isFinite(values.amount) || values.amount <= 0) throw new Error("Enter a valid order amount");
          if (!/^[A-Z][A-Z0-9./-]{0,14}$/.test(options.symbol)) throw new Error("Enter a valid stock symbol");
          if (options.isPaper) {
            const result = options.executePaperOrder({ symbol: options.symbol, side: values.side, notionalUsd: values.amount, currentPrice: options.price ?? 0 });
            if (!result.success) throw new Error(result.error);
            const trade = result.trade;
            return { id: 0, symbol: trade.symbol, side: trade.side, order_type: "market", quantity: trade.quantity,
              notional_usd: trade.notionalUsd, filled_quantity: trade.quantity, filled_price: trade.price,
              broker_order_id: null, status: "filled", mode_name: options.mode, dry_run: true, error_message: null,
              created_at: trade.timestamp, _paper: true, _context: context, _tradeId: trade.id,
              _realizedPnl: trade.realizedPnl, _action: trade.action };
          }
        }
        const request = saved?.request ?? requestSchema.parse({
          client_order_id: crypto.randomUUID(), symbol: options.symbol,
          side: values !== "recover" ? values.side : undefined,
          notional_usd: values !== "recover" ? values.amount : undefined,
          credential_id: options.credentialId, dry_run: options.dryRun,
          strategy_run_id: options.strategyRunId, mode_name: options.mode,
        });
        writeAccountData(options.accountId, KEY, pendingOrderSchema, { request, context });
        let order: BrokerOrder;
        try {
          // Replaying this exact ID either reserves the original intent or reconciles it.
          order = await liveApi.execute(request as ExecuteOrderRequest);
        } catch (error) {
          if (error instanceof ApiError && [400, 401, 403, 422, 429].includes(error.status)) {
            writeAccountData(options.accountId, KEY, pendingOrderSchema, null);
          }
          throw error;
        }
        if (["submitting", "submission_unknown"].includes(order.status ?? "submission_unknown")) {
          throw new Error("Broker status is unconfirmed. Recover the saved order before placing another.");
        }
        writeAccountData(options.accountId, KEY, pendingOrderSchema, null);
        if (["error", "rejected", "not_implemented", "canceled", "expired"].includes(order.status ?? "submission_unknown")) {
          throw new Error(order.error_message || `Order ${order.status}. Review order history for any partial fills.`);
        }
        return { ...order, _context: context };
      } finally { locked.current = false; }
    },
    onSuccess: options.onSuccess,
    onError: options.onError,
  });
  return { executeOrder: mutation.mutate, isExecuting: mutation.isPending, pendingOrder: pending, recoverOrder: () => mutation.mutate("recover") };
}
