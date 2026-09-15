"use client";

import dynamic from "next/dynamic";
import { Workspace } from "@/components/layout/Workspace";

const View0 = dynamic(() => import("@/components/workspaces/settings/account"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading account & brokers?</p> });
const View1 = dynamic(() => import("@/components/workspaces/settings/schedules"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading automation schedules?</p> });
const View2 = dynamic(() => import("@/components/workspaces/settings/help"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading help?</p> });

const views = [
  { id: "account", label: "Account & brokers", component: View0 },
  { id: "schedules", label: "Automation schedules", component: View1 },
  { id: "help", label: "Help", component: View2 }
];

export default function Page() {
  return <Workspace title="Settings" description="Manage your account, broker connections, and scheduled automation." views={views} />;
}
