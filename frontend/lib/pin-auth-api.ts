const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface PinLoginResponse {
  token_hash: string;
}

export interface HasPinResponse {
  has_pin: boolean;
}

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
      ? body.detail[0]?.msg ?? `Request failed: ${res.status}`
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

  /** Verify email + PIN and get a Supabase token_hash back. Public — no auth header. */
  login: (email: string, pin: string): Promise<PinLoginResponse> =>
    publicFetch("/auth/pin-login", {
      method: "POST",
      body: JSON.stringify({ email, pin }),
    }),

  /** Bypass login with email + shared access code (BYPASS_LOGIN_CODE on the
   *  backend). Returns a Supabase token_hash. Public — no auth header. */
  codeLogin: (email: string, code: string): Promise<PinLoginResponse> =>
    publicFetch("/auth/code-login", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  /** Set or replace the user's PIN. Requires auth token in header. */
  setPin: (pin: string, accessToken: string): Promise<void> =>
    publicFetch("/auth/set-pin", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ pin }),
    }),

  /** Check whether the user has a PIN set. Requires auth token. */
  hasPin: (accessToken: string): Promise<HasPinResponse> =>
    publicFetch("/auth/has-pin", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
};
