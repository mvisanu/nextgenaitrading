"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles } from "lucide-react";
import type { StrategyMode } from "@/types";

type TabMode = StrategyMode | "ai-builder";

interface Tab {
  mode: TabMode;
  label: string;
  shortLabel: string;
}

const TABS: Tab[] = [
  { mode: "conservative", label: "Conservative", shortLabel: "Conserv." },
  { mode: "aggressive", label: "Aggressive", shortLabel: "Aggress." },
  { mode: "ai-pick", label: "AI Pick", shortLabel: "AI Pick" },
  { mode: "buy-low-sell-high", label: "Buy Low / Sell High", shortLabel: "BLSH" },
  { mode: "ai-builder", label: "AI Builder", shortLabel: "AI Chat" },
];

interface StrategyModeSelectorProps {
  children: (mode: StrategyMode) => React.ReactNode;
  aiBuilderContent?: React.ReactNode;
  defaultMode?: TabMode;
}

export function StrategyModeSelector({
  children,
  aiBuilderContent,
  defaultMode = "conservative",
}: StrategyModeSelectorProps) {
  return (
    <Tabs defaultValue={defaultMode} className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-11 sm:h-12">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.mode}
            value={tab.mode}
            className="text-[10px] sm:text-sm px-1 sm:px-3 data-[state=active]:text-primary gap-1"
          >
            {tab.mode === "ai-builder" && <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map((tab) => (
        <TabsContent key={tab.mode} value={tab.mode} className="mt-5">
          {tab.mode === "ai-builder"
            ? aiBuilderContent
            : children(tab.mode as StrategyMode)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
