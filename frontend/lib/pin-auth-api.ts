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

async function publicFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    // FastAPI validation errors put an array of {msg,...} in detail
    const detail = Array.isArray(body.detail)
      ? (body.detail[0]?.msg ?? `Request failed: ${res.status}`)
      : body.detail;
    throw new Error(detail ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

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
