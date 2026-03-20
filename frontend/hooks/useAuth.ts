"use client";

/**
 * hooks/useAuth.ts
 *
 * Re-exports useAuth from the AuthContext defined in AppShell.
 * Import from here to avoid coupling pages to the AppShell path directly.
 */

export { useAuth } from "@/components/layout/AppShell";
