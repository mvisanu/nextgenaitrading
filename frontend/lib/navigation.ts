import { LayoutDashboard, Search, TrendingUp, Radio, Wallet } from "lucide-react";

export const PRIMARY_NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/research", label: "Research", icon: Search },
  { href: "/strategies", label: "Strategies", icon: TrendingUp },
  { href: "/trade", label: "Trade", icon: Radio },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
];

export function isNavActive(pathname: string, href: string) {
  if (href === "/research" && pathname.startsWith("/stock/")) return true;
  if (href === "/strategies" && /^\/(backtests|artifacts)\//.test(pathname)) return true;
  return pathname === href || pathname.startsWith(href + "/");
}
