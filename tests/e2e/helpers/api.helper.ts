/**
 * API helper utilities for NextGenStock E2E tests.
 *
 * These wrappers call the FastAPI backend directly from within tests,
 * bypassing the browser for setup / teardown and cross-user checks.
 */

import { type APIRequestContext } from "@playwright/test";
import {
  API_URL,
  USER_A,
  USER_B,
  ALPACA_CRED,
  STOCK_SYMBOL,
} from "../fixtures/test-data";

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export async function registerUser(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
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

export async function logoutUser(request: APIRequestContext): Promise<void> {
  await request.post(`${API_URL}/auth/logout`);
}

export async function refreshToken(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/auth/refresh`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
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
    const res = await request.post(`${API_URL}/auth/register`, {
      data: { email: user.email, password: user.password },
    });
    // 409 = already exists; that is fine
    if (!res.ok() && res.status() !== 409) {
      throw new Error(`Failed to register ${user.email}: ${res.status()}`);
    }
  }
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
