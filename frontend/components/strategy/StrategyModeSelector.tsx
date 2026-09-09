"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Shield,
  Zap,
  BrainCircuit,
  TrendingDown,
  Activity,
} from "lucide-react";
import type { StrategyMode } from "@/types";

export type TabMode = StrategyMode | "ai-builder";

interface Tab {
  mode: TabMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
}

const TABS: Tab[] = [
  {
    mode: "conservative",
    label: "Conservative",
    description: "Stricter signal confirmation filters.",
    icon: <Shield className="h-4 w-4" />,
    iconColor: "text-primary",
  },
  {
    mode: "aggressive",
    label: "Aggressive",
    description: "Momentum signals with trailing stops.",
    icon: <Zap className="h-4 w-4" />,
    iconColor: "text-destructive",
  },
  {
    mode: "ai-pick",
    label: "AI Pick",
    description: "Compare parameter variants by backtest.",
    icon: <BrainCircuit className="h-4 w-4" />,
    iconColor: "text-primary",
  },
  {
    mode: "buy-low-sell-high",
    label: "Buy Low / Sell High",
    description: "Mean reversion algorithm.",
    icon: <TrendingDown className="h-4 w-4" />,
    iconColor: "text-muted-foreground",
  },
  {
    mode: "squeeze",
    label: "BB Squeeze",
    description: "Bollinger Band compression and breakout.",
    icon: <Activity className="h-4 w-4" />,
    iconColor: "text-primary",
  },
  {
    mode: "ai-builder",
    label: "Script templates",
    description: "Build from strategy templates.",
    icon: <Sparkles className="h-4 w-4" />,
    iconColor: "text-primary",
  },
];

interface StrategyModeSelectorProps {
  /**
   * Render prop — receives the active mode and returns BOTH the left-column form
   * AND the right-column results wrapped in a two-column fragment.
   * The component handles the grid layout itself.
   *
   * For legacy compatibility the signature is unchanged:
   *   children(mode) should return JSX rendered in the RIGHT column.
   * The LEFT column form is passed separately via `leftSlot`.
   */
  children: (mode: StrategyMode) => React.ReactNode;
  /**
   * Optional: content to place in the left column below the strategy list.
   * Receives the active mode.
   */
  leftSlot?: (mode: TabMode) => React.ReactNode;
  aiBuilderContent?: React.ReactNode;
  defaultMode?: TabMode;
}

/**
 * Sovereign Terminal strategy selector — two-column layout.
 * Left  (~380px): vertical strategy list + optional leftSlot (form)
 * Right (flex-1): children render-prop (results)
 */
export function StrategyModeSelector({
  children,
  leftSlot,
  aiBuilderContent,
  defaultMode = "conservative",
}: StrategyModeSelectorProps) {
  const [activeMode, setActiveMode] = useState<TabMode>(defaultMode);

  const rightContent =
    activeMode === "ai-builder"
      ? null
      : children(activeMode as StrategyMode);

  const leftContent = leftSlot ? leftSlot(activeMode) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr] gap-6 items-start">
      {/* ── Left column: strategy list + form ── */}
      <div className="space-y-4">
        <section aria-label="Strategy mode" data-testid="strategy-mode-selector">
          <div className="grid grid-cols-2 gap-2">
            {TABS.map((tab) => (
              <button key={tab.mode} aria-pressed={activeMode === tab.mode} onClick={() => setActiveMode(tab.mode)} data-testid={`strategy-tab-${tab.mode}`}
                className={`flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring ${activeMode === tab.mode ? "bg-primary/15 text-primary" : "bg-surface-low text-foreground hover:bg-surface-high"}`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{TABS.find((tab) => tab.mode === activeMode)?.description}</p>
        </section>

        {/* Left column slot — parameters form */}
        {activeMode === "ai-builder" ? aiBuilderContent : leftContent}
      </div>

      {/* ── Right column: results ── */}
      <div data-testid={`strategy-content-${activeMode}`}>
        {activeMode !== "ai-builder" && rightContent}
      </div>
    </div>
  );
}
