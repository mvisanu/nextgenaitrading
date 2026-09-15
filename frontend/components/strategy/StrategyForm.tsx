"use client";

import type { TradingSelection } from "@/lib/trading-selection";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import type { StrategyMode,Timeframe } from "@/types";
import { Loader2,Play,SlidersHorizontal } from "lucide-react";

const schema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(20, "Symbol too long")
    .transform((v) => v.trim().toUpperCase()),
  timeframe: z.enum(["1h", "4h", "1d", "1wk", "1mo"]),
  investment_amount: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().positive("Must be a positive amount").optional()
  ),
  leverage: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : Number(v)),
    z.number().positive().max(10).optional()
  ),
  dry_run: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const MODE_DEFAULTS: Record<
  StrategyMode,
  { leverage: string; description: string }
> = {
  squeeze: { leverage: "2.5", description: "Bollinger Band compression and breakout ? 6/8 confirmations" },
  conservative: {
    leverage: "2.5",
    description: "Leverage 2.5x · 7/8 signal confirmations · HMM regime",
  },
  aggressive: {
    leverage: "4.0",
    description: "Leverage 4.0x · 5/8 confirmations · 5% trailing stop",
  },
  "ai-pick": {
    leverage: "-",
    description: "Runs 12 MACD/RSI/EMA variants · selects best by risk-adjusted score",
  },
  "buy-low-sell-high": {
    leverage: "-",
    description: "Runs 8 dip/cycle variants · selects best by composite score",
  },
};

interface StrategyFormProps {
  mode: StrategyMode;
  defaultSymbol?: string;
  defaultTimeframe?: string;
  onContextChange?: (patch: Partial<TradingSelection>) => unknown;
  onSubmit: (values: {
    symbol: string;
    timeframe: Timeframe;
    mode: StrategyMode;
    investment_amount?: number;
    leverage?: number;
    dry_run: boolean;
  }) => void;
  isLoading?: boolean;
}

export function StrategyForm({
  mode,
  defaultSymbol = "",
  defaultTimeframe = "1d",
  onSubmit,
  onContextChange,
  isLoading = false,
}: StrategyFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symbol: defaultSymbol,
      timeframe: defaultTimeframe as FormValues["timeframe"],
      dry_run: true,
    },
  });


  useEffect(() => { setValue("symbol", defaultSymbol); }, [defaultSymbol, setValue]);
  useEffect(() => { setValue("timeframe", defaultTimeframe as FormValues["timeframe"]); }, [defaultTimeframe, setValue]);
  const unsupportedTimeframe = !["1h", "4h", "1d", "1wk", "1mo"].includes(defaultTimeframe);
  const leverageVal = watch("leverage");
  const modeInfo = MODE_DEFAULTS[mode];
  const isOptimizer = mode === "ai-pick" || mode === "buy-low-sell-high";

  function handleFormSubmit(values: FormValues) {
    onSubmit({
      symbol: values.symbol,
      timeframe: values.timeframe as Timeframe,
      mode,
      investment_amount: values.investment_amount,
      leverage: values.leverage,
      dry_run: true,
    });
  }

  const displayLeverage = leverageVal ?? modeInfo.leverage;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      {/* Parameters section */}
      <section className="bg-surface-low rounded-lg border border-border/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
            Parameters
          </p>
        </div>

        <div className="p-4 space-y-4">
          {/* Investment Amount */}
          <div className="space-y-1.5">
            <label className="text-3xs uppercase tracking-widest text-muted-foreground font-bold">
              Investment Amount (USD)
            </label>
            <div className="flex items-center bg-surface-highest border border-border/30 rounded focus-within:border-primary/60 transition-colors">
              <span className="text-muted-foreground text-sm pl-3 pr-1 select-none">$</span>
              <input
                type="number"
                step="100"
                min="1"
                placeholder="10,000"
                className="bg-transparent border-none outline-none text-sm font-bold tabular-nums w-full py-2.5 pr-3 text-foreground placeholder:text-muted-foreground/40"
                {...register("investment_amount")}
                disabled={isLoading}
                data-testid={`investment-amount-${mode}`}
              />
            </div>
            {errors.investment_amount ? (
              <p className="text-2xs text-destructive">
                {errors.investment_amount.message?.toString()}
              </p>
            ) : (
              <p className="text-3xs text-muted-foreground">
                Leave blank for $10,000 default.
              </p>
            )}
          </div>

          {/* Symbol + Timeframe row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor={`symbol-${mode}`}
                className="text-3xs uppercase tracking-widest text-muted-foreground font-bold"
              >
                Symbol
              </label>
              <input
                id={`symbol-${mode}`}
                type="text"
                placeholder="AAPL"
                className="w-full bg-surface-highest border border-border/30 rounded outline-none text-sm font-bold font-mono py-2.5 px-3 focus:border-primary/60 transition-colors text-foreground placeholder:text-muted-foreground/40"
                {...register("symbol", { onBlur: event => onContextChange?.({ symbol: event.target.value.trim().toUpperCase() }) })}
                disabled={isLoading}
                data-testid={`symbol-input-${mode}`}
              />
              {errors.symbol && (
                <p className="text-2xs text-destructive">{errors.symbol.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`timeframe-${mode}`}
                className="text-3xs uppercase tracking-widest text-muted-foreground font-bold"
              >
                Timeframe
              </label>
              <Select
                value={watch("timeframe")}
                onValueChange={(v) => { setValue("timeframe", v as FormValues["timeframe"]); onContextChange?.({ timeframe: v as TradingSelection["timeframe"] }); }}
                disabled={isLoading}
              >
                <SelectTrigger
                  id={`timeframe-${mode}`}
                  className="h-auto py-2.5 px-3 bg-surface-highest border-border/30 text-sm font-bold focus:border-primary/60 data-[testid]"
                  data-testid={`timeframe-select-${mode}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {unsupportedTimeframe && <SelectItem value={defaultTimeframe} disabled>{defaultTimeframe} (chart only)</SelectItem>}
                  <SelectItem value="1h">1 Hour (1h)</SelectItem>
                  <SelectItem value="4h">4 Hour (4h)</SelectItem>
                  <SelectItem value="1d">Daily (1d)</SelectItem>
                  <SelectItem value="1wk">Weekly (1wk)</SelectItem>
                  <SelectItem value="1mo">Monthly (1mo)</SelectItem>
                </SelectContent>
              </Select>
              {unsupportedTimeframe && <p className="text-sm text-muted-foreground">Choose an hourly, daily, weekly, or monthly timeframe to run a reference backtest.</p>}
            </div>
          </div>

          {/* Leverage slider — non-optimizer modes only */}
          {!isOptimizer && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor={`leverage-${mode}`} className="text-3xs uppercase tracking-widest text-muted-foreground font-bold">
                  Leverage Exposure
                </label>
                <span className="text-2xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded tabular-nums">
                  {displayLeverage !== "-" && displayLeverage !== undefined
                    ? `${displayLeverage}x`
                    : `${modeInfo.leverage}x`}
                </span>
              </div>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                defaultValue={modeInfo.leverage === "-" ? "2.5" : modeInfo.leverage}
                className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                {...register("leverage")}
                disabled={isLoading}
                id={`leverage-${mode}`}
                data-testid={`leverage-${mode}`}
              />
              {errors.leverage && (
                <p className="text-2xs text-destructive">
                  {errors.leverage.message?.toString()}
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted-foreground">Historical simulation only. No orders are placed.</p>
        </div>
      </section>

      {/* Run button */}
      <button
        type="submit"
        disabled={isLoading}
        className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-black uppercase tracking-widest py-3.5 rounded-lg text-sm shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
        data-testid={`run-strategy-${mode}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isOptimizer ? "Optimizing..." : "Running..."}
          </>
        ) : (
          <>
            <Play className="h-4 w-4 fill-current" />
            Run Simulation
          </>
        )}
      </button>

      {/* Mode description hint */}
      <p className="mt-3 text-3xs text-muted-foreground text-center">
        {modeInfo.description}
      </p>
    </form>
  );
}
