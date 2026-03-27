"use client";

import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import type { UserResponse } from "@/types";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Menu } from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";

// ─── Auth Context ──────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: UserResponse | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  logout: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

// ─── Providers wrapper (used in root layout) ─────────────────────────────────

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: authApi.me,
    retry: false,
  });

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout failed silently — still clear state
    }
    queryClient.clear();
    router.push("/login");
  }, [router, queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── App Shell (layout for protected pages) ──────────────────────────────────

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export function AppShell({ children, title, actions }: AppShellProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login when auth resolves to "no user"
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname ?? "/")}`);
    }
  }, [isLoading, user, router, pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — in-flow so it pushes content instead of overlaying */}
      <div className="hidden lg:flex lg:shrink-0 lg:z-40">
        <Sidebar />
      </div>

      {/* Main content — takes remaining space */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top toolbar — Sovereign style */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 bg-surface-lowest px-4 border-b border-border/10">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[220px] p-0 bg-surface-lowest border-r border-border/10">
              <Sidebar />
            </SheetContent>
          </Sheet>

          <TopNav title={title} actions={actions} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-1 lg:p-1 pb-20 lg:pb-1 bg-card">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-48 bg-surface-high" />
              <Skeleton className="h-32 w-full bg-surface-high" />
              <Skeleton className="h-24 w-full bg-surface-high" />
            </div>
          ) : user ? children : null}
        </main>

        {/* Global Footer / Market Ticker */}
        <footer className="hidden lg:flex shrink-0 items-center h-8 px-4 bg-surface-lowest border-t border-border/10 gap-6 overflow-hidden">
          <div className="flex items-center gap-2 text-2xs">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
            <span className="uppercase tracking-widest font-bold text-foreground">Market Open</span>
          </div>
          <div className="flex-1 flex gap-8 items-center whitespace-nowrap text-2xs tabular-nums text-muted-foreground overflow-hidden">
            <div className="flex gap-2"><span>EUR/USD</span><span className="text-foreground">1.0824</span><span className="text-destructive">-0.02%</span></div>
            <div className="flex gap-2"><span>GBP/USD</span><span className="text-foreground">1.2645</span><span className="text-primary">+0.15%</span></div>
            <div className="flex gap-2"><span>USD/JPY</span><span className="text-foreground">158.42</span><span className="text-destructive">-0.34%</span></div>
            <div className="flex gap-2"><span>BTC/USD</span><span className="text-foreground">65,432</span><span className="text-primary">+2.45%</span></div>
            <div className="flex gap-2"><span>ETH/USD</span><span className="text-foreground">3,452</span><span className="text-primary">+1.82%</span></div>
            <div className="flex gap-2"><span>GOLD</span><span className="text-foreground">2,342</span><span className="text-destructive">-0.05%</span></div>
          </div>
          <div className="text-3xs font-mono text-muted-foreground/40 uppercase">
            v4.2.0 | latency: 12ms
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
