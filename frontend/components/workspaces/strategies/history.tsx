"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { backtestApi } from "@/lib/api";
import { formatDateTime, getModeLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export default function BacktestHistory() {
  const router = useRouter();
  const params = useSearchParams();
  const legacyRun = params.get("run");
  useEffect(() => {
    if (legacyRun && /^[1-9]\d*$/.test(legacyRun)) router.replace(`/backtests/${legacyRun}`);
  }, [legacyRun, router]);
  const { data: runs = [], isPending, error, refetch } = useQuery({ queryKey: ["backtests"], queryFn: () => backtestApi.list(50) });
  if (isPending) return <p role="status">Loading backtests?</p>;
  if (error) return <div role="alert"><p>Backtests could not be loaded.</p><Button onClick={() => void refetch()} variant="outline">Retry</Button></div>;
  return (
    <section aria-label="Backtest history">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Backtest history</h2>
        <Button asChild><Link href="/strategies?view=builder">Build & test a strategy</Link></Button>
      </div>
      {runs.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No backtests yet. Test a strategy to start comparing results.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground"><tr>
              <th scope="col" className="px-3 py-3">Stock</th><th scope="col" className="px-3 py-3">Strategy</th><th scope="col" className="px-3 py-3">Timeframe</th><th scope="col" className="px-3 py-3">Created</th><th scope="col" className="px-3 py-3">Results</th>
            </tr></thead>
            <tbody>{runs.map((run) => <tr key={run.id} className="border-b border-border hover:bg-muted/40">
              <td className="px-3 py-4 font-semibold">{run.symbol}</td><td className="px-3 py-4">{getModeLabel(run.mode_name)}</td><td className="px-3 py-4">{run.timeframe}</td><td className="whitespace-nowrap px-3 py-4 text-muted-foreground">{formatDateTime(run.created_at)}</td><td className="px-3 py-4"><Link className="text-primary underline underline-offset-4" href={`/backtests/${run.id}`} aria-label={`View ${run.symbol} backtest ${run.id}`}>View results</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
