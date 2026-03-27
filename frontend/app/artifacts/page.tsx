"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { artifactApi } from "@/lib/api";
import { formatDateTime, getModeLabel } from "@/lib/utils";
import type { Artifact } from "@/types";
import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  Download,
  ExternalLink,
  FileCode,
  Trophy,
} from "lucide-react";

export default function ArtifactsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [codeCache, setCodeCache] = useState<Record<number, string>>({});
  const [isLoadingCode, setIsLoadingCode] = useState(false);

  const { data: artifacts = [], isLoading } = useQuery({
    queryKey: ["artifacts"],
    queryFn: artifactApi.list,
  });

  async function handleRowClick(artifact: Artifact) {
    if (selectedId === artifact.id) {
      setSelectedId(null);
      return;
    }
    setSelectedId(artifact.id);

    if (!codeCache[artifact.id]) {
      setIsLoadingCode(true);
      try {
        const { code } = await artifactApi.pineScript(artifact.id);
        setCodeCache((prev) => ({ ...prev, [artifact.id]: code }));
      } catch {
        toast.error("Failed to load Pine Script code");
      } finally {
        setIsLoadingCode(false);
      }
    }
  }

  async function handleCopy(id: number) {
    const code = codeCache[id];
    if (!code) return;
    await navigator.clipboard.writeText(code);
    toast.success("Pine Script copied to clipboard");
  }

  function handleDownload(artifact: Artifact) {
    const code = codeCache[artifact.id];
    if (!code) {
      toast.error("Load the code first by selecting the artifact row");
      return;
    }
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.variant_name}_${artifact.symbol}.pine`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Artifacts">
      <div className="bg-surface-low border border-border/10 rounded-sm">
        {/* Panel header */}
        <div className="px-4 py-3 border-b border-border/10 flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
            Pine Script Artifacts
          </span>
          <span className="text-[11px] font-bold text-muted-foreground/50 tabular-nums">({artifacts.length})</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : artifacts.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <FileCode className="h-8 w-8 mx-auto text-primary/30" />
            <p className="text-sm text-muted-foreground">No Pine Script artifacts yet.</p>
            <p className="text-xs text-muted-foreground/60">
              <Link href="/strategies" className="text-primary hover:underline">
                Run an AI Pick or Buy Low / Sell High strategy
              </Link>{" "}
              to generate one.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-lowest hover:bg-surface-lowest border-border/10">
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Mode</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Variant</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Symbol</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Version</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Created</TableHead>
                  <TableHead className="text-3xs font-bold uppercase tracking-widest text-muted-foreground py-2 px-4">Actions</TableHead>
                  <TableHead className="py-2 px-2 w-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {artifacts.map((artifact) => (
                  <React.Fragment key={artifact.id}>
                    <TableRow
                      className="cursor-pointer border-border/10 hover:bg-surface-high/30 transition-colors"
                      onClick={() => handleRowClick(artifact)}
                    >
                      <TableCell className="text-xs text-muted-foreground py-2.5 px-4">
                        {getModeLabel(artifact.mode_name)}
                      </TableCell>
                      <TableCell className="text-xs font-mono py-2.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {artifact.selected_winner && (
                            <Trophy className="h-3 w-3 text-yellow-400 shrink-0" />
                          )}
                          <span className="text-foreground">{artifact.variant_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums text-foreground py-2.5 px-4">
                        {artifact.symbol}
                      </TableCell>
                      <TableCell className="py-2.5 px-4">
                        <span className="bg-primary/15 text-primary text-3xs font-bold px-2 py-0.5 rounded-sm">
                          {artifact.pine_script_version}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground py-2.5 px-4">
                        {formatDateTime(artifact.created_at)}
                      </TableCell>
                      <TableCell className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-surface-high/50"
                            title="Copy to clipboard"
                            onClick={() => handleCopy(artifact.id)}
                            disabled={!codeCache[artifact.id]}
                          >
                            <Clipboard className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-surface-high/50"
                            title="Download .pine file"
                            onClick={() => handleDownload(artifact)}
                            disabled={!codeCache[artifact.id]}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-surface-high/50"
                            title="Go to strategy run"
                            asChild
                          >
                            <Link href={`/backtests?run=${artifact.strategy_run_id}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-2">
                        {selectedId === artifact.id ? (
                          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded code viewer */}
                    {selectedId === artifact.id && (
                      <TableRow className="border-border/10">
                        <TableCell colSpan={7} className="bg-surface-lowest p-4">
                          <div className="space-y-3">
                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                Run:{" "}
                                <Link
                                  href={`/backtests?run=${artifact.strategy_run_id}`}
                                  className="text-primary hover:underline"
                                >
                                  #{artifact.strategy_run_id}
                                </Link>
                              </span>
                              <span>Symbol: <span className="font-mono text-foreground">{artifact.symbol}</span></span>
                              <span>Mode: {getModeLabel(artifact.mode_name)}</span>
                            </div>

                            {artifact.notes && (
                              <p className="text-xs text-muted-foreground italic">
                                {artifact.notes}
                              </p>
                            )}

                            {/* Code viewer */}
                            {isLoadingCode && !codeCache[artifact.id] ? (
                              <Skeleton className="h-40 w-full" />
                            ) : codeCache[artifact.id] ? (
                              <div className="relative">
                                <div className="absolute right-2 top-2 z-10 flex gap-1">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 bg-surface-high hover:bg-surface-highest"
                                    onClick={() => handleCopy(artifact.id)}
                                  >
                                    <Clipboard className="h-3 w-3" />
                                    Copy
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5 bg-surface-high hover:bg-surface-highest"
                                    onClick={() => handleDownload(artifact)}
                                  >
                                    <Download className="h-3 w-3" />
                                    .pine
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-96 rounded-sm border border-border/10 bg-surface-lowest">
                                  <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre overflow-x-auto text-foreground/80">
                                    {codeCache[artifact.id]}
                                  </pre>
                                </ScrollArea>
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
