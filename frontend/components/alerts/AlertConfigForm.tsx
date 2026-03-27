"use client";

/**
 * AlertConfigForm — form to create a new price alert rule.
 *
 * Sovereign Terminal design system applied.
 */

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { alertsApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import type { AlertType } from "@/types";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  entered_buy_zone: "Entered high-probability entry zone",
  near_buy_zone: "Near entry zone (proximity threshold)",
  below_invalidation: "Price dropped below invalidation level",
  confidence_improved: "Confidence score improved",
  theme_score_increased: "Theme score increased",
  macro_deterioration: "Macro / theme deterioration",
};

const alertFormSchema = z
  .object({
    ticker: z
      .string()
      .min(1, "Ticker is required")
      .max(10, "Ticker too long")
      .transform((v) => v.toUpperCase().trim()),
    alert_type: z.enum([
      "entered_buy_zone",
      "near_buy_zone",
      "below_invalidation",
      "confidence_improved",
      "theme_score_increased",
      "macro_deterioration",
    ] as const),
    proximity_pct: z
      .preprocess(
        (v) => (v === "" ? undefined : Number(v)),
        z.number().min(0.1).max(20).optional()
      ),
    cooldown_minutes: z.preprocess(
      (v) => Number(v),
      z.number().int().min(1, "Minimum 1 minute").max(10080, "Maximum 7 days")
    ),
    market_hours_only: z.boolean(),
    enabled: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.alert_type === "near_buy_zone") {
        return data.proximity_pct !== undefined && data.proximity_pct > 0;
      }
      return true;
    },
    {
      message: "Proximity % is required for 'near entry zone' alert type",
      path: ["proximity_pct"],
    }
  );

type AlertFormValues = z.infer<typeof alertFormSchema>;

interface AlertConfigFormProps {
  /** Called after the alert is successfully created. */
  onSuccess?: () => void;
}

export function AlertConfigForm({ onSuccess }: AlertConfigFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
  } = useForm<AlertFormValues>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      ticker: "",
      alert_type: "entered_buy_zone",
      cooldown_minutes: 60,
      market_hours_only: true,
      enabled: true,
    },
  });

  const alertType = watch("alert_type");

  const { mutate: createAlert, isPending } = useMutation({
    mutationFn: (values: AlertFormValues) =>
      alertsApi.create({
        ticker: values.ticker,
        alert_type: values.alert_type,
        threshold_json:
          values.alert_type === "near_buy_zone" && values.proximity_pct
            ? { proximity_pct: values.proximity_pct }
            : {},
        cooldown_minutes: values.cooldown_minutes,
        market_hours_only: values.market_hours_only,
        enabled: values.enabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert rule created");
      reset();
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to create alert"));
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v) => createAlert(v))}
      className="space-y-4"
      noValidate
    >
      {/* Ticker */}
      <div className="space-y-1.5">
        <Label htmlFor="alert-ticker" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Ticker
        </Label>
        <Input
          id="alert-ticker"
          placeholder="AAPL"
          {...register("ticker")}
          className="uppercase bg-surface-lowest border-none text-xs p-2.5 focus:ring-1 focus:ring-primary font-mono"
        />
        {errors.ticker && (
          <p className="text-2xs text-destructive">{errors.ticker.message}</p>
        )}
      </div>

      {/* Alert type */}
      <div className="space-y-1.5">
        <Label htmlFor="alert-type" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Alert type
        </Label>
        <Controller
          name="alert_type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="alert-type" className="bg-surface-lowest border-none text-xs focus:ring-1 focus:ring-primary">
                <SelectValue placeholder="Select alert type..." />
              </SelectTrigger>
              <SelectContent className="bg-surface-low border border-border/10">
                {(Object.keys(ALERT_TYPE_LABELS) as AlertType[]).map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {ALERT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.alert_type && (
          <p className="text-2xs text-destructive">
            {errors.alert_type.message}
          </p>
        )}
      </div>

      {/* Proximity threshold — only shown for near_buy_zone type */}
      {alertType === "near_buy_zone" && (
        <div className="space-y-1.5">
          <Label htmlFor="proximity-pct" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Proximity threshold (% from zone low)
          </Label>
          <Input
            id="proximity-pct"
            type="number"
            step="0.1"
            min="0.1"
            max="20"
            placeholder="2.0"
            {...register("proximity_pct")}
            className="bg-surface-lowest border-none text-xs p-2.5 focus:ring-1 focus:ring-primary"
          />
          {errors.proximity_pct && (
            <p className="text-2xs text-destructive">
              {errors.proximity_pct.message}
            </p>
          )}
        </div>
      )}

      {/* Cooldown */}
      <div className="space-y-1.5">
        <Label htmlFor="cooldown" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Cooldown (minutes)
        </Label>
        <Input
          id="cooldown"
          type="number"
          min="1"
          max="10080"
          {...register("cooldown_minutes")}
          className="bg-surface-lowest border-none text-xs p-2.5 focus:ring-1 focus:ring-primary tabular-nums"
        />
        {errors.cooldown_minutes && (
          <p className="text-2xs text-destructive">
            {errors.cooldown_minutes.message}
          </p>
        )}
      </div>

      {/* Market hours only */}
      <div className="flex items-center gap-3 py-1">
        <Controller
          name="market_hours_only"
          control={control}
          render={({ field }) => (
            <Switch
              id="market-hours"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div>
          <Label htmlFor="market-hours" className="text-xs font-bold text-foreground cursor-pointer">
            Market hours only
          </Label>
          <p className="text-2xs text-muted-foreground mt-0.5">9:30am–4pm ET, weekdays</p>
        </div>
      </div>

      {/* Enabled */}
      <div className="flex items-center gap-3 py-1">
        <Controller
          name="enabled"
          control={control}
          render={({ field }) => (
            <Switch
              id="alert-enabled"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="alert-enabled" className="text-xs font-bold text-foreground cursor-pointer">
          Enable alert immediately
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs"
        disabled={isPending}
      >
        {isPending ? "Creating..." : "Create alert"}
      </Button>
    </form>
  );
}
