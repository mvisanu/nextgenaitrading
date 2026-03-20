"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { getQueryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/components/layout/AppShell";

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "hsl(0 0% 7%)",
              border: "1px solid hsl(0 0% 12%)",
              color: "hsl(0 0% 95%)",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
