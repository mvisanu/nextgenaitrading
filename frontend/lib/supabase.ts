/**
 * lib/supabase.ts
 *
 * Supabase client utilities for Next.js App Router.
 * - Browser client: used in client components
 * - Server client: used in server components and middleware
 *
 * When Supabase env vars are missing, returns null so callers can
 * fall back to dev-token auth without crashing.
 */

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when Supabase credentials are configured */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

/**
 * Browser-side Supabase client (singleton).
 * Returns null if Supabase env vars are not configured.
 */
let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return browserClient;
}
