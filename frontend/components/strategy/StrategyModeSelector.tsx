"use client";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { StrategyMode } from "@/types";

interface Tab {
  mode: StrategyMode;
  label: string;
}

const TABS: Tab[] = [
  { mode: "conservative", label: "Conservative" },
  { mode: "aggressive", label: "Aggressive" },
  { mode: "ai-pick", label: "AI Pick" },
  { mode: "buy-low-sell-high", label: "Buy Low / Sell High" },
];

interface StrategyModeSelectorProps {
  children: (mode: StrategyMode) => React.ReactNode;
  defaultMode?: StrategyMode;
}

export function StrategyModeSelector({
  children,
  defaultMode = "conservative",
}: StrategyModeSelectorProps) {
  return (
    <Tabs defaultValue={defaultMode} className="w-full">
      <TabsList className="w-full sm:w-auto">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.mode}
            value={tab.mode}
            className="text-xs sm:text-sm"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {TABS.map((tab) => (
        <TabsContent key={tab.mode} value={tab.mode} className="mt-4">
          {children(tab.mode)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
