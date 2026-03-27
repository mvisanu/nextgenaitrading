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
  Wallet,
  LayoutGrid,
  Activity,
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
    title: "Terminal",
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/live-trading", label: "Live Trading", icon: Radio },
      { href: "/portfolio", label: "Portfolio", icon: Wallet },
      { href: "/auto-buy", label: "Auto-Buy", icon: Zap },
    ],
  },
  {
    title: "Analysis",
    links: [
      { href: "/screener", label: "Markets", icon: BarChart4 },
      { href: "/opportunities", label: "Watchlist", icon: Crosshair, badge: "scanner" },
      { href: "/multi-chart", label: "Multi-Chart", icon: LayoutGrid },
      { href: "/ideas", label: "Ideas", icon: Lightbulb },
      { href: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    title: "Strategy",
    links: [
      { href: "/strategies", label: "Strategies", icon: TrendingUp },
      { href: "/backtests", label: "Backtests", icon: BarChart3 },
      { href: "/strategy-samples", label: "Samples", icon: BookOpen },
    ],
  },
  {
    title: "System",
    links: [
      { href: "/artifacts", label: "Artifacts", icon: FileCode },
      { href: "/trade-log", label: "Ledger", icon: ClipboardList },
      { href: "/learn", label: "Academy", icon: GraduationCap },
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
        hasQueue ? "bg-primary animate-pulse" : "bg-primary/50"
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
    : "SV";

  const expandedWidth = pinned ? "w-[220px]" : "w-12 hover:w-[220px]";

  return (
    <aside
      data-pinned={pinned || undefined}
      className={cn(
        "group flex h-full flex-col bg-surface-lowest",
        expandedWidth,
        "transition-[width] duration-200 ease-in-out overflow-hidden"
      )}
    >
      {/* ── Brand + pin toggle ──────────────────────────────────────── */}
      <div className="flex h-12 shrink-0 items-center px-3 overflow-hidden">
        {/* Sovereign logo mark */}
        <div className="h-7 w-7 shrink-0 rounded bg-primary/10 flex items-center justify-center">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div className={cn(
          "ml-2.5 flex flex-col whitespace-nowrap transition-opacity duration-200",
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <span className="text-sm font-black tracking-tighter text-foreground">
            NextGenAi Trading
          </span>
          <span className="text-3xs text-primary tracking-widest uppercase opacity-80">
            Institutional Tier
          </span>
        </div>
        <button
          onClick={togglePin}
          title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
          className={cn(
            "shrink-0 h-5 w-5 ml-auto flex items-center justify-center rounded transition-all duration-200",
            pinned
              ? "text-primary opacity-100"
              : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
          )}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Grouped nav sections ───────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title}>
            {/* Group separator */}
            {gi > 0 && (
              <div className="mx-3 my-2 border-t border-border/10" />
            )}

            {/* Group title */}
            <div className={cn(
              "px-3 pt-2 pb-1 transition-opacity duration-200",
              pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <span className="text-3xs font-semibold uppercase tracking-widest text-muted-foreground/50">
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
                      "relative flex items-center h-9 px-3 text-[11px] font-semibold uppercase tracking-widest transition-all duration-150 overflow-hidden",
                      isActive
                        ? "text-primary bg-surface-mid border-l-[3px] border-primary"
                        : "text-muted-foreground hover:bg-surface-mid/50 hover:text-foreground hover:translate-x-0.5 border-l-[3px] border-transparent"
                    )}
                  >
                    <link.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className={cn(
                      "ml-3 whitespace-nowrap transition-opacity duration-200 flex items-center gap-1",
                      pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      {link.label}
                      {link.badge === "scanner" && <ScannerStatusDot />}
                    </span>

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

      {/* ── Bottom: profile + sign out ─────────────────────────────── */}
      <div className="shrink-0 border-t border-border/10">
        {/* Profile link */}
        <Link href="/profile" title="Profile">
          <span
            className={cn(
              "relative flex items-center h-10 px-3 overflow-hidden transition-colors",
              "hover:bg-surface-mid/50",
              pathname === "/profile"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="h-7 w-7 shrink-0 rounded-sm bg-surface-high flex items-center justify-center border border-border/10">
              <span className="text-3xs font-bold text-primary leading-none">
                {initials}
              </span>
            </div>
            <div className={cn(
              "ml-2.5 flex flex-col whitespace-nowrap transition-opacity duration-200",
              pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}>
              <span className="text-[11px] font-semibold text-foreground truncate max-w-[140px]">
                {user?.email ?? "Profile"}
              </span>
              <span className="text-3xs text-muted-foreground/60 uppercase tracking-widest">
                AI Trader
              </span>
            </div>
          </span>
        </Link>

        {/* Support + API Status */}
        <div className={cn(
          "px-3 py-2 space-y-1.5 transition-opacity duration-200",
          pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          <div className="flex items-center gap-2 text-muted-foreground/50 text-3xs uppercase tracking-widest">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Support</span>
          </div>
          <div className="flex items-center gap-2 text-primary/70 text-3xs uppercase tracking-widest">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
            <span>API Status</span>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => void logout()}
          title="Sign out"
          className={cn(
            "flex items-center h-9 w-full px-3 overflow-hidden border-t border-border/10",
            "text-[11px] uppercase tracking-widest text-muted-foreground/40 hover:text-destructive hover:bg-surface-mid/30 transition-colors"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(
            "ml-3 whitespace-nowrap font-semibold transition-opacity duration-200",
            pinned ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
