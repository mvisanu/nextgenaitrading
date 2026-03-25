/**
 * buy-zone.spec.ts — Buy Zone Estimator API E2E tests
 *
 * Covers:
 *   BZ-01  GET /api/stocks/{ticker}/buy-zone returns snapshot or triggers calculation
 *   BZ-02  Response includes all required fields
 *   BZ-03  confidence_score is within 0.0–1.0
 *   BZ-04  buy_zone_low < buy_zone_high
 *   BZ-05  explanation is a non-empty array of strings
 *   BZ-06  GET returns 401 without authentication
 *   BZ-07  POST /api/stocks/{ticker}/recalculate-buy-zone forces recalculation
 *   BZ-08  Recalculate returns 401 without authentication
 *   BZ-09  Recalculate response has same required fields as GET
 *   BZ-10  Invalid ticker returns 400 or 404 (not 200)
 *   BZ-11  No banned language ("guaranteed profit", "safe entry", etc.) in response
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A, STOCK_SYMBOL, ETF_SYMBOL } from "../fixtures/test-data";
import {
  getBuyZone,
  recalculateBuyZone,
  loginAsNewUser,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser } from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// Required response fields per the BuyZoneSnapshot schema
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_FIELDS = [
  "ticker",
  "current_price",
  "buy_zone_low",
  "buy_zone_high",
  "confidence_score",
  "entry_quality_score",
  "expected_return_30d",
  "expected_return_90d",
  "expected_drawdown",
  "positive_outcome_rate_30d",
  "positive_outcome_rate_90d",
  "invalidation_price",
  "explanation",
] as const;

// Banned phrases that must never appear in any API response
const BANNED_PHRASES = [
  "guaranteed profit",
  "no chance of loss",
  "safe entry",
  "certain to go up",
  "buy now",
];

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Buy Zone API — GET /api/stocks/{ticker}/buy-zone", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("BZ-01: returns 200 for a valid ticker", async ({ request }) => {
    const { ok, status } = await getBuyZone(request, STOCK_SYMBOL);
    // The endpoint may return 200 (snapshot exists) or trigger async calc
    // Accept 200 or 202 depending on backend implementation
    expect(ok).toBe(true);
    expect([200, 202]).toContain(status);
  });

  test("BZ-02: response includes all required fields", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    for (const field of REQUIRED_FIELDS) {
      expect(body).toHaveProperty(field);
    }
  });

  test("BZ-03: confidence_score is within 0.0–1.0", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const score = body.confidence_score as number;
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test("BZ-04: buy_zone_low is less than buy_zone_high", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const low = body.buy_zone_low as number;
    const high = body.buy_zone_high as number;
    expect(typeof low).toBe("number");
    expect(typeof high).toBe("number");
    expect(low).toBeLessThan(high);
  });

  test("BZ-05: explanation is a non-empty array of strings", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const explanation = body.explanation as unknown[];
    expect(Array.isArray(explanation)).toBe(true);
    expect(explanation.length).toBeGreaterThan(0);
    for (const item of explanation) {
      expect(typeof item).toBe("string");
    }
  });

  test("BZ-06: returns 401 when unauthenticated", async ({ request }) => {
    // Log out first
    await request.post(`${API_URL}/auth/logout`);

    const res = await request.get(`${API_URL}/stocks/${STOCK_SYMBOL}/buy-zone`);
    expect(res.status()).toBe(401);
  });

  test("BZ-07: positive_outcome_rate_30d is within 0.0–1.0", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const rate = body.positive_outcome_rate_30d as number;
    expect(typeof rate).toBe("number");
    expect(rate).toBeGreaterThanOrEqual(0.0);
    expect(rate).toBeLessThanOrEqual(1.0);
  });

  test("BZ-08: expected_drawdown is a negative number (penalty)", async ({ request }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const drawdown = body.expected_drawdown as number;
    expect(typeof drawdown).toBe("number");
    // Expected drawdown should represent a downside (negative percent)
    expect(drawdown).toBeLessThan(0);
  });

  test("BZ-09: no banned profit-guarantee language in response body", async ({
    request,
  }) => {
    const { ok, body } = await getBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const bodyStr = JSON.stringify(body).toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      expect(bodyStr).not.toContain(phrase.toLowerCase());
    }
  });

  test("BZ-10: works for ETF ticker (SPY)", async ({ request }) => {
    const { ok } = await getBuyZone(request, ETF_SYMBOL);
    expect(ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stocks/{ticker}/recalculate-buy-zone
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Buy Zone API — POST /api/stocks/{ticker}/recalculate-buy-zone", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("BZ-11: returns 200 and triggers recalculation", async ({ request }) => {
    const { ok, status } = await recalculateBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect([200, 202]).toContain(status);
  });

  test("BZ-12: recalculate response includes all required fields", async ({ request }) => {
    const { ok, body } = await recalculateBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    for (const field of REQUIRED_FIELDS) {
      expect(body).toHaveProperty(field);
    }
  });

  test("BZ-13: recalculate returns 401 when unauthenticated", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);

    const res = await request.post(
      `${API_URL}/stocks/${STOCK_SYMBOL}/recalculate-buy-zone`
    );
    expect(res.status()).toBe(401);
  });

  test("BZ-14: recalculate returns a fresh snapshot with a recent timestamp", async ({
    request,
  }) => {
    const { ok, body } = await recalculateBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    // created_at or calculated_at should be close to now
    const ts = (body.created_at ?? body.calculated_at) as string | undefined;
    if (ts) {
      const age = Date.now() - new Date(ts).getTime();
      // Should be calculated within the last 60 seconds
      expect(age).toBeLessThan(60_000);
    }
  });

  test("BZ-15: ticker in response matches the requested ticker", async ({ request }) => {
    const { ok, body } = await recalculateBuyZone(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body.ticker).toBe(STOCK_SYMBOL);
  });
});
