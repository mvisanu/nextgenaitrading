"use client";

/**
 * IdeaList — renders idea cards sorted by rank_score descending.
 * Each card has edit and delete actions.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ideasApi } from "@/lib/api";
import { getErrorMessage, cn } from "@/lib/utils";
import { IdeaForm } from "./IdeaForm";
import type { WatchlistIdea } from "@/types";

function formatThemeName(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface IdeaListProps {
  ideas: WatchlistIdea[];
  isLoading?: boolean;
}

export function IdeaList({ ideas, isLoading }: IdeaListProps) {
  const queryClient = useQueryClient();
  const [editingIdea, setEditingIdea] = useState<WatchlistIdea | null>(null);
  const [deletingIdea, setDeletingIdea] = useState<WatchlistIdea | null>(null);

  const { mutate: deleteIdea, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => ideasApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      toast.success("Idea deleted");
      setDeletingIdea(null);
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, "Failed to delete idea"));
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
        <TrendingUp className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No ideas yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click <strong className="text-foreground">+ New Idea</strong> above to create your first investment thesis.
        </p>

        <div className="mt-5 w-full border border-border rounded-lg p-4 text-left space-y-3 bg-card">
          <p className="text-[11px] font-semibold text-foreground">How My Ideas works</p>
          <div className="space-y-2 text-[11px] text-muted-foreground">
            <div className="flex gap-2">
              <span className="shrink-0 font-mono text-primary font-bold">1.</span>
              <span>Click <strong className="text-foreground">+ New Idea</strong> to write your investment thesis — add a title, reasoning, conviction score, and link tickers.</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 font-mono text-primary font-bold">2.</span>
              <span>Tag ideas with themes (AI, Defense, Semiconductors, etc.) to organize and track your thinking.</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 font-mono text-primary font-bold">3.</span>
              <span>Each idea gets a <strong className="text-foreground">rank score</strong> based on linked ticker analysis — higher conviction + stronger technicals = higher rank.</span>
            </div>
            <div className="flex gap-2">
              <span className="shrink-0 font-mono text-primary font-bold">4.</span>
              <span>Toggle <strong className="text-foreground">Watch-only</strong> for ideas you want to track without trading, or set <strong className="text-foreground">Tradable</strong> to enable broker actions.</span>
            </div>
          </div>
          <div className="border-t border-border pt-2 text-[10px] text-muted-foreground/70">
            Tip: Check the <strong>Suggested Ideas</strong> tab for auto-generated ideas from the scanner — you can add those to your watchlist with one click.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {ideas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            onEdit={() => setEditingIdea(idea)}
            onDelete={() => setDeletingIdea(idea)}
          />
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editingIdea !== null}
        onOpenChange={(open) => !open && setEditingIdea(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit idea</DialogTitle>
          </DialogHeader>
          {editingIdea && (
            <IdeaForm
              existing={editingIdea}
              onSuccess={() => setEditingIdea(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingIdea !== null}
        onOpenChange={(open) => !open && setDeletingIdea(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete idea?</DialogTitle>
            <DialogDescription>
              This will permanently remove &ldquo;{deletingIdea?.title}&rdquo;
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingIdea(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => deletingIdea && deleteIdea(deletingIdea.id)}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── IdeaCard ─────────────────────────────────────────────────────────────────

interface IdeaCardProps {
  idea: WatchlistIdea;
  onEdit: () => void;
  onDelete: () => void;
}

function IdeaCard({ idea, onEdit, onDelete }: IdeaCardProps) {
  const primaryTicker = idea.tickers?.find((t) => t.is_primary);
  const otherTickers = idea.tickers?.filter((t) => !t.is_primary) ?? [];

  return (
    <Card className="hover:border-border/80 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold truncate">{idea.title}</h3>
              {idea.watch_only && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  <Eye className="h-3 w-3 mr-1" />
                  Watch-only
                </Badge>
              )}
              {!idea.tradable && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Non-tradable
                </Badge>
              )}
            </div>

            {/* Tickers */}
            {idea.tickers && idea.tickers.length > 0 && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {primaryTicker && (
                  <span className="font-mono text-xs font-semibold text-primary">
                    {primaryTicker.ticker}
                  </span>
                )}
                {otherTickers.map((t) => (
                  <span
                    key={t.id}
                    className="font-mono text-xs text-muted-foreground"
                  >
                    {t.ticker}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              title="Edit idea"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Delete idea"
              aria-label="Delete idea"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Thesis preview */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {idea.thesis}
        </p>

        {/* Theme tags */}
        {idea.tags_json.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {idea.tags_json.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {formatThemeName(tag)}
              </Badge>
            ))}
          </div>
        )}

        {/* Scores row */}
        <div className="flex items-center gap-4 pt-1 flex-wrap">
          <ScorePill label="Conviction" value={`${idea.conviction_score}/10`} />
          <ScorePill
            label="Rank score"
            value={(idea.rank_score * 100).toFixed(0) + "%"}
            highlight
          />
          <span className="text-[11px] text-muted-foreground ml-auto">
            {new Date(idea.updated_at).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ScorePill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span
        className={cn(
          "font-semibold font-mono",
          highlight ? "text-primary" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
