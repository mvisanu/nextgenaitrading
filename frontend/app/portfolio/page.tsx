"use client";

import dynamic from "next/dynamic";
import { Workspace } from "@/components/layout/Workspace";

const View0 = dynamic(() => import("@/components/workspaces/portfolio/holdings"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading holdings?</p> });
const View1 = dynamic(() => import("@/components/workspaces/portfolio/journal"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading trade journal?</p> });

const views = [
  { id: "holdings", label: "Holdings", component: View0 },
  { id: "journal", label: "Trade journal", component: View1 }
];

export default function Page() {
  return <Workspace title="Portfolio" description="Review holdings, exposure, and your trade journal." views={views} />;
}
