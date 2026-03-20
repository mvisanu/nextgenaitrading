"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EquityCurve } from "@/components/charts/EquityCurve";
import { strategyApi, liveApi, backtestApi } from "@/lib/api";
import {
  formatDateTime,
  getModeLabel,
  getRegimeVariant,
  getSignalVariant,
} from "@/lib/utils";
import { TrendingUp, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const {
    data: runs = [],
    isLoading: runsLoading,
    error: runsError,
  } = useQuery({
    queryKey: ["strategies", "runs"],
    queryFn: () => strategyApi.listRuns(10),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["live", "positions"],
    queryFn: liveApi.positions,
  });

  // Fetch chart data for most recent backtest (if any)
  const recentBacktestId = runs.find((r) => r.run_type === "backtest")?.id;
  const { data: recentChartData } = useQuery({
    queryKey: ["backtests", recentBacktestId, "chart-data"],
    queryFn: () => backtestApi.chartData(recentBacktestId!),
    enabled: !!recentBacktestId,
  });

  if (runsError) {
    toast.error("Failed to load dashboard data");
  }

  // Compute KPIs from runs
  const totalRuns = runs.length;
  const buySignalCount = runs.filter(
    (r) => r.current_signal === "buy"
  ).length;
  const activePositions = positions.filter((p) => p.is_open).length;

  return (
    <AppShell
      title="Dashboard"
      actions={
        <Button asChild size="sm">
          <Link href="/strategies">
            <TrendingUp className="h-4 w-4" />
            New Strategy Run
          </Link>
        </Button>
      }
    >
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <KpiCard label="Total Runs" value={String(totalRuns)} loading={runsLoading} />
        <KpiCard label="Buy Signals" value={String(buySignalCount)} loading={runsLoading} />
        <KpiCard label="Active Positions" value={String(activePositions)} loading={false} />
        <KpiCard
          label="Strategies Run"
          value={String(new Set(runs.map((r) => r.symbol)).size)}
          loading={runsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Runs Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Strategy Runs</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backtests">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : runs.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No strategy runs yet.{" "}
                <Link href="/strategies" className="text-primary hover:underline">
                  Run your first strategy
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Signal</TableHead>
                    <TableHead>Regime</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.slice(0, 10).map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-mono text-xs">
                        {run.symbol}
                      </TableCell>
                      <TableCell className="text-xs">
                        {getModeLabel(run.mode_name)}
                      </TableCell>
                      <TableCell>
                        {run.current_signal ? (
                          <Badge
                            variant={getSignalVariant(run.current_signal)}
                            className="text-xs"
                          >
                            {run.current_signal.toUpperCase()}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {run.current_regime ? (
                          <Badge
                            variant={getRegimeVariant(run.current_regime)}
                            className="text-xs"
                          >
                            {run.current_regime}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(run.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Equity Sparkline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Equity Curve</CardTitle>
          </CardHeader>
          <CardContent>
            {recentChartData?.equity && recentChartData.equity.length > 0 ? (
              <EquityCurve
                equityPoints={recentChartData.equity}
                height={120}
              />
            ) : (
              <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
                Run a backtest to see equity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
