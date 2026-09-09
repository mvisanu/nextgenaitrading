/**
 * Client for the backend's auth endpoints.
 *
 * The PIN and access-code sign-in methods (`login`, `codeLogin`,
 * `setPin`, `hasPin`) were removed when their UI was deleted from
 * /login. The backend routes (/auth/pin-login, /auth/code-login,
 * /auth/set-pin, /auth/has-pin) still exist and are untouched — they
 * simply have no caller in the frontend any more.
 *
 * `register` is likewise no longer used by /register, which now calls
 * supabase.auth.signUp() directly so account creation does not depend on
 * the API being reachable. It is kept here as the server-side path for
 * creating a pre-confirmed user.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

import { requestJson } from "./http";
function publicFetch<T>(path: string, init: RequestInit = {}) { return requestJson<T>(`${BASE_URL}${path}`, init); }

export interface RegisterResponse {
  email: string;
}

export const pinAuthApi = {
  /** Create a new account with email + password. The account is confirmed
   *  immediately (no email round-trip). Public — no auth header. */
  register: (email: string, password: string): Promise<RegisterResponse> =>
    publicFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
};
