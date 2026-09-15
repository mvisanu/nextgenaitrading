"use client";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  cn
} from "@/lib/utils";
import type {
  AutoBuySettings, BrokerCredential, UpdateAutoBuySettingsRequest
} from "@/types";
import {
  CalendarDays
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";



const EXEC_TIMEFRAMES: { value: string; label: string; sublabel: string; desc: string; live?: boolean }[] = [
  { value: "1m",  label: "1",   sublabel: "min",  desc: "Near real-time — checks every minute. Best for active markets.", live: false },
  { value: "15m", label: "15",     sublabel: "min",     desc: "Every 15 minutes — good balance of speed and stability." },
  { value: "30m", label: "30",     sublabel: "min",     desc: "Every 30 minutes — moderate frequency, less noise." },
  { value: "1h",  label: "1",      sublabel: "hr",      desc: "Every hour — relaxed pace, suits swing trading." },
  { value: "2h",  label: "2",      sublabel: "hrs",     desc: "Every 2 hours — low frequency, for patient strategies." },
];

// ─── Execution Settings (Section 4 content) ───────────────────────────────────

export function ExecutionSettings({
  settings,
  brokerCredentials,
  isSaving,
  onUpdate,
}: {
  settings: AutoBuySettings;
  brokerCredentials: BrokerCredential[];
  isSaving: boolean;
  onUpdate: (partial: UpdateAutoBuySettingsRequest) => void;
}) {
  const [drawdown, setDrawdown] = useState(Math.abs(settings.max_expected_drawdown));
  const [execTimeframe, setExecTimeframe] = useState(() => {
    // Normalize stored value to one of our 5 options
    const stored = settings.execution_timeframe ?? "1h";
    return ["1m", "15m", "30m", "1h", "2h"].includes(stored) ? stored : "1h";
  });
  const [startDate, setStartDate] = useState(settings.start_date ?? "");
  const [endDate, setEndDate] = useState(settings.end_date ?? "");

  function saveDrawdown() {
    if (!Number.isFinite(drawdown) || drawdown <= 0 || drawdown > 1) { toast.error("Drawdown must be greater than 0 and at most 100%"); return; }
    onUpdate({ max_expected_drawdown: -Math.abs(drawdown) });
  }

  function saveDateFields() {
    if (startDate && endDate && startDate > endDate) { toast.error("End date must be on or after start date"); return; }
    onUpdate({
      start_date: startDate || null,
      end_date: endDate || null,
    });
  }

  return (
    <div className="space-y-4">
      {/* Execution timeframe — 4 button pills */}
      <div>
        <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 block">
          Check Interval
        </label>
        <p className="text-3xs text-muted-foreground mb-2">
          How often the engine checks the market and can place orders
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {EXEC_TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => {
                setExecTimeframe(tf.value);
                onUpdate({ execution_timeframe: tf.value });
              }}
              className={cn(
                "relative flex flex-col items-center py-2.5 px-1 rounded border transition-all",
                tf.live && execTimeframe === tf.value
                  ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-400"
                  : tf.live
                  ? "bg-surface-lowest border-emerald-500/20 text-emerald-400/60 hover:border-emerald-400/40 hover:text-emerald-400/90"
                  : execTimeframe === tf.value
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-surface-lowest border-transparent text-muted-foreground hover:border-primary/20 hover:text-foreground"
              )}
            >
              {tf.live && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1 py-0 rounded-full text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 leading-3 tracking-wider whitespace-nowrap">
                  live
                </span>
              )}
              <span className={cn("font-black leading-none tabular-nums", tf.live ? "text-[12px]" : "text-[13px]")}>
                {tf.label}
              </span>
              <span className="text-[9px] uppercase tracking-wider mt-1 opacity-70">
                {tf.sublabel}
              </span>
            </button>
          ))}
        </div>
        <p className="text-3xs text-muted-foreground mt-1.5">
          {EXEC_TIMEFRAMES.find(t => t.value === execTimeframe)?.desc ?? ""}
          {execTimeframe === "1m" && (
            <span className="ml-1 text-amber-400/80">⚠ Not recommended for beginners — use 15 or 30 min first.</span>
          )}
        </p>
      </div>

      {/* Start / End date */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Start Date
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={saveDateFields}
            className="bg-surface-lowest border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
        <div>
          <label className="text-2xs font-bold text-muted-foreground uppercase mb-1 flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> End Date
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            onBlur={saveDateFields}
            min={startDate || undefined}
            className="bg-surface-lowest border-none text-xs h-9 focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>
      {startDate && endDate && startDate > endDate && (
        <p className="text-3xs text-destructive -mt-2">End date must be after start date</p>
      )}

      <Separator className="bg-border/20" />

      {/* Max drawdown slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div>
            <label className="text-2xs font-bold text-muted-foreground uppercase">
              Expected Drawdown Limit
            </label>
            <p className="text-3xs text-muted-foreground mt-0.5">Reject signals whose estimated drawdown exceeds this limit</p>
          </div>
          <span className="text-2xs font-bold text-destructive tabular-nums">
            -{Math.round(drawdown * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.03}
            max={0.30}
            step={0.01}
            value={drawdown}
            onChange={(e) => setDrawdown(parseFloat(e.target.value))}
            onMouseUp={saveDrawdown}
            onTouchEnd={saveDrawdown}
            className="flex-1 accent-primary h-1 cursor-pointer"
          />
          <span className="text-2xs font-bold text-foreground tabular-nums min-w-[2.5rem] text-right">
            -{Math.round(drawdown * 100)}%
          </span>
        </div>
        <div className="flex justify-between text-3xs text-muted-foreground mt-0.5">
          <span>3% — very cautious</span>
          <span>30% — more risk tolerance</span>
        </div>
      </div>

      {/* Earnings blackout */}
      <div className="flex items-center justify-between p-3 bg-surface-lowest">
        <div>
          <p className="text-2xs font-bold text-foreground uppercase tracking-wider">
            Avoid Earnings Days
          </p>
          <p className="text-3xs text-muted-foreground mt-0.5">
            Skip trades when a company reports earnings within 5 days (recommended for beginners)
          </p>
        </div>
        <Switch
          id="earnings-blackout"
          checked={!settings.allow_near_earnings}
          onCheckedChange={(checked) => onUpdate({ allow_near_earnings: !checked })}
          disabled={isSaving}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Allowed broker accounts */}
      {brokerCredentials.filter((c) => c.is_active).length > 0 && (
        <div className="space-y-2">
          <label className="text-2xs font-bold text-muted-foreground uppercase block">
            Allowed Accounts
          </label>
          <div className="space-y-1.5">
            {brokerCredentials
              .filter((c) => c.is_active)
              .map((cred) => {
                const isAllowed = (
                  settings.allowed_account_ids_json ?? []
                ).includes(cred.id);
                return (
                  <label
                    key={cred.id}
                    className={cn(
                      "flex items-center gap-2.5 border px-3 py-2 cursor-pointer text-xs transition-colors",
                      isAllowed
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/20 bg-surface-lowest hover:border-primary/20"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isAllowed}
                      onChange={(e) => {
                        const current = settings.allowed_account_ids_json ?? [];
                        const updated = e.target.checked
                          ? [...current, cred.id]
                          : current.filter((id) => id !== cred.id);
                        onUpdate({ allowed_account_ids_json: updated });
                      }}
                      className="h-3.5 w-3.5 accent-primary"
                    />
                    <span className="font-medium text-2xs">{cred.profile_name}</span>
                    <span className="ml-auto text-3xs text-muted-foreground uppercase">
                      {cred.provider}
                    </span>
                  </label>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dry run result panel ─────────────────────────────────────────────────────
