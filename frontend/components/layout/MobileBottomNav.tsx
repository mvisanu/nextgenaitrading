"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Radio,
  Crosshair,
  Lightbulb,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Chart", icon: LayoutDashboard },
  { href: "/strategies", label: "Strategy", icon: TrendingUp },
  { href: "/live-trading", label: "Trade", icon: Radio },
  { href: "/opportunities", label: "Scanner", icon: Crosshair },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14 border-t border-border bg-card/95 backdrop-blur-sm safe-area-pb">
      {BOTTOM_NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}

      {/* "More" button opens full sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-muted-foreground active:text-foreground transition-colors">
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[200px] p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>
    </nav>
  );
}
