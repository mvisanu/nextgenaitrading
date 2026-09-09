"use client";

import dynamic from "next/dynamic";
import { Workspace } from "@/components/layout/Workspace";

const View0 = dynamic(() => import("@/components/workspaces/research/watchlist"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading watchlist?</p> });
const View1 = dynamic(() => import("@/components/workspaces/research/screener"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading stock screener?</p> });
const View2 = dynamic(() => import("@/components/workspaces/research/ideas"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading ideas?</p> });
const View3 = dynamic(() => import("@/components/workspaces/research/alerts"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading alerts?</p> });

const views = [
  { id: "watchlist", label: "Watchlist", component: View0 },
  { id: "screener", label: "Stock screener", component: View1 },
  { id: "ideas", label: "Ideas", component: View2 },
  { id: "alerts", label: "Alerts", component: View3 }
];

export default function Page() {
  return <Workspace title="Research" description="Find stock setups, check the evidence, and track your watchlist." views={views} />;
}
