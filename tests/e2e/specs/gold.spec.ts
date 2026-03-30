/**
 * gold.spec.ts — Commodity Signal Engine E2E tests
 *
 * Pages covered:
 *   /gold              Overview
 *   /gold/signals      Signals list
 *   /gold/performance  Performance analytics
 *   /gold/risk         Risk management
 *
 * Test IDs:
 *   GOLD-01  Unauthenticated user redirected to /login (all 4 pages)
 *   GOLD-02  /gold overview page loads with heading
 *   GOLD-03  /gold sidebar sub-menu contains all 4 commodity links
 *   GOLD-04  /gold/signals page loads and shows signals UI
 *   GOLD-05  Signals page has symbol input and Run Analysis button
 *   GOLD-06  Signals page has timeframe filter controls
 *   GOLD-07  /gold/performance page loads and shows strategy table
 *   GOLD-08  Performance page has day-range selector
 *   GOLD-09  /gold/risk page loads and shows risk cards
 *   GOLD-10  Risk page shows daily loss cap progress indicator
 *   GOLD-11  No banned wording appears on any gold page
 *   GOLD-12  API: GET /gold/signals requires auth (401 without token)
 *   GOLD-13  API: POST /gold/analyze requires auth (401 without token)
 *   GOLD-14  API: GET /gold/risk-status requires auth (401 without token)
 *   GOLD-15  API: GET /gold/performance requires auth (401 without token)
 *   GOLD-16  API: GET /gold/signals returns valid schema
 *   GOLD-17  API: POST /gold/analyze returns 1-4 signals
 *   GOLD-18  API: GET /gold/risk-status returns mode field
 *   GOLD-19  API: GET /gold/performance returns 4 strategies
 *   GOLD-20  Signals: direction field is "long" or "short" for all signals
 *   GOLD-21  Signals: confidence_score is 0-100 for all signals
 *   GOLD-22  Signals: risk_reward_ratio is positive for all signals
 *   GOLD-23  Performance: overall_win_rate is between 0 and 1
 *   GOLD-24  Risk: daily_loss_cap_pct is 2.0
 *   GOLD-25  /gold overview page has quick-nav links to sub-pages
 */

import { test, expect } from "../fixtures/auth.fixture";
import { API_URL } from "../fixtures/test-data";

const GOLD_PAGES = ["/gold", "/gold/signals", "/gold/performance", "/gold/risk"];

// ---------------------------------------------------------------------------
// Helper: authenticated API request with dev_token
// ---------------------------------------------------------------------------

async function goldGet(request: any, path: string, params?: Record<string, string>) {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const tokenRes = await request.post(`${API_URL}/test/token`, {
    data: { email: "e2e-user-a@nextgenstock.io" },
  });
  const { access_token } = await tokenRes.json();
  return request.get(url.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });
}

async function goldPost(request: any, path: string, params?: Record<string, string>) {
  const url = new URL(`${API_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const tokenRes = await request.post(`${API_URL}/test/token`, {
    data: { email: "e2e-user-a@nextgenstock.io" },
  });
  const { access_token } = await tokenRes.json();
  return request.post(url.toString(), {
    headers: { Authorization: `Bearer ${access_token}` },
  });
}

// ---------------------------------------------------------------------------
// GOLD-01: Auth guard for all 4 pages
// ---------------------------------------------------------------------------

test.describe("Gold — authentication guard (GOLD-01)", () => {
  for (const route of GOLD_PAGES) {
    test(`GOLD-01: unauthenticated user on ${route} redirected to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});

// ---------------------------------------------------------------------------
// GOLD-02 to GOLD-03: /gold overview
// ---------------------------------------------------------------------------

test.describe("Gold Overview /gold (GOLD-02, GOLD-03, GOLD-25)", () => {
  test("GOLD-02: overview page loads with a heading", async ({ authenticatedPage: page }) => {
    await page.goto("/gold");
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("GOLD-03: sidebar has Commodities sub-menu with 4 links", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold");
    await page.waitForLoadState("networkidle");

    const nav = page.locator("nav");
    await expect(nav).toBeVisible();

    // The sidebar should contain links to all 4 sub-pages
    for (const href of ["/gold", "/gold/signals", "/gold/performance", "/gold/risk"]) {
      await expect(nav.locator(`a[href="${href}"]`)).toBeVisible({ timeout: 8_000 });
    }
  });

  test("GOLD-25: overview page has quick-nav links to sub-pages", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold");
    await page.waitForLoadState("networkidle");

    // Each sub-page link should appear somewhere on the overview
    const subLinks = ["/gold/signals", "/gold/performance", "/gold/risk"];
    for (const href of subLinks) {
      const link = page.locator(`a[href="${href}"]`).first();
      await expect(link).toBeVisible({ timeout: 8_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// GOLD-04 to GOLD-06: /gold/signals
// ---------------------------------------------------------------------------

test.describe("Gold Signals /gold/signals (GOLD-04 – GOLD-06)", () => {
  test("GOLD-04: signals page loads with heading", async ({ authenticatedPage: page }) => {
    await page.goto("/gold/signals");
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, h3, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test("GOLD-05: signals page has symbol input and Run Analysis button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/signals");
    await page.waitForLoadState("networkidle");

    // Symbol text input
    const symbolInput = page.locator('input[placeholder*="symbol" i], input[placeholder*="Symbol" i], input[name="symbol"]').first();
    await expect(symbolInput).toBeVisible({ timeout: 8_000 });

    // Run / Analyze button
    const runBtn = page.locator(
      'button:has-text("Run"), button:has-text("Analyze"), button:has-text("Scan")'
    ).first();
    await expect(runBtn).toBeVisible({ timeout: 8_000 });
  });

  test("GOLD-06: signals page has timeframe filter controls", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/signals");
    await page.waitForLoadState("networkidle");

    // Timeframe options (buttons, tabs, or select)
    const tfControl = page.locator(
      '[data-testid*="timeframe"], select, button:has-text("1h"), button:has-text("4h"), button:has-text("15")'
    ).first();
    await expect(tfControl).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// GOLD-07 to GOLD-08: /gold/performance
// ---------------------------------------------------------------------------

test.describe("Gold Performance /gold/performance (GOLD-07 – GOLD-08)", () => {
  test("GOLD-07: performance page loads and shows strategy table or cards", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/performance");
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, h3, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Table or strategy card should be present
    const content = page.locator('table, [data-testid*="strategy"], [data-testid*="performance"]').first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test("GOLD-08: performance page has day-range selector", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/performance");
    await page.waitForLoadState("networkidle");

    // Buttons like "7d", "14d", "30d" or a select/tabs
    const daySelector = page.locator(
      'button:has-text("7"), button:has-text("14"), button:has-text("30"), select, [role="tablist"]'
    ).first();
    await expect(daySelector).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// GOLD-09 to GOLD-10: /gold/risk
// ---------------------------------------------------------------------------

test.describe("Gold Risk /gold/risk (GOLD-09 – GOLD-10)", () => {
  test("GOLD-09: risk page loads and shows risk cards", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/risk");
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, h3, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // At least one card-like risk element
    const card = page.locator('[data-testid*="risk"], .card, section').first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test("GOLD-10: risk page shows daily loss cap indicator", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/gold/risk");
    await page.waitForLoadState("networkidle");

    // Progress bar or text referencing "2%" or "daily"
    const indicator = page.locator(
      '[role="progressbar"], [data-testid*="daily"], [data-testid*="loss"], *:text("2%"), *:text("daily")'
    ).first();
    await expect(indicator).toBeVisible({ timeout: 8_000 });
  });
});

// ---------------------------------------------------------------------------
// GOLD-11: No banned wording on any gold page
// ---------------------------------------------------------------------------

test.describe("Gold — approved wording compliance (GOLD-11)", () => {
  const bannedTerms = ["guaranteed", "certain to go up", " safe "];

  for (const route of GOLD_PAGES) {
    test(`GOLD-11: no banned wording on ${route}`, async ({ authenticatedPage: page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      for (const term of bannedTerms) {
        expect(bodyText, `Banned term "${term}" found on ${route}`).not.toContain(term);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// GOLD-12 to GOLD-15: API auth guards
// ---------------------------------------------------------------------------

test.describe("Gold API — auth guards (GOLD-12 – GOLD-15)", () => {
  test("GOLD-12: GET /gold/signals returns 401/403 without token", async ({ request }) => {
    const r = await request.get(`${API_URL}/gold/signals`);
    expect([401, 403]).toContain(r.status());
  });

  test("GOLD-13: POST /gold/analyze returns 401/403 without token", async ({ request }) => {
    const r = await request.post(`${API_URL}/gold/analyze`);
    expect([401, 403]).toContain(r.status());
  });

  test("GOLD-14: GET /gold/risk-status returns 401/403 without token", async ({ request }) => {
    const r = await request.get(`${API_URL}/gold/risk-status`);
    expect([401, 403]).toContain(r.status());
  });

  test("GOLD-15: GET /gold/performance returns 401/403 without token", async ({ request }) => {
    const r = await request.get(`${API_URL}/gold/performance`);
    expect([401, 403]).toContain(r.status());
  });
});

// ---------------------------------------------------------------------------
// GOLD-16 to GOLD-24: API contract / schema tests
// ---------------------------------------------------------------------------

test.describe("Gold API — contract tests (GOLD-16 – GOLD-24)", () => {
  test("GOLD-16: GET /gold/signals returns valid schema", async ({ request }) => {
    const r = await goldGet(request, "/gold/signals");
    expect(r.ok()).toBe(true);
    const body = await r.json();

    expect(body).toHaveProperty("symbol");
    expect(body).toHaveProperty("timeframe");
    expect(body).toHaveProperty("signals");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.signals)).toBe(true);
    expect(body.total).toBe(body.signals.length);
  });

  test("GOLD-17: POST /gold/analyze returns 1-4 signals", async ({ request }) => {
    // Run multiple times to see variance
    const counts = new Set<number>();
    for (let i = 0; i < 8; i++) {
      const r = await goldPost(request, "/gold/analyze");
      expect(r.ok()).toBe(true);
      const body = await r.json();
      expect(body.signals_generated).toBeGreaterThanOrEqual(1);
      expect(body.signals_generated).toBeLessThanOrEqual(4);
      expect(body.signals).toHaveLength(body.signals_generated);
      counts.add(body.signals_generated);
    }
    // Should see at least 2 distinct counts over 8 calls
    expect(counts.size).toBeGreaterThan(1);
  });

  test("GOLD-18: GET /gold/risk-status returns mode field", async ({ request }) => {
    const r = await goldGet(request, "/gold/risk-status");
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(["active", "paused", "kill_switch"]).toContain(body.mode);
    expect(body.daily_loss_cap_pct).toBe(2.0);
  });

  test("GOLD-19: GET /gold/performance returns 4 strategies", async ({ request }) => {
    const r = await goldGet(request, "/gold/performance");
    expect(r.ok()).toBe(true);
    const body = await r.json();
    expect(body.strategies).toHaveLength(4);
    const names = body.strategies.map((s: any) => s.strategy_name);
    expect(names).toContain("liquidity_sweep");
    expect(names).toContain("trend_continuation");
    expect(names).toContain("breakout_expansion");
    expect(names).toContain("ema_momentum");
  });

  test("GOLD-20: signal direction is 'long' or 'short'", async ({ request }) => {
    const r = await goldGet(request, "/gold/signals", { limit: "20" });
    const body = await r.json();
    for (const sig of body.signals) {
      expect(["long", "short"]).toContain(sig.direction);
    }
  });

  test("GOLD-21: confidence_score is 0-100 for all signals", async ({ request }) => {
    const r = await goldGet(request, "/gold/signals", { limit: "20" });
    const body = await r.json();
    for (const sig of body.signals) {
      expect(sig.confidence_score).toBeGreaterThanOrEqual(0);
      expect(sig.confidence_score).toBeLessThanOrEqual(100);
    }
  });

  test("GOLD-22: risk_reward_ratio is positive for all signals", async ({ request }) => {
    const r = await goldGet(request, "/gold/signals", { limit: "20" });
    const body = await r.json();
    for (const sig of body.signals) {
      expect(sig.risk_reward_ratio).toBeGreaterThan(0);
    }
  });

  test("GOLD-23: overall_win_rate is between 0 and 1", async ({ request }) => {
    const r = await goldGet(request, "/gold/performance");
    const body = await r.json();
    expect(body.overall_win_rate).toBeGreaterThanOrEqual(0);
    expect(body.overall_win_rate).toBeLessThanOrEqual(1);
  });

  test("GOLD-24: daily_loss_cap_pct is exactly 2.0", async ({ request }) => {
    const r = await goldGet(request, "/gold/risk-status");
    const body = await r.json();
    expect(body.daily_loss_cap_pct).toBe(2.0);
  });
});
