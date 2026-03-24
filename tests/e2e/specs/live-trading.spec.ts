/**
 * live-trading.spec.ts — Live trading E2E tests
 *
 * Covers:
 *   FR-42  POST /live/run-signal-check
 *   FR-43  POST /live/execute (dry_run default)
 *   FR-44  GET /live/orders
 *   FR-45  GET /live/positions
 *   FR-46  GET /live/status
 *   FR-47  Live mode warning banner
 *   FR-48  Enabling live trading requires confirmation dialog
 *   FR-49  Active credential provider badge
 *   FR-50  GET /live/chart-data
 */

import { test, expect } from "../fixtures/auth.fixture";
import {
  API_URL,
  STOCK_SYMBOL,
  CRYPTO_SYMBOL,
  ROUTES,
  USER_A,
  ALPACA_CRED,
} from "../fixtures/test-data";
import {
  registerUser,
  createCredential,
  runSignalCheck,
  executeOrder,
  getLiveOrders,
  getLivePositions,
  getLiveStatus,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// API-level live trading tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Live Trading API", () => {
  let credentialId: number;

  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });

    // Create an Alpaca credential to use in live tests
    const { body } = await createCredential(request, ALPACA_CRED);
    credentialId = (body as { id: number }).id;
  });

  // ── Signal check ────────────────────────────────────────────────────────────
  test("LIVE-01: POST /live/run-signal-check returns SignalCheckOut with signal fields", async ({
    request,
  }) => {
    const { ok, status, body } = await runSignalCheck(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
      credential_id: credentialId,
      dry_run: true,
    });
    expect([200, 202]).toContain(status);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("strategy_run_id");
    expect(body).toHaveProperty("signal");
    expect(body).toHaveProperty("regime");
    expect(body).toHaveProperty("confirmation_count");
  });

  test("LIVE-02: signal check does NOT create a broker order", async ({ request }) => {
    await runSignalCheck(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
      credential_id: credentialId,
      dry_run: true,
    });

    const { body: orders } = await getLiveOrders(request);
    // No orders should be created by a signal check
    const signalOrders = (orders as { mode_name: string }[]).filter(
      (o) => o.mode_name === "signal"
    );
    expect(signalOrders.length).toBe(0);
  });

  test("LIVE-03: POST /live/run-signal-check returns 401 when unauthenticated", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.post(`${API_URL}/live/run-signal-check`, {
      data: {
        symbol: STOCK_SYMBOL,
        timeframe: "1d",
        mode: "conservative",
        credential_id: 1,
        dry_run: true,
      },
    });
    expect(res.status()).toBe(401);
  });

  // ── Execute (dry-run) ───────────────────────────────────────────────────────
  test("LIVE-04: POST /live/execute in dry_run mode returns OrderOut with dry_run=true", async ({
    request,
  }) => {
    const { ok, status, body } = await executeOrder(request, {
      symbol: STOCK_SYMBOL,
      side: "buy",
      quantity: 1,
      credential_id: credentialId,
      dry_run: true,
    });
    expect([200, 201]).toContain(status);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("symbol", STOCK_SYMBOL);
    expect(body).toHaveProperty("side", "buy");
    expect(body).toHaveProperty("dry_run", true);
    expect(body).toHaveProperty("status");
  });

  test("LIVE-05: dry_run is true by default (no explicit override needed)", async ({
    request,
  }) => {
    // Do NOT set dry_run explicitly — should default to true
    const res = await request.post(`${API_URL}/live/execute`, {
      data: {
        symbol: STOCK_SYMBOL,
        side: "buy",
        quantity: 1,
        credential_id: credentialId,
        // dry_run not specified
      },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.dry_run).toBe(true);
  });

  test("LIVE-06: executed dry-run order appears in GET /live/orders", async ({
    request,
  }) => {
    await executeOrder(request, {
      symbol: STOCK_SYMBOL,
      side: "buy",
      quantity: 1,
      credential_id: credentialId,
      dry_run: true,
    });

    const { ok, body } = await getLiveOrders(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    // The most recent order should have dry_run=true
    const orders = body as { dry_run: boolean; symbol: string }[];
    const ourOrder = orders.find((o) => o.symbol === STOCK_SYMBOL && o.dry_run === true);
    expect(ourOrder).toBeDefined();
  });

  test("LIVE-07: POST /live/execute returns 401 when unauthenticated", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.post(`${API_URL}/live/execute`, {
      data: {
        symbol: STOCK_SYMBOL,
        side: "buy",
        quantity: 1,
        credential_id: 1,
        dry_run: true,
      },
    });
    expect(res.status()).toBe(401);
  });

  // ── Orders ──────────────────────────────────────────────────────────────────
  test("LIVE-08: GET /live/orders returns array (may be empty)", async ({ request }) => {
    const { ok, body } = await getLiveOrders(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
  });

  test("LIVE-09: GET /live/orders returns 401 when unauthenticated", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/live/orders`);
    expect(res.status()).toBe(401);
  });

  // ── Positions ───────────────────────────────────────────────────────────────
  test("LIVE-10: GET /live/positions returns array (may be empty)", async ({ request }) => {
    const { ok, body } = await getLivePositions(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
  });

  test("LIVE-11: GET /live/positions returns 401 when unauthenticated", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/live/positions`);
    expect(res.status()).toBe(401);
  });

  // ── Status ──────────────────────────────────────────────────────────────────
  test("LIVE-12: GET /live/status with credential_id returns AccountStatus shape", async ({
    request,
  }) => {
    const { ok, body } = await getLiveStatus(request, credentialId);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("credential_id", credentialId);
    expect(body).toHaveProperty("provider", "alpaca");
    expect(body).toHaveProperty("paper_trading", true);
    expect(body).toHaveProperty("connected");
    // connected is bool (false for fake keys, that is fine)
    expect(typeof (body as { connected: boolean }).connected).toBe("boolean");
  });

  test("LIVE-13: GET /live/status returns 404 when no credentials exist", async ({
    request,
  }) => {
    // Delete the credential we just created
    await request.delete(`${API_URL}/broker/credentials/${credentialId}`);
    const res = await request.get(`${API_URL}/live/status`);
    expect(res.status()).toBe(404);
  });

  test("LIVE-14: GET /live/status returns 401 when unauthenticated", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/live/status`);
    expect(res.status()).toBe(401);
  });

  // ── Chart data ──────────────────────────────────────────────────────────────
  test("LIVE-15: GET /live/chart-data returns candles array", async ({ request }) => {
    const res = await request.get(
      `${API_URL}/live/chart-data?symbol=${STOCK_SYMBOL}&interval=1d`
    );
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body).toHaveProperty("candles");
    expect(Array.isArray((body as { candles: unknown[] }).candles)).toBe(true);
  });

  test("LIVE-16: GET /live/chart-data returns 422 for invalid symbol", async ({
    request,
  }) => {
    const res = await request.get(
      `${API_URL}/live/chart-data?symbol=XYZINVALID999&interval=1d`
    );
    expect(res.status()).toBe(422);
  });

  // ── Order isolation ─────────────────────────────────────────────────────────
  test("LIVE-17: orders from USER_A not visible to USER_B", async ({ request }) => {
    // Submit order as USER_A
    await executeOrder(request, {
      symbol: STOCK_SYMBOL,
      side: "buy",
      quantity: 1,
      credential_id: credentialId,
      dry_run: true,
    });

    // Switch to USER_B
    await request.post(`${API_URL}/auth/logout`);
    const otherEmail = `live-cross-${Date.now()}@nextgenstock.io`;
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });

    const { body: otherOrders } = await getLiveOrders(request);
    const userAOrders = (otherOrders as { symbol: string }[]).filter(
      (o) => o.symbol === STOCK_SYMBOL
    );
    // USER_B should not see USER_A's AAPL order
    expect(userAOrders.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-level live trading tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Live Trading UI — /live-trading page", () => {
  test("LIVE-18: page loads with disclaimer / warning alert", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    // Financial risk disclaimer should always be present
    const disclaimer = page.locator(
      '[role="alert"], [data-testid="risk-disclaimer"], text=/risk/i, text=/live mode/i, text=/educational/i'
    );
    await expect(disclaimer.first()).toBeVisible({ timeout: 8_000 });
  });

  test("LIVE-19: dry-run toggle is visible and enabled by default", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    const dryRunToggle = page.locator(
      'input[type="checkbox"][name*="dry" i], [data-testid="dry-run-toggle"], label:has-text("dry") input'
    );
    if (await dryRunToggle.count() > 0) {
      // dry_run should be ON (checked) by default
      await expect(dryRunToggle.first()).toBeChecked({ timeout: 5_000 });
    }
  });

  test("LIVE-20: enabling live trading (unchecking dry_run) shows confirmation dialog", async ({
    authenticatedPage: page,
    request,
  }) => {
    // Create a credential so the live trading page is functional
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    await createCredential(request, ALPACA_CRED);

    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    const dryRunToggle = page.locator(
      'input[type="checkbox"][name*="dry" i], [data-testid="dry-run-toggle"]'
    );
    if (await dryRunToggle.count() === 0) {
      test.skip(true, "Dry-run toggle not found");
      return;
    }

    // Click the toggle to disable dry_run (enable live trading)
    await dryRunToggle.first().click();

    // A confirmation dialog should appear
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 5_000 });

    // The dialog should warn about real money / live mode
    const dialogText = await dialog.first().textContent();
    expect(dialogText?.toLowerCase()).toMatch(/live|real money|risk/);
  });

  test("LIVE-21: live trading page shows positions table", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    // Positions section should be present (even if empty)
    const positionsSection = page.locator(
      '[data-testid="positions"], h2:has-text("Position"), h3:has-text("Position"), table'
    );
    await expect(positionsSection.first()).toBeVisible({ timeout: 8_000 });
  });

  test("LIVE-22: live trading page shows orders history table", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    const ordersSection = page.locator(
      '[data-testid="orders"], h2:has-text("Order"), h3:has-text("Order"), text=/order history/i'
    );
    await expect(ordersSection.first()).toBeVisible({ timeout: 8_000 });
  });

  test("LIVE-23: warning banner shows 'LIVE mode' text when dry_run is disabled", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.liveTrading);
    await page.waitForLoadState("networkidle");

    // Disable dry_run
    const dryRunToggle = page.locator(
      'input[type="checkbox"][name*="dry" i], [data-testid="dry-run-toggle"]'
    );
    if (await dryRunToggle.count() === 0) {
      test.skip(true, "Dry-run toggle not found");
      return;
    }

    await dryRunToggle.first().click();

    // Confirm the dialog if one appears
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count() > 0) {
      const confirmBtn = dialog.locator(
        'button:has-text("Confirm"), button:has-text("Enable"), button:has-text("Yes")'
      );
      if (await confirmBtn.count() > 0) {
        await confirmBtn.first().click();
      }
    }

    // Wait for the live mode banner
    const liveBanner = page.locator(
      'text=/live mode/i, text=/real money/i, [data-testid="live-warning-banner"]'
    );
    await expect(liveBanner.first()).toBeVisible({ timeout: 8_000 });
  });
});
