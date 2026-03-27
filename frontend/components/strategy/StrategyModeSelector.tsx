"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Shield,
  Zap,
  BrainCircuit,
  TrendingDown,
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
    description: "Low volatility, steady growth focus.",
    icon: <Shield className="h-4 w-4" />,
    iconColor: "text-primary",
  },
  {
    mode: "aggressive",
    label: "Aggressive",
    description: "High-frequency momentum chasing.",
    icon: <Zap className="h-4 w-4" />,
    iconColor: "text-destructive",
  },
  {
    mode: "ai-pick",
    label: "AI Pick",
    description: "Model-driven daily rebalancing.",
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
    mode: "ai-builder",
    label: "AI Builder",
    description: "Construct custom logic nodes.",
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
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">
      {/* ── Left column: strategy list + form ── */}
      <div className="space-y-4">
        {/* Strategy selector list */}
        <section
          className="bg-surface-low rounded-lg overflow-hidden border border-border/20"
          data-testid="strategy-mode-selector"
        >
          <div className="px-4 py-3 border-b border-border/20">
            <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
              Strategy Mode
            </p>
          </div>
          <div className="flex flex-col divide-y divide-border/10">
            {TABS.map((tab) => {
              const isActive = activeMode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  onClick={() => setActiveMode(tab.mode)}
                  className={[
                    "flex items-center justify-between px-4 py-3 text-left transition-all border-l-2",
                    isActive
                      ? "bg-primary/10 border-primary"
                      : "border-transparent hover:bg-surface-high hover:border-border/30",
                  ].join(" ")}
                  data-testid={`strategy-tab-${tab.mode}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isActive ? "text-primary" : tab.iconColor}>
                      {tab.icon}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-bold ${
                          isActive ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {tab.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {tab.description}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 ml-2 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
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
