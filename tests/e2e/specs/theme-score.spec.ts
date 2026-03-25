/**
 * theme-score.spec.ts — Theme / World Trend Scoring Engine API E2E tests
 *
 * Covers:
 *   TS-01  GET /api/stocks/{ticker}/theme-score returns theme score data
 *   TS-02  Response includes required fields
 *   TS-03  theme_score_total is within 0.0–1.0
 *   TS-04  theme_scores_by_category is a non-empty object with numeric values
 *   TS-05  Component scores (narrative_momentum, sector_tailwind, macro_alignment) in range
 *   TS-06  explanation is a non-empty array of strings
 *   TS-07  GET returns 401 without authentication
 *   TS-08  POST /api/stocks/{ticker}/theme-score/recompute forces recomputation
 *   TS-09  Recompute returns 401 without authentication
 *   TS-10  Recompute response has all required fields
 *   TS-11  Theme categories match SUPPORTED_THEMES (subset validation)
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A, STOCK_SYMBOL, ETF_SYMBOL } from "../fixtures/test-data";
import {
  getThemeScore,
  recomputeThemeScore,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser } from "../helpers/api.helper";

// Supported themes per prompt-feature.md Feature D
const SUPPORTED_THEMES = [
  "ai",
  "renewable_energy",
  "power_infrastructure",
  "data_centers",
  "space_economy",
  "aerospace",
  "defense",
  "robotics",
  "semiconductors",
  "cybersecurity",
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stocks/{ticker}/theme-score
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Theme Score API — GET /api/stocks/{ticker}/theme-score", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("TS-01: returns 200 for a valid ticker", async ({ request }) => {
    const { ok, status } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect([200, 202]).toContain(status);
  });

  test("TS-02: response includes required top-level fields", async ({ request }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    expect(body).toHaveProperty("ticker");
    expect(body).toHaveProperty("theme_score_total");
    expect(body).toHaveProperty("theme_scores_by_category");
    expect(body).toHaveProperty("narrative_momentum_score");
    expect(body).toHaveProperty("sector_tailwind_score");
    expect(body).toHaveProperty("macro_alignment_score");
    expect(body).toHaveProperty("explanation");
  });

  test("TS-03: theme_score_total is within 0.0–1.0", async ({ request }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const total = body.theme_score_total as number;
    expect(typeof total).toBe("number");
    expect(total).toBeGreaterThanOrEqual(0.0);
    expect(total).toBeLessThanOrEqual(1.0);
  });

  test("TS-04: theme_scores_by_category contains numeric values in 0.0–1.0 range", async ({
    request,
  }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const byCategory = body.theme_scores_by_category as Record<string, unknown>;
    expect(typeof byCategory).toBe("object");
    expect(byCategory).not.toBeNull();

    // Every value must be a valid 0–1 score
    for (const [category, score] of Object.entries(byCategory)) {
      expect(typeof score).toBe("number");
      expect(score as number).toBeGreaterThanOrEqual(0.0);
      expect(score as number).toBeLessThanOrEqual(1.0);
      // Category key must be in the supported themes list
      expect(SUPPORTED_THEMES).toContain(category);
    }
  });

  test("TS-05: component scores (narrative_momentum, sector_tailwind, macro_alignment) are in 0.0–1.0", async ({
    request,
  }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    for (const field of [
      "narrative_momentum_score",
      "sector_tailwind_score",
      "macro_alignment_score",
    ]) {
      const score = body[field] as number;
      expect(typeof score).toBe("number");
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });

  test("TS-06: explanation is a non-empty array of strings", async ({ request }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const explanation = body.explanation as unknown[];
    expect(Array.isArray(explanation)).toBe(true);
    expect(explanation.length).toBeGreaterThan(0);
    for (const item of explanation) {
      expect(typeof item).toBe("string");
    }
  });

  test("TS-07: returns 401 when unauthenticated", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);

    const res = await request.get(`${API_URL}/stocks/${STOCK_SYMBOL}/theme-score`);
    expect(res.status()).toBe(401);
  });

  test("TS-08: ticker in response matches the requested ticker", async ({ request }) => {
    const { ok, body } = await getThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body.ticker).toBe(STOCK_SYMBOL);
  });

  test("TS-09: works for ETF ticker (SPY)", async ({ request }) => {
    const { ok } = await getThemeScore(request, ETF_SYMBOL);
    expect(ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/stocks/{ticker}/theme-score/recompute
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Theme Score API — POST /api/stocks/{ticker}/theme-score/recompute", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("TS-10: recompute returns 200 and all required fields", async ({ request }) => {
    const { ok, body } = await recomputeThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    expect(body).toHaveProperty("ticker");
    expect(body).toHaveProperty("theme_score_total");
    expect(body).toHaveProperty("theme_scores_by_category");
    expect(body).toHaveProperty("narrative_momentum_score");
    expect(body).toHaveProperty("sector_tailwind_score");
    expect(body).toHaveProperty("macro_alignment_score");
  });

  test("TS-11: recompute returns 401 when unauthenticated", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);

    const res = await request.post(
      `${API_URL}/stocks/${STOCK_SYMBOL}/theme-score/recompute`
    );
    expect(res.status()).toBe(401);
  });

  test("TS-12: recomputed score has ticker matching the request", async ({ request }) => {
    const { ok, body } = await recomputeThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body.ticker).toBe(STOCK_SYMBOL);
  });

  test("TS-13: recomputed theme_score_total is within valid range", async ({ request }) => {
    const { ok, body } = await recomputeThemeScore(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const total = body.theme_score_total as number;
    expect(total).toBeGreaterThanOrEqual(0.0);
    expect(total).toBeLessThanOrEqual(1.0);
  });
});
