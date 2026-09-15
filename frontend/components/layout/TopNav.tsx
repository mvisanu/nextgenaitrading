"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";

export function TopNav({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <h1 data-testid="page-title" className="truncate text-base font-semibold text-foreground">{title}</h1>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <Link href="/research?view=alerts" aria-label="Alerts" title="Alerts" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Bell className="h-4 w-4" /></Link>
        <Link href="/settings" aria-label="Settings" title="Settings" className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><Settings className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
