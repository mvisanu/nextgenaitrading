"use client";

import dynamic from "next/dynamic";
import { Workspace } from "@/components/layout/Workspace";

const View0 = dynamic(() => import("@/components/workspaces/trade/order"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading place an order?</p> });
const View1 = dynamic(() => import("@/components/workspaces/trade/auto-buy"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading auto-buy?</p> });
const View2 = dynamic(() => import("@/components/workspaces/trade/trailing"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading trailing stops?</p> });
const View3 = dynamic(() => import("@/components/workspaces/trade/options"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading options?</p> });
const View4 = dynamic(() => import("@/components/workspaces/trade/wheel"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading wheel bot?</p> });
const View5 = dynamic(() => import("@/components/workspaces/trade/copy"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading copy trading?</p> });
const View6 = dynamic(() => import("@/components/workspaces/trade/btc"), { loading: () => <p role="status" className="py-6 text-sm text-muted-foreground">Loading existing btc bot?</p> });

const views = [
  { id: "order", label: "Place an order", component: View0 },
  { id: "auto-buy", label: "Auto-buy", component: View1 },
  { id: "trailing", label: "Trailing stops", component: View2 },
  { id: "options", label: "Options", component: View3, secondary: true },
  { id: "wheel", label: "Wheel bot", component: View4, secondary: true },
  { id: "copy", label: "Copy trading", component: View5, secondary: true },
  { id: "btc", label: "Existing BTC bot", component: View6, secondary: true }
];

export default function Page() {
  return <Workspace title="Trade" description="Analyze a stock, size the order, and choose paper or broker execution." views={views} />;
}
