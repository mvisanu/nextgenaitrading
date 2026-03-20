"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Radio,
  FileCode,
  User,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "./AppShell";

const navLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/strategies",
    label: "Strategies",
    icon: TrendingUp,
  },
  {
    href: "/backtests",
    label: "Backtests",
    icon: BarChart3,
  },
  {
    href: "/live-trading",
    label: "Live Trading",
    icon: Radio,
  },
  {
    href: "/artifacts",
    label: "Artifacts",
    icon: FileCode,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-6 border-b border-border">
        <Zap className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm tracking-tight">
          NextGenStock
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link key={link.href} href={link.href}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-border">
        <Separator className="mb-3" />
        {user && (
          <div className="mb-2 px-2">
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => void logout()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
