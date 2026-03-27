"use client";

/**
 * /ideas — V3 Ideas Page (Refactored)
 *
 * Three tabs:
 *   1. Market Pulse — live TradingView screener data + Reddit social sentiment
 *   2. AI Suggestions — auto-generated ideas from V3 idea engine (IdeaFeed)
 *   3. My Ideas — manually created investment theses (IdeaList)
 *
 * Sovereign Terminal design system applied.
 * Protected route: requires authentication.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Sparkles,
  Activity,
  Lightbulb,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { IdeaList } from "@/components/ideas/IdeaList";
import { IdeaFeed } from "@/components/ideas/IdeaFeed";
import { MarketPulse } from "@/components/ideas/MarketPulse";
import { ideasApi, generatedIdeasApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tab = "pulse" | "suggested" | "my";

const TABS: { key: Tab; label: string; icon: typeof Activity; description: string }[] = [
  {
    key: "pulse",
    label: "Market Pulse",
    icon: Activity,
    description: "Live screener + Reddit trending",
  },
  {
    key: "suggested",
    label: "AI Suggestions",
    icon: Sparkles,
    description: "Auto-generated stock ideas",
  },
  {
    key: "my",
    label: "My Ideas",
    icon: Lightbulb,
    description: "Your investment theses",
  },
];

export default function IdeasPage() {
  const { user } = useAuth();
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("pulse");

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideas"],
    queryFn: ideasApi.list,
    enabled: !!user,
  });

  const { data: generatedIdeas = [] } = useQuery({
    queryKey: ["generated-ideas", "all", ""],
    queryFn: () => generatedIdeasApi.list({ limit: 50 }),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  return (
    <AppShell
      title="Ideas"
      actions={
        <Button
          size="sm"
          onClick={() => setNewIdeaOpen(true)}
          className="bg-primary text-primary-foreground font-bold uppercase tracking-widest text-xs h-8 px-3"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Idea
        </Button>
      }
    >
      {/* Page header */}
      <div className="mb-4">
        <p className="text-xl font-bold text-foreground">Ideas</p>
        <p className="text-sm text-muted-foreground">Market pulse, AI-generated suggestions, and your investment theses</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 mb-4 border-b border-border/10 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count =
            tab.key === "my"
              ? ideas.length
              : tab.key === "suggested"
              ? generatedIdeas.length
              : 0;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors uppercase tracking-widest",
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span className="bg-surface-high text-muted-foreground text-3xs font-bold px-1.5 py-0.5 rounded-sm tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "pulse" && <MarketPulse />}
      {activeTab === "suggested" && <IdeaFeed />}
      {activeTab === "my" && <IdeaList ideas={ideas} isLoading={isLoading} />}

      {/* New Idea dialog */}
      <Dialog open={newIdeaOpen} onOpenChange={setNewIdeaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface-low border border-border/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-foreground">New idea</DialogTitle>
          </DialogHeader>
          <IdeaForm onSuccess={() => { setNewIdeaOpen(false); setActiveTab("my"); }} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
