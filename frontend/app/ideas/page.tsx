"use client";

/**
 * /ideas — V3 Ideas Page
 *
 * V3 changes:
 *   - "Suggested Ideas" tab now renders IdeaFeed (auto-generated V3 ideas
 *     from GET /api/ideas/generated) instead of the legacy V2 scanner feed
 *   - "My Ideas" tab retains the existing IdeaList (manual ideas)
 *   - "New Idea" button and IdeaForm dialog remain unchanged
 *
 * Protected route: requires authentication.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Sparkles,
} from "lucide-react";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { ideasApi, generatedIdeasApi } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function IdeasPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [newIdeaOpen, setNewIdeaOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"my" | "suggested">("suggested");

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?callbackUrl=/ideas");
    }
  }, [authLoading, user, router]);

  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["ideas"],
    queryFn: ideasApi.list,
    enabled: !!user,
  });

  // Preload the generated idea count for the badge on the tab
  const { data: generatedIdeas = [] } = useQuery({
    queryKey: ["generated-ideas", "all", ""],
    queryFn: () => generatedIdeasApi.list({ limit: 50 }),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  if (authLoading || !user) return null;

  return (
    <AppShell
      title="Ideas"
      actions={
        <Button size="sm" onClick={() => setNewIdeaOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Idea
        </Button>
      }
    >
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab("suggested")}
          className={cn(
            "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
            activeTab === "suggested"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5 inline mr-1.5" />
          Suggested Ideas
          {generatedIdeas.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">
              {generatedIdeas.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("my")}
          className={cn(
            "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
            activeTab === "my"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          My Ideas
          {ideas.length > 0 && (
            <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">
              {ideas.length}
            </Badge>
          )}
        </button>
      </div>

      {activeTab === "my" ? (
        <IdeaList ideas={ideas} isLoading={isLoading} />
      ) : (
        // V3: IdeaFeed replaces the legacy SuggestedIdeasPanel
        // Uses GET /api/ideas/generated (not the old GET /api/scanner/ideas)
        <IdeaFeed />
      )}

      <Dialog open={newIdeaOpen} onOpenChange={setNewIdeaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New idea</DialogTitle>
          </DialogHeader>
          <IdeaForm onSuccess={() => setNewIdeaOpen(false)} />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
