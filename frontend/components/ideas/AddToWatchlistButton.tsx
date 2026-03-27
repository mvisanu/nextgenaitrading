"use client";

/**
 * AddToWatchlistButton — one-click "Add to Watchlist" from an idea card.
 *
 * Sovereign Terminal design system applied.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generatedIdeasApi } from "@/lib/api";
import { getErrorMessage, cn } from "@/lib/utils";

interface AddToWatchlistButtonProps {
  ideaId: number;
  ticker: string;
  added_to_watchlist: boolean;
  className?: string;
}

export function AddToWatchlistButton({
  ideaId,
  ticker,
  added_to_watchlist,
  className,
}: AddToWatchlistButtonProps) {
  const queryClient = useQueryClient();
  const [isAdded, setIsAdded] = useState(added_to_watchlist);

  const { mutate, isPending } = useMutation({
    mutationFn: () => generatedIdeasApi.addToWatchlist(ideaId),
    onSuccess: () => {
      setIsAdded(true);
      toast.success(
        `${ticker} added to watchlist. Alert created for buy zone entry.`
      );
      // Refresh both opportunities and generated ideas
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["generated-ideas"] });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err, `Failed to add ${ticker} to watchlist.`));
    },
  });

  if (isAdded) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-3xs font-bold px-2 py-1 rounded-sm",
          "bg-primary/15 text-primary",
          className
        )}
        aria-label={`${ticker} is already in watchlist`}
      >
        <Check className="h-3 w-3" />
        Added
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => mutate()}
      className={cn(
        "h-7 text-xs gap-1 font-bold uppercase tracking-widest hover:bg-surface-high/50",
        className
      )}
      aria-label={`Add ${ticker} to watchlist`}
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Plus className="h-3 w-3" />
      )}
      {isPending ? "Adding…" : "Add to Watchlist"}
    </Button>
  );
}
