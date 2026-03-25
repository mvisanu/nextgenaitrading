"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type LucideIcon,
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  BarChart4,
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
  Pin,
  PinOff,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useSidebarPinned } from "@/lib/sidebar";
import { useAuth } from "./AppShell";
import { scannerApi } from "@/lib/api";

// ─── Nav structure: grouped links ────────────────────────────────────────────

interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "scanner";
}

interface NavGroup {
  title: string;
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Trading",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/strategies", label: "Strategies", icon: TrendingUp },
      { href: "/backtests", label: "Backtests", icon: BarChart3 },
      { href: "/live-trading", label: "Live Trading", icon: Radio },
      { href: "/auto-buy", label: "Auto-Buy", icon: Zap },
    ],
  },
  {
    title: "Research",
    links: [
      { href: "/screener", label: "Screener & TA", icon: BarChart4 },
      { href: "/opportunities", label: "Opportunities", icon: Crosshair, badge: "scanner" },
      { href: "/ideas", label: "Ideas", icon: Lightbulb },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    title: "Tools",
    links: [
      { href: "/artifacts", label: "Artifacts", icon: FileCode },
      { href: "/strategy-samples", label: "Samples", icon: BookOpen },
      { href: "/trade-log", label: "Trade Log", icon: ClipboardList },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/learn", label: "Learn to Trade", icon: GraduationCap },
      { href: "/faq", label: "FAQ", icon: HelpCircle },
    ],
  },
];

// ─── Scanner status indicator ─────────────────────────────────────────────────

function ScannerStatusDot() {
  const { data } = useQuery({
    queryKey: ["scanner-status-sidebar"],
    queryFn: scannerApi.status,
    refetchInterval: 5 * 60_000,
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const { pinned, toggle: togglePin } = useSidebarPinned();

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "NG";

  // The expanded class: always expanded when pinned, otherwise on hover
  const expandedWidth = pinned ? "w-[200px]" : "w-12 hover:w-[200px]";

  return (
    <aside
      data-pinned={pinned || undefined}
      className={cn(
        "group flex h-full flex-col border-r border-border bg-card",
        expandedWidth,
        "transition-[width] duration-200 ease-in-out overflow-hidden"
      )}
    >
      {/* ── Logo + pin toggle ──────────────────────────────────────────── */}
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
        <span className={cn(
          "ml-2 text-xs font-semibold tracking-tight text-foreground whitespace-nowrap flex-1 transition-opacity duration-200",
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          NextGenStock
        </span>
        <button
          onClick={togglePin}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          className={cn(
            "shrink-0 h-5 w-5 flex items-center justify-center rounded transition-all duration-200",
            pinned
              ? "text-primary opacity-100"
              : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          )}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Grouped nav sections ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-1">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title}>
            {/* Group separator (skip first group) */}
            {gi > 0 && (
              <div className="mx-3 my-1 border-t border-border/50" />
            )}

            {/* Group title — visible when expanded */}
            <div className={cn(
              "px-3 pt-1.5 pb-0.5 transition-opacity duration-200",
              pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {group.title}
              </span>
            </div>

            {/* Links */}
            {group.links.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link key={link.href} href={link.href} title={link.label}>
                  <span
                    className={cn(
                      "relative flex items-center h-9 px-3 text-xs font-medium transition-colors overflow-hidden",
                      "hover:bg-secondary",
                      isActive
                        ? "text-primary before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <link.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className={cn(
                      "ml-3 whitespace-nowrap transition-opacity duration-200 flex items-center gap-1",
                      pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      {link.label}
                      {link.badge === "scanner" && <ScannerStatusDot />}
                    </span>

                    {/* Active indicator arrow (collapsed mode) */}
                    {isActive && (
                      <ChevronRight className={cn(
                        "h-3 w-3 ml-auto shrink-0 text-primary transition-opacity duration-200",
                        pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )} />
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Bottom: profile + sign out ─────────────────────────────────── */}
      <div className="shrink-0 border-t border-border">
        {/* Profile link */}
        <Link href="/profile" title="Profile">
          <span
            className={cn(
              "relative flex items-center h-10 px-3 overflow-hidden transition-colors",
              "hover:bg-secondary",
              pathname === "/profile"
                ? "text-primary before:absolute before:left-0 before:top-0 before:h-full before:w-0.5 before:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="h-6 w-6 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[9px] font-semibold text-primary leading-none">
                {initials}
              </span>
            </div>
            <span className={cn(
              "ml-3 text-xs truncate whitespace-nowrap transition-opacity duration-200",
              pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              {user?.email ?? "Profile"}
            </span>
          </span>
        </Link>

        {/* Sign out */}
        <button
          onClick={() => void logout()}
          title="Sign out"
          className={cn(
            "flex items-center h-9 w-full px-3 overflow-hidden",
            "text-xs text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors"
          )}
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          <span className={cn(
            "ml-3 whitespace-nowrap transition-opacity duration-200",
            pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
