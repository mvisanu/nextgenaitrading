"use client";

import { PRIMARY_NAV,isNavActive } from "@/lib/navigation";
import { useSidebarPinned } from "@/lib/sidebar";
import { tradingHref } from "@/lib/trading-selection";
import { useSavedTradingSelection } from "@/lib/use-trading-selection";
import { cn } from "@/lib/utils";
import { Activity,LogOut,Pin,PinOff,Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AppShell";

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const [selection] = useSavedTradingSelection();
  const { user, logout } = useAuth();
  const { pinned, toggle } = useSidebarPinned();
  const expanded = mobile || pinned;
  const links = [...PRIMARY_NAV, { href: "/settings", label: "Settings", icon: Settings }];
  return (
    <aside className={cn("flex h-full flex-col bg-surface-lowest", expanded ? "w-52" : "w-16")}>
      <div className="flex min-h-16 items-center gap-2 px-3">
        <Activity aria-hidden="true" className="h-6 w-6 shrink-0 text-primary" />
        {expanded && <span className="text-sm font-semibold">NextGen Trading</span>}
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-1 px-2 py-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href === "/settings" ? href : tradingHref(href, selection)} onClick={onNavigate} title={label} aria-label={label} aria-current={isNavActive(pathname, href) ? "page" : undefined}
            className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", isNavActive(pathname, href) ? "bg-surface-high text-primary" : "text-muted-foreground hover:bg-surface-mid hover:text-foreground")}>
            <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
            {expanded && label}
          </Link>
        ))}
      </nav>
      <div className="space-y-2 border-t border-border p-3">
        {expanded && <p className="truncate text-xs text-muted-foreground" title={user?.email}>{user?.email}</p>}
        {!mobile && <button onClick={toggle} aria-label={pinned ? "Collapse sidebar" : "Expand sidebar"} title={pinned ? "Collapse sidebar" : "Expand sidebar"} className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}{expanded && "Collapse"}
        </button>}
        <button onClick={() => void logout()} aria-label="Sign out" title="Sign out" className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <LogOut className="h-4 w-4 shrink-0" />{expanded && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
