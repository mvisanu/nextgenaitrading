"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isNavActive } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-surface-lowest pb-[env(safe-area-inset-bottom)] lg:hidden">
      {PRIMARY_NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={isNavActive(pathname, href) ? "page" : undefined}
          className={cn("flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-ring", isNavActive(pathname, href) ? "text-primary" : "text-muted-foreground")}>
          <Icon aria-hidden="true" className="h-5 w-5" />{label}
        </Link>
      ))}
    </nav>
  );
}
