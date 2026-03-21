"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign } from "lucide-react";
import type { StrategyMode, Timeframe } from "@/types";
import { getModeLabel } from "@/lib/utils";

const schema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(20, "Symbol too long")
    .transform((v) => v.trim().toUpperCase()),
  timeframe: z.enum(["5m", "15m", "30m", "1h", "4h", "1d", "1wk", "1mo"]),
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
  defaultTimeframe?: Timeframe;
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
  isLoading = false,
}: StrategyFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        symbol: defaultSymbol,
        timeframe: defaultTimeframe,
        dry_run: true,
      },
    });

  const dryRun = watch("dry_run");
  const modeInfo = MODE_DEFAULTS[mode];
  const isOptimizer = mode === "ai-pick" || mode === "buy-low-sell-high";

  function handleFormSubmit(values: FormValues) {
    onSubmit({
      symbol: values.symbol,
      timeframe: values.timeframe as Timeframe,
      mode,
      investment_amount: values.investment_amount,
      leverage: values.leverage,
      dry_run: values.dry_run,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
      <p className="text-sm sm:text-base text-muted-foreground">{modeInfo.description}</p>

      {/* Investment Amount — full-width prominent field */}
      <div className="space-y-2">
        <Label htmlFor={`investment-${mode}`} className="text-sm sm:text-base font-semibold flex items-center gap-1.5">
          <DollarSign className="h-4 w-4 text-primary" />
          Investment Amount (USD)
        </Label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base sm:text-lg font-semibold text-muted-foreground">$</span>
          <Input
            id={`investment-${mode}`}
            type="number"
            step="100"
            min="1"
            placeholder="10,000"
            className="pl-9 h-12 sm:h-14 text-lg sm:text-2xl font-bold tracking-tight"
            {...register("investment_amount")}
            disabled={isLoading}
          />
        </div>
        {errors.investment_amount ? (
          <p className="text-sm text-destructive">
            {errors.investment_amount.message?.toString()}
          </p>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground">
            How much capital to simulate. Leave blank for $10,000 default.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Symbol */}
        <div className="space-y-2">
          <Label htmlFor={`symbol-${mode}`} className="text-sm sm:text-base">Symbol</Label>
          <Input
            id={`symbol-${mode}`}
            placeholder="AAPL, BTC-USD, SPY, TSLA"
            className="h-11 sm:h-12 text-base sm:text-lg font-mono"
            {...register("symbol")}
            disabled={isLoading}
          />
          {errors.symbol && (
            <p className="text-sm text-destructive">{errors.symbol.message}</p>
          )}
        </div>

        {/* Timeframe */}
        <div className="space-y-2">
          <Label htmlFor={`timeframe-${mode}`} className="text-sm sm:text-base">Timeframe</Label>
          <Select
            defaultValue={defaultTimeframe}
            onValueChange={(v) => setValue("timeframe", v as Timeframe)}
            disabled={isLoading}
          >
            <SelectTrigger id={`timeframe-${mode}`} className="h-11 sm:h-12 text-base sm:text-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m" className="text-base">5 Min (5m)</SelectItem>
              <SelectItem value="15m" className="text-base">15 Min (15m)</SelectItem>
              <SelectItem value="30m" className="text-base">30 Min (30m)</SelectItem>
              <SelectItem value="1h" className="text-base">1 Hour (1h)</SelectItem>
              <SelectItem value="4h" className="text-base">4 Hour (4h)</SelectItem>
              <SelectItem value="1d" className="text-base">Daily (1d)</SelectItem>
              <SelectItem value="1wk" className="text-base">Weekly (1wk)</SelectItem>
              <SelectItem value="1mo" className="text-base">Monthly (1mo)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Leverage override (non-optimizer modes only) */}
        {!isOptimizer && (
          <div className="space-y-2">
            <Label htmlFor={`leverage-${mode}`} className="text-sm sm:text-base">
              Leverage{" "}
              <span className="text-muted-foreground">
                (default: {modeInfo.leverage}x)
              </span>
            </Label>
            <Input
              id={`leverage-${mode}`}
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              placeholder={modeInfo.leverage}
              className="h-11 sm:h-12 text-base sm:text-lg"
              {...register("leverage")}
              disabled={isLoading}
            />
            {errors.leverage && (
              <p className="text-sm text-destructive">
                {errors.leverage.message?.toString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Dry run toggle */}
      <div className="flex items-center gap-3">
        <Switch
          id={`dry-run-${mode}`}
          checked={dryRun}
          onCheckedChange={(v) => setValue("dry_run", v)}
          disabled={isLoading}
        />
        <Label htmlFor={`dry-run-${mode}`} className="text-sm sm:text-base">
          Dry Run{" "}
          <span className="text-muted-foreground">
            {dryRun ? "(simulation — no real orders)" : "(LIVE — real orders will be submitted)"}
          </span>
        </Label>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto h-11 sm:h-12 text-base sm:text-lg px-8">
        {isLoading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
        {isLoading
          ? isOptimizer
            ? "Running optimization (up to 2 min)..."
            : "Running strategy..."
          : `Run ${getModeLabel(mode)}`}
      </Button>
    </form>
  );
}
