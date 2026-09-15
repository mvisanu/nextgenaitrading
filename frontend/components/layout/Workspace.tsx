"use client";

import { Suspense, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "./AppShell";
import { useTradingSelection } from "@/lib/use-trading-selection";
import { cn } from "@/lib/utils";

export interface WorkspaceView {
  id: string;
  label: string;
  component: ComponentType;
  secondary?: boolean;
}

function WorkspaceContent({ title, description, views }: {
  title: string;
  description: string;
  views: WorkspaceView[];
}) {
  useTradingSelection();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const active = views.find((view) => view.id === params.get("view")) ?? views[0];
  const Content = active.component;
  const secondary = views.filter((view) => view.secondary);
  function href(id: string) {
    const query = new URLSearchParams(params.toString());
    query.delete("run");
    query.set("view", id);
    return `${pathname}?${query}`;
  }
  return (
    <AppShell title={title}>
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{description}</p>
      <nav aria-label={`${title} sections`} className="mb-5 flex items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-border pb-3">
        {views.filter((view) => !view.secondary).map((view) => (
          <Link key={view.id} href={href(view.id)} aria-current={active.id === view.id ? "page" : undefined}
            className={cn("shrink-0 rounded-md px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active.id === view.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            {view.label}
          </Link>
        ))}
        {secondary.length > 0 && (
          <select aria-label="More tools" value={active.secondary ? active.id : ""} onChange={(event) => router.push(href(event.target.value))}
            className="min-h-11 max-w-full shrink-0 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="" disabled>More tools</option>
            {secondary.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
          </select>
        )}
      </nav>
      <Content key={active.id} />
    </AppShell>
  );
}

export function Workspace(props: Parameters<typeof WorkspaceContent>[0]) {
  return <Suspense fallback={<p className="p-6" role="status">Loading workspace…</p>}><WorkspaceContent {...props} /></Suspense>;
}
