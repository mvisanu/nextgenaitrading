/**
 * API helper utilities for NextGenStock E2E tests.
 *
 * These wrappers call the FastAPI backend directly from within tests,
 * bypassing the browser for setup / teardown and cross-user checks.
 */

import { type APIRequestContext } from "@playwright/test";
import {
  API_URL,
  BASE_URL,
  USER_A,
  USER_B,
  ALPACA_CRED,
  STOCK_SYMBOL,
} from "../fixtures/test-data";

// ─────────────────────────────────────────────────────────────────────────────
// Auth — Supabase-compatible (uses /test/token for E2E JWT generation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtain a valid JWT for the given email via the debug-only /test/token endpoint.
 * Auto-provisions the user in the DB if needed. Returns the Bearer token string.
 */
export async function getTestToken(
  request: APIRequestContext,
  email: string
): Promise<{ token: string; userId: number }> {
  const res = await request.post(`${API_URL}/test/token`, {
    data: { email },
  });
  if (!res.ok()) {
    throw new Error(`/test/token failed: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { token: body.access_token, userId: body.user_id };
}

/**
 * Create an authenticated API request context with the Bearer token set.
 * Returns a new APIRequestContext that includes the Authorization header.
 * Caller must dispose() when done.
 */
export async function createAuthenticatedContext(
  playwright: { request: { newContext: (opts: Record<string, unknown>) => Promise<APIRequestContext> } },
  token: string
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Legacy registerUser — calls /test/token to provision user (register endpoint removed).
 * Kept for backward compatibility with existing test code.
 */
export async function registerUser(
  request: APIRequestContext,
  email: string,
  _password?: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/test/token`, {
    data: { email },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

/**
 * Legacy loginUser — now uses /test/token to get JWT and sets it on the request context.
 * Note: Playwright request contexts don't support setting headers after creation,
 * so this returns the token info. Use createAuthenticatedContext for Bearer auth.
 */
export async function loginUser(
  request: APIRequestContext,
  email: string,
  _password?: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/test/token`, {
    data: { email },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getMe(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/auth/me`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getMeWithToken(
  request: APIRequestContext,
  token: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function logoutUser(_request: APIRequestContext): Promise<void> {
  // Supabase handles logout on the frontend — no backend endpoint needed
}

export async function refreshToken(
  _request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  // Supabase handles refresh — no backend endpoint
  return { ok: false, status: 404, body: { detail: "removed" } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────────────

export async function getProfile(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/profile`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function patchProfile(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.patch(`${API_URL}/profile`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Broker credentials
// ─────────────────────────────────────────────────────────────────────────────

export async function createCredential(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/broker/credentials`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function listCredentials(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/broker/credentials`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function deleteCredential(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number }> {
  const res = await request.delete(`${API_URL}/broker/credentials/${id}`);
  return { ok: res.ok(), status: res.status() };
}

export async function testCredential(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/broker/credentials/${id}/test`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtests
// ─────────────────────────────────────────────────────────────────────────────

export async function runBacktest(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/backtests/run`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function listBacktests(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/backtests`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getBacktest(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/backtests/${id}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getBacktestTrades(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/backtests/${id}/trades`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getBacktestLeaderboard(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/backtests/${id}/leaderboard`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getBacktestChartData(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/backtests/${id}/chart-data`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategies
// ─────────────────────────────────────────────────────────────────────────────

export async function runAiPick(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/strategies/ai-pick/run`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function runBLSH(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/strategies/buy-low-sell-high/run`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function listStrategyRuns(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/strategies/runs`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getStrategyRun(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/strategies/runs/${id}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Live trading
// ─────────────────────────────────────────────────────────────────────────────

export async function runSignalCheck(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/live/run-signal-check`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function executeOrder(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/live/execute`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getLiveOrders(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/live/orders`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getLivePositions(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/live/positions`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getLiveStatus(
  request: APIRequestContext,
  credentialId?: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const url = credentialId
    ? `${API_URL}/live/status?credential_id=${credentialId}`
    : `${API_URL}/live/status`;
  const res = await request.get(url);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifacts
// ─────────────────────────────────────────────────────────────────────────────

export async function listArtifacts(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/artifacts`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function getArtifact(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/artifacts/${id}`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getPineScript(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/artifacts/${id}/pine-script`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure USER_A and USER_B exist, returning their session-scoped
 * API request contexts (already authenticated).
 *
 * Call this in test beforeEach blocks that need two distinct users.
 */
export async function setupTwoUsers(
  request: APIRequestContext
): Promise<void> {
  for (const user of [USER_A, USER_B]) {
    await getTestToken(request, user.email);
  }
}

/**
 * Authenticate a Playwright browser context via the dev_token cookie.
 * Call this in beforeEach for browser (page-based) tests that need auth.
 *
 * @param request - The Playwright APIRequestContext (to call /test/token)
 * @param browserContext - The Playwright BrowserContext from page.context()
 * @param email - The user email to authenticate as
 * @param baseUrl - Frontend base URL (for cookie domain scoping)
 */
export async function setBrowserAuth(
  request: APIRequestContext,
  browserContext: import("@playwright/test").BrowserContext,
  email: string,
  baseUrl: string = BASE_URL
): Promise<void> {
  const { token } = await getTestToken(request, email);
  const url = new URL(baseUrl);
  await browserContext.addCookies([
    {
      name: "dev_token",
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    // Also set auth_session=1 so the middleware cross-origin check passes
    {
      name: "auth_session",
      value: "1",
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Create a default Alpaca credential for the currently logged-in user
 * and return its id.
 */
export async function createDefaultCredential(
  request: APIRequestContext
): Promise<number> {
  const { ok, body } = await createCredential(request, ALPACA_CRED);
  if (!ok) throw new Error(`Failed to create credential: ${JSON.stringify(body)}`);
  return (body as { id: number }).id;
}

/**
 * Run a conservative backtest on AAPL and return the resulting run ID.
 * Useful for tests that need an existing run record without caring about
 * the strategy details.
 */
export async function createTestBacktestRun(
  request: APIRequestContext,
  symbol: string = STOCK_SYMBOL
): Promise<number> {
  const { ok, body } = await runBacktest(request, {
    symbol,
    timeframe: "1d",
    mode: "conservative",
  });
  if (!ok) throw new Error(`Failed to create backtest run: ${JSON.stringify(body)}`);
  return (body as { id: number }).id;
}
