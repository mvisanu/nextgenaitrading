"use client";
import { useAuth } from "@/components/layout/AppShell";
import { autoBuyApi, brokerApi } from "@/lib/api";
import { logAutoBuyTrade } from "@/lib/tradeLog";
import {
  getErrorMessage
} from "@/lib/utils";
import type {
  AutoBuyDryRunResult
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";



import { LIVE_REFRESH_MS, refreshTrading, tradingKeys } from "@/lib/trading-queries";
export function useAutoBuySettings(dryRunTicker: string, setDryRunResult: (result: AutoBuyDryRunResult) => void) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useQuery({
    queryKey: tradingKeys.settings(user?.id),
    queryFn: autoBuyApi.getSettings,
    enabled: !!user,
  });

  const { data: decisionLog = [], isLoading: logLoading } = useQuery({
    queryKey: tradingKeys.decisions(user?.id),
    queryFn: () => autoBuyApi.decisionLog(50),
    refetchInterval: LIVE_REFRESH_MS,
    enabled: !!user,
  });

  const { data: brokerCredentials = [] } = useQuery({
    queryKey: tradingKeys.credentials(user?.id),
    queryFn: brokerApi.list,
    enabled: !!user,
  });

  const { mutate: updateSettings, isPending: isSaving } = useMutation({
    mutationFn: autoBuyApi.updateSettings,
    scope: { id: `auto-buy-settings-${user?.id}` },
    onSuccess: () => {
      void refreshTrading(queryClient, user?.id);
      toast.success("Settings saved");
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to save settings"));
    },
  });

  const { mutate: runDryRun, isPending: isDryRunning } = useMutation({
    mutationFn: async () => ({ result: await autoBuyApi.dryRun(dryRunTicker.trim().toUpperCase()), accountId: user?.id }),
    onSuccess: ({ result, accountId }) => {
      void refreshTrading(queryClient, accountId);
      setDryRunResult(result);
      toast.success(`Dry run complete for ${result.ticker}`);

      const reasonCodes = (result.reason_codes ?? []).map((code: any) =>
        typeof code === "string" ? code : `${code.check}: ${code.result}`
      );
      try { logAutoBuyTrade({
        accountId,
        ticker: result.ticker,
        state: result.decision_state,
        dryRun: true,
        reasonCodes,
        confidenceScore:
          typeof result.signal_payload?.confidence_score === "number"
            ? result.signal_payload.confidence_score
            : null,
        currentPrice:
          typeof result.signal_payload?.current_price === "number"
            ? result.signal_payload.current_price
            : null,
        orderAmount:
          typeof result.order_payload?.notional_usd === "number"
            ? result.order_payload.notional_usd
            : null,
      }); } catch { toast.error("Dry run completed, but the browser journal could not be saved."); }
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Dry run failed"));
    },
  });


  return { settings, settingsLoading, settingsError, decisionLog, logLoading, brokerCredentials, updateSettings, isSaving, runDryRun, isDryRunning };
}
