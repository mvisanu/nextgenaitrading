/**
 * v2-api.helper.ts — API helper utilities for NextGenStock v2 E2E tests.
 *
 * Covers the following new endpoints:
 *   - Buy Zone:    GET /api/stocks/{ticker}/buy-zone
 *                 POST /api/stocks/{ticker}/recalculate-buy-zone
 *   - Theme Score: GET /api/stocks/{ticker}/theme-score
 *                 POST /api/stocks/{ticker}/theme-score/recompute
 *   - Alerts:     GET/POST /api/alerts
 *                 PATCH/DELETE /api/alerts/{id}
 *   - Ideas:      GET/POST /api/ideas
 *                 PATCH/DELETE /api/ideas/{id}
 *   - Auto-Buy:   GET/PATCH /api/auto-buy/settings
 *                 GET /api/auto-buy/decision-log
 *                 POST /api/auto-buy/dry-run/{ticker}
 *   - Opportunities: GET /api/opportunities
 */

import { type APIRequestContext } from "@playwright/test";
import { API_URL } from "../fixtures/test-data";

// ─────────────────────────────────────────────────────────────────────────────
// Buy Zone
// ─────────────────────────────────────────────────────────────────────────────

export async function getBuyZone(
  request: APIRequestContext,
  ticker: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/stocks/${ticker}/buy-zone`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function recalculateBuyZone(
  request: APIRequestContext,
  ticker: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/stocks/${ticker}/recalculate-buy-zone`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Score
// ─────────────────────────────────────────────────────────────────────────────

export async function getThemeScore(
  request: APIRequestContext,
  ticker: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/stocks/${ticker}/theme-score`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function recomputeThemeScore(
  request: APIRequestContext,
  ticker: string
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/stocks/${ticker}/theme-score/recompute`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerts
// ─────────────────────────────────────────────────────────────────────────────

export type AlertType =
  | "entered_buy_zone"
  | "near_buy_zone"
  | "below_invalidation"
  | "confidence_improved"
  | "theme_score_increased"
  | "macro_deterioration";

export interface CreateAlertPayload {
  ticker: string;
  alert_type: AlertType;
  threshold_json?: Record<string, unknown>;
  cooldown_minutes?: number;
  market_hours_only?: boolean;
  enabled?: boolean;
}

export async function listAlerts(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/alerts`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function createAlert(
  request: APIRequestContext,
  data: CreateAlertPayload
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/alerts`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function updateAlert(
  request: APIRequestContext,
  id: number,
  data: Partial<CreateAlertPayload>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.patch(`${API_URL}/alerts/${id}`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function deleteAlert(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number }> {
  const res = await request.delete(`${API_URL}/alerts/${id}`);
  return { ok: res.ok(), status: res.status() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ideas
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateIdeaPayload {
  title: string;
  thesis: string;
  conviction_score: number;
  watch_only?: boolean;
  tradable?: boolean;
  tags_json?: string[];
  tickers?: { ticker: string; is_primary: boolean }[];
}

export async function listIdeas(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const res = await request.get(`${API_URL}/ideas`);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function createIdea(
  request: APIRequestContext,
  data: CreateIdeaPayload
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/ideas`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function updateIdea(
  request: APIRequestContext,
  id: number,
  data: Partial<CreateIdeaPayload>
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.patch(`${API_URL}/ideas/${id}`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function deleteIdea(
  request: APIRequestContext,
  id: number
): Promise<{ ok: boolean; status: number }> {
  const res = await request.delete(`${API_URL}/ideas/${id}`);
  return { ok: res.ok(), status: res.status() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-Buy
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoBuySettingsPayload {
  enabled?: boolean;
  paper_mode?: boolean;
  confidence_threshold?: number;
  max_trade_amount?: number;
  max_position_percent?: number;
  max_expected_drawdown?: number;
  allow_near_earnings?: boolean;
  allowed_account_ids_json?: string[];
}

export async function getAutoBuySettings(
  request: APIRequestContext
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.get(`${API_URL}/auto-buy/settings`);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function updateAutoBuySettings(
  request: APIRequestContext,
  data: AutoBuySettingsPayload
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await request.patch(`${API_URL}/auto-buy/settings`, { data });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

export async function getAutoBuyDecisionLog(
  request: APIRequestContext,
  limit?: number
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  // Backend uses page_size param (not limit)
  const url = limit
    ? `${API_URL}/auto-buy/decision-log?page_size=${limit}`
    : `${API_URL}/auto-buy/decision-log`;
  const res = await request.get(url);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

export async function autoBuyDryRun(
  request: APIRequestContext,
  ticker: string,
  credential_id?: number
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  // Pydantic v2 requires a JSON body even when all fields are optional.
  // Send an empty object (or credential_id if provided) so the body is present.
  const res = await request.post(`${API_URL}/auto-buy/dry-run/${ticker}`, {
    data: credential_id !== undefined ? { credential_id } : {},
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok(), status: res.status(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Opportunities
// ─────────────────────────────────────────────────────────────────────────────

export async function getOpportunities(
  request: APIRequestContext,
  sortBy?: string
): Promise<{ ok: boolean; status: number; body: unknown[] }> {
  const url = sortBy
    ? `${API_URL}/opportunities?sort_by=${sortBy}`
    : `${API_URL}/opportunities`;
  const res = await request.get(url);
  const body = await res.json().catch(() => []);
  return { ok: res.ok(), status: res.status(), body: Array.isArray(body) ? body : [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register and log in as a temporary user using a unique email.
 * Returns the email used (for cross-user tests).
 */
export async function loginAsNewUser(
  request: APIRequestContext,
  suffix?: string
): Promise<string> {
  const tag = suffix ?? Date.now().toString();
  const email = `e2e-v2-${tag}@nextgenstock.io`;
  const password = "TestPass1234!";

  const regRes = await request.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  if (!regRes.ok() && regRes.status() !== 409) {
    throw new Error(`loginAsNewUser register failed: ${regRes.status()}`);
  }

  const loginRes = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (!loginRes.ok()) {
    throw new Error(`loginAsNewUser login failed: ${loginRes.status()}`);
  }

  return email;
}

/**
 * Log out the current session via API.
 */
export async function logoutCurrent(request: APIRequestContext): Promise<void> {
  await request.post(`${API_URL}/auth/logout`);
}
