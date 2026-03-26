"use client";

import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useSidebarPinned } from "@/lib/sidebar";
import type { UserResponse } from "@/types";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Menu } from "lucide-react";

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
    // Don't throw on 401 — middleware handles redirect
    retry: false,
  });

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout failed silently — still clear state
    }
    // Clear the cross-origin auth marker cookie
    document.cookie = "auth_session=; path=/; max-age=0";
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
  const { pinned } = useSidebarPinned();
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
      {/* Desktop sidebar — 48px collapsed rail, expands to 200px on hover/pin */}
      <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:z-40">
        <Sidebar />
      </div>

      {/* Main content — offset by sidebar width (48px collapsed, 200px pinned) */}
      <div className={`flex flex-col flex-1 min-w-0 transition-[padding] duration-200 ${pinned ? "lg:pl-[200px]" : "lg:pl-12"}`}>
        {/* Top toolbar — always rendered so page title is immediately visible */}
        <header className="sticky top-0 z-30 flex h-[38px] shrink-0 items-center gap-2 border-b border-border bg-secondary px-3">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[200px] p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>

          <TopNav title={title} actions={actions} />
        </header>

        {/* Page content — show skeleton while auth is resolving */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : user ? children : null}
        </main>

        {/* Bottom status bar */}
        <div className="shrink-0 flex items-center h-6 px-3 border-t border-border bg-secondary text-[11px] text-muted-foreground gap-3">
          <span>NextGenStock v1.0</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-bull" />
            Connected
          </span>
          <span className="text-border">|</span>
          <span>{user?.email ?? ""}</span>
        </div>
      </div>
    </div>
  );
}
