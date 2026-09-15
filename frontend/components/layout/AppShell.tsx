"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { authApi } from "@/lib/api";
import { AuthContext, useAuth } from "@/lib/auth-context";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Menu } from "lucide-react";
import { MobileBottomNav } from "./MobileBottomNav";

// ─── Auth Context ──────────────────────────────────────────────────────────────

export { useAuth } from "@/lib/auth-context";

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

  const previousUser = useRef(user?.id);
  useEffect(() => {
    if (previousUser.current !== user?.id) {
      queryClient.removeQueries({ predicate: query => query.queryKey[0] !== "auth" &&
        !(query.queryKey[0] === "account" && query.queryKey[1] === user?.id) });
      previousUser.current = user?.id;
    }
  }, [user?.id, queryClient]);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client?.auth.onAuthStateChange) return;
    const { data: { subscription } } = client.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        queryClient.setQueryData(["auth", "me"], null);
        queryClient.removeQueries({ predicate: query => query.queryKey[0] !== "auth" });
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

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
      <React.Fragment key={user?.id ?? "signed-out"}>{children}</React.Fragment>
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
  const [menuOpen, setMenuOpen] = useState(false);

  // Redirect to login when auth resolves to "no user"
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?callbackUrl=${encodeURIComponent((pathname ?? "/") + window.location.search)}`);
    }
  }, [isLoading, user, router, pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar — in-flow so it pushes content instead of overlaying */}
      <div className="hidden lg:flex lg:shrink-0 lg:z-40">
        <Sidebar />
      </div>

      {/* Main content — takes remaining space */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top toolbar — Sovereign style */}
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 bg-surface-lowest px-4 border-b border-border/10">
          {/* Mobile menu */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 text-muted-foreground hover:text-foreground">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[220px] p-0 bg-surface-lowest border-r border-border/10">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Trading workspaces and settings</SheetDescription>
              <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>

          <TopNav title={title} actions={actions} />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-3 lg:p-4 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-4 bg-card">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-48 bg-surface-high" />
              <Skeleton className="h-32 w-full bg-surface-high" />
              <Skeleton className="h-24 w-full bg-surface-high" />
            </div>
          ) : user ? children : null}
        </main>


      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </div>
  );
}
