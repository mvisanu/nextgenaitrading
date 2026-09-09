"use client";
import { Input } from "@/components/ui/input";
import type {
  AutoBuyDryRunResult, AutoBuySettings, UpdateAutoBuySettingsRequest
} from "@/types";
import {
  DollarSign, Play, Target
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";



export function TargetFields({
  settings,
  dryRunTicker,
  setDryRunTicker,
  isSaving,
  onUpdate,
  onDryRun,
  isDryRunning,
  dryRunResult,
}: {
  settings: AutoBuySettings;
  dryRunTicker: string;
  setDryRunTicker: (v: string) => void;
  isSaving: boolean;
  onUpdate: (partial: UpdateAutoBuySettingsRequest) => void;
  onDryRun: () => void;
  isDryRunning: boolean;
  dryRunResult: AutoBuyDryRunResult | null;
}) {
  const [maxAmount, setMaxAmount] = useState(String(settings.max_trade_amount));
  const [confidence, setConfidence] = useState(settings.confidence_threshold);
  const [targetBuy, setTargetBuy] = useState(settings.target_buy_price != null ? String(settings.target_buy_price) : "");

  function saveNumericFields() {
    const amount = Number(maxAmount);
    const buy = targetBuy ? Number(targetBuy) : null;
    if (!Number.isFinite(amount) || amount <= 0 || [buy].some(value => value !== null && (!Number.isFinite(value) || value <= 0))) {
      toast.error("Enter positive amounts and target prices"); return;
    }
    onUpdate({
      max_trade_amount: amount,
      confidence_threshold: confidence,
      target_buy_price: buy,
    });
  }

  return (
    <div className="space-y-4">
      {/* Beginner hint */}
      <div className="flex items-start gap-2 rounded bg-primary/5 border border-primary/10 px-3 py-2">
        <Target className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <p className="text-3xs text-muted-foreground leading-relaxed">
          Enter the stock symbol you want to trade, the maximum dollar amount per order, and an optional sizing reference price. Entry signals come from saved buy zones.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      {/* Symbol search — maps to dry-run ticker */}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Dry-run symbol
        </label>
        <div className="relative">
          <Input
            aria-label="Dry-run symbol"
            data-testid="dry-run-ticker"
            value={dryRunTicker}
            onChange={(e) => setDryRunTicker(e.target.value.toUpperCase())}
            placeholder="e.g. AAPL, TSLA, BTC"
            className="bg-surface-lowest border-none text-xs placeholder:text-primary/40 focus-visible:ring-1 focus-visible:ring-primary h-9 pr-8"
          />
          <button
            data-testid="dry-run-btn"
            onClick={onDryRun}
            disabled={isDryRunning || !dryRunTicker.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            title="Test this symbol with a dry run (no real money)"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        </div>
        {isDryRunning && (
          <p className="text-3xs text-primary mt-1 animate-pulse">Running simulation...</p>
        )}
        <p className="text-3xs text-muted-foreground mt-0.5">Tap ▷ to test without real money</p>
      </div>

      {/* Max order size */}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Max Order Size
        </label>
        <p className="text-3xs text-muted-foreground mb-1">Most you&apos;ll spend per trade</p>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
            $
          </span>
          <Input
            type="number"
            min="10"
            step="50"
            aria-label="Maximum order amount"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            onBlur={saveNumericFields}
            className="bg-surface-lowest border-none text-xs pl-6 tabular-nums focus-visible:ring-1 focus-visible:ring-primary h-9"
            placeholder="500"
          />
        </div>
      </div>

      {/* Sizing Reference Price */}
      <div className="col-span-2 sm:col-span-1">
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
          <DollarSign className="h-3 w-3 text-emerald-400" /> Sizing Reference Price
        </label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            aria-label="Sizing reference price"
            value={targetBuy}
            onChange={(e) => setTargetBuy(e.target.value)}
            onBlur={saveNumericFields}
            placeholder="Optional"
            className="bg-surface-lowest border-none text-xs pl-6 tabular-nums h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <p className="text-3xs text-muted-foreground mt-0.5">Optional reference for the position-size check; orders use the current market price.</p>
      </div>

      {/* Min confidence — maps to confidence_threshold */}
      <div className="col-span-2">
        <div className="flex items-center justify-between mb-1">
          <label className="text-2xs font-bold text-muted-foreground uppercase">
            Signal Confidence
          </label>
          <span className="text-xs font-bold text-primary tabular-nums">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            aria-label="Signal confidence"
            type="range"
            min={0.3}
            max={0.95}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            onMouseUp={saveNumericFields}
            onTouchEnd={saveNumericFields}
            onKeyUp={saveNumericFields}
            className="flex-1 accent-primary h-1 cursor-pointer"
          />
          <span className="text-2xs font-bold text-foreground tabular-nums min-w-[2.5rem] text-right">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <div className="flex justify-between text-3xs text-muted-foreground mt-0.5">
          <span>30% — more signals</span>
          <span>95% — only strongest signals</span>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── Execution timeframe button pills ────────────────────────────────────────
