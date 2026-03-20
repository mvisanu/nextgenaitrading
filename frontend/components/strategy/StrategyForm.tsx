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
import { Loader2 } from "lucide-react";
import type { StrategyMode, Timeframe } from "@/types";
import { getModeLabel } from "@/lib/utils";

const schema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(20, "Symbol too long")
    .transform((v) => v.trim().toUpperCase()),
  timeframe: z.enum(["1d", "1h", "4h", "1wk"]),
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
      leverage: values.leverage,
      dry_run: values.dry_run,
    });
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="text-sm text-muted-foreground">{modeInfo.description}</div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Symbol */}
        <div className="space-y-1.5">
          <Label htmlFor={`symbol-${mode}`}>Symbol</Label>
          <Input
            id={`symbol-${mode}`}
            placeholder="AAPL, BTC-USD, SPY, TSLA"
            {...register("symbol")}
            disabled={isLoading}
          />
          {errors.symbol && (
            <p className="text-xs text-destructive">{errors.symbol.message}</p>
          )}
        </div>

        {/* Timeframe */}
        <div className="space-y-1.5">
          <Label htmlFor={`timeframe-${mode}`}>Timeframe</Label>
          <Select
            defaultValue={defaultTimeframe}
            onValueChange={(v) => setValue("timeframe", v as Timeframe)}
            disabled={isLoading}
          >
            <SelectTrigger id={`timeframe-${mode}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Daily (1d)</SelectItem>
              <SelectItem value="1h">Hourly (1h)</SelectItem>
              <SelectItem value="4h">4-Hour (4h)</SelectItem>
              <SelectItem value="1wk">Weekly (1wk)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Leverage override (non-optimizer modes only) */}
        {!isOptimizer && (
          <div className="space-y-1.5">
            <Label htmlFor={`leverage-${mode}`}>
              Leverage Override{" "}
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
              {...register("leverage")}
              disabled={isLoading}
            />
            {errors.leverage && (
              <p className="text-xs text-destructive">
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
        <Label htmlFor={`dry-run-${mode}`}>
          Dry Run{" "}
          <span className="text-muted-foreground">
            {dryRun ? "(simulation — no real orders)" : "(LIVE — real orders will be submitted)"}
          </span>
        </Label>
      </div>

      <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {isLoading
          ? isOptimizer
            ? "Running optimization (up to 2 min)..."
            : "Running strategy..."
          : `Run ${getModeLabel(mode)}`}
      </Button>
    </form>
  );
}
