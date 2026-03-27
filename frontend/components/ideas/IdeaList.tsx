"use client";

/**
 * IdeaList — renders idea cards sorted by rank_score descending.
 *
 * Sovereign Terminal design system applied.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full bg-surface-mid" />
        ))}
      </div>
    );
  }

  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
        <div className="h-10 w-10 rounded-full bg-surface-high flex items-center justify-center mb-3">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-bold text-foreground">No ideas yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Click <strong className="text-foreground">+ New Idea</strong> above to create your first investment thesis.
        </p>

        {/* How it works guide */}
        <div className="mt-5 w-full border border-border/10 rounded-md p-4 text-left space-y-3 bg-surface-high/50">
          <p className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">How My Ideas works</p>
          <div className="space-y-2 text-2xs text-muted-foreground">
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
          <div className="border-t border-border/10 pt-2 text-3xs text-muted-foreground/60">
            Tip: Check the <strong>Suggested Ideas</strong> tab for auto-generated ideas from the scanner — you can add those to your watchlist with one click.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-surface-low border border-border/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Edit idea</DialogTitle>
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
        <DialogContent className="bg-surface-low border border-border/10">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold uppercase tracking-widest text-foreground">Delete idea?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently remove &ldquo;{deletingIdea?.title}&rdquo;
              and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeletingIdea(null)}
              disabled={isDeleting}
              className="text-xs hover:bg-surface-high/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => deletingIdea && deleteIdea(deletingIdea.id)}
              className="text-xs font-bold uppercase tracking-widest"
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
    <div className="rounded-md border border-border/10 bg-surface-mid p-3 transition-colors hover:border-border/20">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-foreground truncate">{idea.title}</h3>
            {idea.watch_only && (
              <span className="bg-surface-high text-muted-foreground text-3xs font-bold px-2 py-0.5 rounded-sm inline-flex items-center gap-1 shrink-0">
                <Eye className="h-2.5 w-2.5" />
                Watch-only
              </span>
            )}
            {!idea.tradable && (
              <span className="bg-surface-high text-muted-foreground text-3xs font-bold px-2 py-0.5 rounded-sm shrink-0">
                Non-tradable
              </span>
            )}
          </div>

          {/* Tickers */}
          {idea.tickers && idea.tickers.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {primaryTicker && (
                <span className="font-mono text-xs font-bold text-primary">
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
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors rounded-sm hover:bg-surface-high/50"
            onClick={onEdit}
            title="Edit idea"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors rounded-sm hover:bg-destructive/10"
            onClick={onDelete}
            title="Delete idea"
            aria-label="Delete idea"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Thesis preview */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {idea.thesis}
      </p>

      {/* Theme tags */}
      {idea.tags_json.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {idea.tags_json.map((tag) => (
            <span key={tag} className="bg-surface-high text-muted-foreground text-3xs font-bold px-2 py-0.5 rounded-sm">
              {formatThemeName(tag)}
            </span>
          ))}
        </div>
      )}

      {/* Scores row */}
      <div className="flex items-center gap-4 pt-1 border-t border-border/10 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Conviction:</span>
          <span className="font-bold font-mono text-foreground tabular-nums">{idea.conviction_score}/10</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Rank:</span>
          <span className="font-bold font-mono text-primary tabular-nums">
            {(idea.rank_score * 100).toFixed(0)}%
          </span>
        </div>
        <span className="text-2xs text-muted-foreground ml-auto tabular-nums">
          {new Date(idea.updated_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
