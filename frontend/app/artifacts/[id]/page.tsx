"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { artifactApi } from "@/lib/api";
import { formatDateTime, getModeLabel } from "@/lib/utils";
import { Clipboard, Download, ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ArtifactDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const artifactId = Number(id);

  const { data: artifact, isLoading: artifactLoading } = useQuery({
    queryKey: ["artifacts", artifactId],
    queryFn: () => artifactApi.get(artifactId),
    enabled: !isNaN(artifactId),
  });

  const { data: pineScript, isLoading: codeLoading } = useQuery({
    queryKey: ["artifacts", artifactId, "pine-script"],
    queryFn: () => artifactApi.pineScript(artifactId),
    enabled: !isNaN(artifactId),
  });

  async function handleCopy() {
    if (!pineScript?.code) return;
    await navigator.clipboard.writeText(pineScript.code);
    toast.success("Pine Script copied to clipboard");
  }

  function handleDownload() {
    if (!pineScript?.code || !artifact) {
      toast.error("Code not loaded yet");
      return;
    }
    const blob = new Blob([pineScript.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.variant_name}_${artifact.symbol}.pine`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const isLoading = artifactLoading || codeLoading;

  return (
    <AppShell title="Artifact Detail">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/artifacts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Artifacts
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : artifact ? (
        <div className="space-y-4">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span>
                  {getModeLabel(artifact.mode_name)} — {artifact.variant_name}
                </span>
                <Badge variant="secondary">{artifact.pine_script_version}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex gap-4 text-muted-foreground text-xs">
                <span>Symbol: <span className="font-mono text-foreground">{artifact.symbol}</span></span>
                <span>Created: {formatDateTime(artifact.created_at)}</span>
                <span>
                  Strategy run:{" "}
                  <Link
                    href={`/backtests?run=${artifact.strategy_run_id}`}
                    className="text-primary hover:underline"
                  >
                    #{artifact.strategy_run_id}
                  </Link>
                </span>
              </div>
              {artifact.notes && (
                <p className="text-xs text-muted-foreground italic">{artifact.notes}</p>
              )}
            </CardContent>
          </Card>

          {/* Pine Script code */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Pine Script v5</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleCopy}
                  disabled={!pineScript?.code}
                  data-testid="copy-button"
                  aria-label="copy pine script"
                >
                  <Clipboard className="h-3 w-3" />
                  Copy
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleDownload}
                  disabled={!pineScript?.code}
                >
                  <Download className="h-3 w-3" />
                  .pine
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {codeLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : pineScript?.code ? (
                <ScrollArea className="max-h-[600px] rounded-md border border-border bg-background">
                  <pre
                    className="p-4 text-xs font-mono leading-relaxed whitespace-pre overflow-x-auto"
                    data-testid="pine-script"
                  >
                    {pineScript.code}
                  </pre>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No Pine Script code available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Artifact not found.</p>
      )}
    </AppShell>
  );
}
