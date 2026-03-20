/**
 * lib/auth.ts
 *
 * Auth helper — wraps the /auth/me call. Used by AuthContext.
 * Tokens are never stored in localStorage; cookies are managed exclusively
 * by the backend.
 */

import type { UserResponse } from "@/types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function getCurrentUser(): Promise<UserResponse | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return res.json() as Promise<UserResponse>;
  } catch {
    return null;
  }
}
