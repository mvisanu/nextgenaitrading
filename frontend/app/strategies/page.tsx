"use client";

import dynamic from "next/dynamic";
import { Workspace } from "@/components/layout/Workspace";

const View0 = dynamic(() => import("@/components/workspaces/strategies/builder"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading build & test?</p> });
const View1 = dynamic(() => import("@/components/workspaces/strategies/history"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading backtest history?</p> });
const View2 = dynamic(() => import("@/components/workspaces/strategies/saved"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading saved strategies?</p> });
const View3 = dynamic(() => import("@/components/workspaces/strategies/techniques"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading techniques?</p> });
const View4 = dynamic(() => import("@/components/workspaces/strategies/guide"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading trading guide?</p> });

const views = [
  { id: "builder", label: "Build & test", component: View0 },
  { id: "history", label: "Backtest history", component: View1 },
  { id: "saved", label: "Saved strategies", component: View2 },
  { id: "techniques", label: "Techniques", component: View3 },
  { id: "guide", label: "Trading guide", component: View4, secondary: true }
];

export default function Page() {
  return <Workspace title="Strategies" description="Test a setup before trading it. Compare returns, drawdowns, and trade history." views={views} />;
}
