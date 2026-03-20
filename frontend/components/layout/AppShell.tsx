"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import type { UserResponse } from "@/types";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 lg:pl-64 min-w-0">
        {/* Top nav with mobile hamburger */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <Sidebar />
            </SheetContent>
          </Sheet>

          <TopNav title={title} actions={actions} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
