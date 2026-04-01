"use client";

/**
 * IdeaForm — create or edit a WatchlistIdea.
 *
 * Fields:
 *   - title (text)
 *   - thesis (textarea)
 *   - conviction_score (range slider 1–10)
 *   - tags_json (theme tag checkboxes from SUPPORTED_THEMES)
 *   - tickers (comma-separated input, first is primary)
 *   - watch_only (Switch) — "Watch-only ideas are tracked but never sent to a broker"
 *   - tradable (Switch)
 *
 * Submits POST /api/ideas (create) or PATCH /api/ideas/:id (edit).
 */

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ideasApi } from "@/lib/api";
import { getErrorMessage, cn } from "@/lib/utils";
import type { WatchlistIdea } from "@/types";

// Supported themes from prompt-feature.md Feature D
export const SUPPORTED_THEMES = [
  "ai",
  "renewable_energy",
  "power_infrastructure",
  "data_centers",
  "space_economy",
  "aerospace",
  "defense",
  "robotics",
  "semiconductors",
  "cybersecurity",
] as const;

function formatThemeName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

const ideaFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  thesis: z.string().min(1, "Thesis is required").max(5000, "Thesis too long"),
  conviction_score: z.number().int().min(1).max(10),
  tags_json: z.array(z.string()),
  tickers_raw: z.string(),
  watch_only: z.boolean(),
  tradable: z.boolean(),
});

type IdeaFormValues = z.infer<typeof ideaFormSchema>;

interface IdeaFormProps {
  /** If provided, pre-fills the form for editing. */
  existing?: WatchlistIdea;
  /** Called after successful create or update. */
  onSuccess?: () => void;
}

export function IdeaForm({ existing, onSuccess }: IdeaFormProps) {
  const queryClient = useQueryClient();
  const isEditing = existing !== undefined;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<IdeaFormValues>({
    resolver: zodResolver(ideaFormSchema),
    defaultValues: {
      title: existing?.title ?? "",
      thesis: existing?.thesis ?? "",
      conviction_score: existing?.conviction_score ?? 5,
      tags_json: existing?.tags_json ?? [],
      tickers_raw: existing?.tickers?.map((t) => t.ticker).join(", ") ?? "",
      watch_only: existing?.watch_only ?? false,
      tradable: existing?.tradable ?? true,
    },
  });

  const convictionScore = watch("conviction_score");

  const { mutate, isPending } = useMutation({
    mutationFn: (values: IdeaFormValues) => {
      const parsedTickers = values.tickers_raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const tickerObjs = parsedTickers.map((ticker, idx) => ({
        ticker,
        is_primary: idx === 0,
      }));

      if (isEditing) {
        return ideasApi.update(existing.id, {
          title: values.title,
          thesis: values.thesis,
          conviction_score: values.conviction_score,
          tags_json: values.tags_json,
          watch_only: values.watch_only,
          tradable: values.tradable,
          tickers: tickerObjs,
        });
      }

      return ideasApi.create({
        title: values.title,
        thesis: values.thesis,
        conviction_score: values.conviction_score,
        tags_json: values.tags_json,
        watch_only: values.watch_only,
        tradable: values.tradable,
        tickers: tickerObjs,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success(isEditing ? "Idea updated" : "Idea created");
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to save idea"));
    },
  });

  return (
    <form
      onSubmit={handleSubmit((v: IdeaFormValues) => mutate(v))}
      className="space-y-4"
      noValidate
    >
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="idea-title" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Title
        </Label>
        <Input
          id="idea-title"
          placeholder="e.g. AI infrastructure buildout wave"
          {...register("title")}
          className="bg-surface-lowest border-none text-xs p-2.5 focus:ring-1 focus:ring-primary"
        />
        {errors.title && (
          <p className="text-2xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Thesis */}
      <div className="space-y-1.5">
        <Label htmlFor="idea-thesis" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Thesis
        </Label>
        <textarea
          id="idea-thesis"
          rows={4}
          placeholder="Describe your investment thesis, key catalysts, and assumptions..."
          className={cn(
            "flex min-h-[80px] w-full rounded-md bg-surface-lowest px-3 py-2.5",
            "text-xs placeholder:text-muted-foreground/65",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-50 resize-y border-none"
          )}
          {...register("thesis")}
        />
        {errors.thesis && (
          <p className="text-2xs text-destructive">{errors.thesis.message}</p>
        )}
      </div>

      {/* Conviction slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="conviction-slider" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Conviction score
          </Label>
          <span className="text-sm font-bold text-primary tabular-nums">
            {convictionScore}/10
          </span>
        </div>
        <Controller
          name="conviction_score"
          control={control}
          render={({ field }) => (
            <input
              id="conviction-slider"
              name="conviction_score"
              type="range"
              min={1}
              max={10}
              step={1}
              value={field.value}
              onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
              className="w-full accent-primary cursor-pointer"
            />
          )}
        />
        <div className="flex justify-between text-2xs text-muted-foreground">
          <span>1 — Speculative</span>
          <span>10 — High conviction</span>
        </div>
      </div>

      {/* Theme tags */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Theme tags
        </Label>
        <Controller
          name="tags_json"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {SUPPORTED_THEMES.map((theme) => {
                const checked = field.value.includes(theme);
                return (
                  <label
                    key={theme}
                    className={cn(
                      "flex items-center gap-2 rounded-sm px-2.5 py-1.5 cursor-pointer text-xs transition-colors",
                      checked
                        ? "bg-primary/15 text-primary"
                        : "bg-surface-high text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          field.onChange([...field.value, theme]);
                        } else {
                          field.onChange(
                            field.value.filter((t) => t !== theme)
                          );
                        }
                      }}
                      className="h-3 w-3 accent-primary"
                    />
                    {formatThemeName(theme)}
                  </label>
                );
              })}
            </div>
          )}
        />
      </div>

      {/* Linked tickers */}
      <div className="space-y-1.5">
        <Label htmlFor="idea-tickers" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Linked tickers (comma-separated)
        </Label>
        <Input
          id="idea-tickers"
          placeholder="NVDA, AMD, INTC"
          {...register("tickers_raw")}
          className="bg-surface-lowest border-none text-xs p-2.5 focus:ring-1 focus:ring-primary font-mono"
        />
        <p className="text-2xs text-muted-foreground">
          First ticker is treated as the primary symbol. Leave blank for
          watch-only thesis ideas.
        </p>
      </div>

      {/* Watch-only toggle */}
      <div className="flex items-start gap-3 py-1">
        <Controller
          name="watch_only"
          control={control}
          render={({ field }) => (
            <Switch
              id="watch-only"
              checked={field.value}
              onCheckedChange={field.onChange}
              className="mt-0.5"
            />
          )}
        />
        <div>
          <Label htmlFor="watch-only" className="text-xs font-bold text-foreground cursor-pointer">
            Watch-only
          </Label>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Watch-only ideas are tracked but never sent to a broker. Use this
            for non-tradable or pre-IPO ideas.
          </p>
        </div>
      </div>

      {/* Tradable toggle */}
      <div className="flex items-center gap-3 py-1">
        <Controller
          name="tradable"
          control={control}
          render={({ field }) => (
            <Switch
              id="tradable"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="tradable" className="text-xs font-bold text-foreground cursor-pointer">
          Tradable (allow broker actions)
        </Label>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs"
        disabled={isPending}
      >
        {isPending
          ? isEditing
            ? "Saving..."
            : "Creating..."
          : isEditing
          ? "Save changes"
          : "Create idea"}
      </Button>
    </form>
  );
}
