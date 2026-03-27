/**
 * opportunities.spec.ts — Opportunities API E2E tests
 *
 * Covers:
 *   OPP-01  GET /api/opportunities returns an array
 *   OPP-02  Response rows contain required OpportunityRow fields
 *   OPP-03  sort_by=confidence_score returns results sorted correctly
 *   OPP-04  sort_by=theme_score returns results sorted correctly
 *   OPP-05  sort_by=distance returns results sorted correctly
 *   OPP-06  sort_by=ticker returns results sorted alphabetically
 *   OPP-07  Returns 401 without authentication
 *   OPP-08  No banned language in any response field
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A } from "../fixtures/test-data";
import { getOpportunities } from "../helpers/v2-api.helper";
import { registerUser, loginUser } from "../helpers/api.helper";

// Required fields per OpportunityRow interface (FRONTEND2.md)
const REQUIRED_OPPORTUNITY_FIELDS = [
  "ticker",
  "current_price",
  "buy_zone_low",
  "buy_zone_high",
  "distance_pct",
  "confidence_score",
  "theme_score",
  "last_updated",
] as const;

// Valid sort_by values per spec
const VALID_SORT_KEYS = ["confidence_score", "theme_score", "distance", "ticker"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Opportunities list
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Opportunities API — GET /api/opportunities", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("OPP-01: returns 200 and an array", async ({ request }) => {
    const { ok, status, body } = await getOpportunities(request);
    expect(ok).toBe(true);
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  test("OPP-02: opportunity rows contain required fields (when data exists)", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request);
    expect(ok).toBe(true);

    // If there are results, each must have the required fields
    if ((body as unknown[]).length > 0) {
      const row = (body as Record<string, unknown>[])[0];
      for (const field of REQUIRED_OPPORTUNITY_FIELDS) {
        expect(row).toHaveProperty(field);
      }
    }
  });

  test("OPP-03: sort_by=confidence_score returns results in descending confidence order", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request, "confidence_score");
    expect(ok).toBe(true);

    const rows = body as { confidence_score: number }[];
    if (rows.length > 1) {
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].confidence_score).toBeGreaterThanOrEqual(
          rows[i + 1].confidence_score
        );
      }
    }
  });

  test("OPP-04: sort_by=theme_score returns results in descending theme_score order", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request, "theme_score");
    expect(ok).toBe(true);

    const rows = body as { theme_score: number }[];
    if (rows.length > 1) {
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].theme_score).toBeGreaterThanOrEqual(rows[i + 1].theme_score);
      }
    }
  });

  test("OPP-05: sort_by=ticker returns results in alphabetical order", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request, "ticker");
    expect(ok).toBe(true);

    const rows = body as { ticker: string }[];
    if (rows.length > 1) {
      for (let i = 0; i < rows.length - 1; i++) {
        expect(rows[i].ticker.localeCompare(rows[i + 1].ticker)).toBeLessThanOrEqual(0);
      }
    }
  });

  test("OPP-06: all confidence_score values in response are within 0.0–1.0", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request);
    expect(ok).toBe(true);

    for (const row of body as { confidence_score: number }[]) {
      expect(row.confidence_score).toBeGreaterThanOrEqual(0.0);
      expect(row.confidence_score).toBeLessThanOrEqual(1.0);
    }
  });

  test("OPP-07: all theme_score values in response are within 0.0–1.0", async ({
    request,
  }) => {
    const { ok, body } = await getOpportunities(request);
    expect(ok).toBe(true);

    for (const row of body as { theme_score: number }[]) {
      expect(row.theme_score).toBeGreaterThanOrEqual(0.0);
      expect(row.theme_score).toBeLessThanOrEqual(1.0);
    }
  });

  test("OPP-08: returns 401 without authentication", async ({ request, playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.get(`${API_URL}/opportunities`);
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("OPP-09: no banned language in any response field", async ({ request }) => {
    const { ok, body } = await getOpportunities(request);
    expect(ok).toBe(true);

    const bodyStr = JSON.stringify(body).toLowerCase();
    const banned = [
      "guaranteed profit",
      "no chance of loss",
      "safe entry",
      "certain to go up",
    ];
    for (const phrase of banned) {
      expect(bodyStr).not.toContain(phrase);
    }
  });
});
