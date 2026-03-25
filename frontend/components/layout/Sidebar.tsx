"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Radio,
  FileCode,
  BookOpen,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  User,
  LogOut,
  Crosshair,
  Lightbulb,
  Bell,
  Zap,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "./AppShell";
import { scannerApi } from "@/lib/api";

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
    href: "/strategy-samples",
    label: "Strategy Samples",
    icon: BookOpen,
  },
  {
    href: "/trade-log",
    label: "Trade Log",
    icon: ClipboardList,
  },
  {
    href: "/opportunities",
    label: "Opportunities",
    icon: Crosshair,
  },
  {
    href: "/ideas",
    label: "Ideas",
    icon: Lightbulb,
  },
  {
    href: "/alerts",
    label: "Alerts",
    icon: Bell,
  },
  {
    href: "/auto-buy",
    label: "Auto-Buy",
    icon: Zap,
  },
  {
    href: "/learn",
    label: "Learn to Trade",
    icon: GraduationCap,
  },
  {
    href: "/faq",
    label: "FAQ & Strategies",
    icon: HelpCircle,
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
  },
];

// ─── Scanner status indicator ─────────────────────────────────────────────────

function ScannerStatusDot() {
  const { data } = useQuery({
    queryKey: ["scanner-status-sidebar"],
    queryFn: scannerApi.status,
    // Poll every 5 minutes; this is a low-priority status indicator
    refetchInterval: 5 * 60_000,
    // Don't block auth — query runs only when the page is loaded; no enabled guard
    // because this component is only rendered for authenticated users (inside AppShell)
  });

  if (!data) return null;

  const isActive = data.market_hours_active;
  const hasQueue = data.tickers_in_queue > 0;

  if (!isActive) {
    return (
      <span
        title="Scanner: market closed"
        className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0"
      />
    );
  }

  return (
    <span
      title={`Scanner active — ${data.tickers_in_queue} ticker${data.tickers_in_queue !== 1 ? "s" : ""} in queue`}
      className={cn(
        "ml-1 inline-block h-1.5 w-1.5 rounded-full shrink-0",
        hasQueue ? "bg-green-400 animate-pulse" : "bg-green-400/50"
      )}
    />
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Derive initials for the user avatar
  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "NG";

  return (
    <aside
      className={cn(
        "group flex h-full flex-col border-r border-border bg-card",
        "w-12 hover:w-[200px] transition-[width] duration-200 ease-in-out overflow-hidden"
      )}
    >
      {/* Logo area */}
      <div className="flex h-[38px] shrink-0 items-center border-b border-border px-3 overflow-hidden">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32" fill="none" className="shrink-0">
          <rect width="32" height="32" rx="6" fill="#131722"/>
          <line x1="8" y1="8" x2="8" y2="22" stroke="#ef5350" strokeWidth="1.2"/>
          <rect x="6" y="11" width="4" height="7" rx="0.5" fill="#ef5350"/>
          <line x1="14" y1="10" x2="14" y2="24" stroke="#26a69a" strokeWidth="1.2"/>
          <rect x="12" y="13" width="4" height="7" rx="0.5" fill="#26a69a"/>
          <line x1="20" y1="6" x2="20" y2="20" stroke="#26a69a" strokeWidth="1.2"/>
          <rect x="18" y="8" width="4" height="8" rx="0.5" fill="#26a69a"/>
          <line x1="5" y1="24" x2="26" y2="8" stroke="#2962ff" strokeWidth="1.8" strokeLinecap="round"/>
          <polygon points="26,8 23,10.5 24.5,12" fill="#2962ff"/>
        </svg>
        <span className="ml-2 text-xs font-semibold tracking-tight text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          NextGenStock
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {navLinks.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          const isOpportunities = link.href === "/opportunities";
          return (
            <Link key={link.href} href={link.href} title={link.label}>
              <span
                className={cn(
                  "relative flex items-center h-10 px-3 text-xs font-medium transition-colors overflow-hidden",
                  "hover:bg-secondary",
                  isActive
                    ? "text-primary before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <link.icon className="h-5 w-5 shrink-0" />
                <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1">
                  {link.label}
                  {isOpportunities && <ScannerStatusDot />}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User avatar + sign out */}
      <div className="shrink-0 border-t border-border">
        {/* User avatar row */}
        <div
          className="flex items-center h-10 px-3 overflow-hidden"
          title={user?.email ?? "User"}
        >
          <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-[9px] font-semibold text-primary leading-none">
              {initials}
            </span>
          </div>
          <span className="ml-3 text-xs text-muted-foreground truncate whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {user?.email ?? ""}
          </span>
        </div>

        {/* Sign out row */}
        <button
          onClick={() => void logout()}
          title="Sign out"
          className={cn(
            "flex items-center h-10 w-full px-3 overflow-hidden",
            "text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
