/**
 * lib/auth.ts
 *
 * Auth helper — uses Supabase client to get the current user session.
 * Returns null gracefully when Supabase is not configured.
 */

import type { UserResponse } from "@/types";
import { getSupabaseBrowserClient } from "./supabase";

export async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return {
      id: user.id,
      email: user.email ?? "",
      is_active: true,
      created_at: user.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Get the Supabase access token for sending to the backend API.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
