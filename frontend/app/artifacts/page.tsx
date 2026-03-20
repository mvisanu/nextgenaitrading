"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Pine Script Artifacts ({artifacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : artifacts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No Pine Script artifacts yet.{" "}
              <Link href="/strategies" className="text-primary hover:underline">
                Run an AI Pick or Buy Low / Sell High strategy
              </Link>{" "}
              to generate one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mode</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {artifacts.map((artifact) => (
                  <React.Fragment key={artifact.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => handleRowClick(artifact)}
                    >
                      <TableCell className="text-xs">
                        {getModeLabel(artifact.mode_name)}
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        <div className="flex items-center gap-1">
                          {artifact.selected_winner && (
                            <Trophy className="h-3 w-3 text-yellow-400 shrink-0" />
                          )}
                          {artifact.variant_name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {artifact.symbol}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-xs">
                          {artifact.pine_script_version}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(artifact.created_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copy to clipboard"
                            onClick={() => handleCopy(artifact.id)}
                            disabled={!codeCache[artifact.id]}
                          >
                            <Clipboard className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Download .pine file"
                            onClick={() => handleDownload(artifact)}
                            disabled={!codeCache[artifact.id]}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Go to strategy run"
                            asChild
                          >
                            <Link
                              href={`/backtests?run=${artifact.strategy_run_id}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {selectedId === artifact.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Expanded code viewer */}
                    {selectedId === artifact.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-card/50 p-4">
                          <div className="space-y-3">
                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>
                                Strategy run:{" "}
                                <Link
                                  href={`/backtests?run=${artifact.strategy_run_id}`}
                                  className="text-primary hover:underline"
                                >
                                  #{artifact.strategy_run_id}
                                </Link>
                              </span>
                              <span>Symbol: {artifact.symbol}</span>
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
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => handleCopy(artifact.id)}
                                  >
                                    <Clipboard className="h-3 w-3" />
                                    Copy
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => handleDownload(artifact)}
                                  >
                                    <Download className="h-3 w-3" />
                                    .pine
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-96 rounded-md border border-border bg-background">
                                  <pre className="p-4 text-xs font-mono leading-relaxed whitespace-pre overflow-x-auto">
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
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
