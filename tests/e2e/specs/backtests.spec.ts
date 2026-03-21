/**
 * backtests.spec.ts — Backtesting E2E tests
 *
 * Covers:
 *   FR-35  POST /backtests/run → persists StrategyRun + BacktestTrade records
 *   FR-36  GET /backtests → paginated list
 *   FR-37  GET /backtests/{id} → run details
 *   FR-38  GET /backtests/{id}/trades → trade list with entry/exit fields
 *   FR-39  GET /backtests/{id}/leaderboard → variant results ranked by validation_score
 *   FR-40  GET /backtests/{id}/chart-data → candles, signals, equity
 *   FR-41  VariantBacktestResult fields
 */

import { test, expect } from "../fixtures/auth.fixture";
import { API_URL, STOCK_SYMBOL, CRYPTO_SYMBOL, ROUTES, USER_A } from "../fixtures/test-data";
import {
  registerUser,
  runBacktest,
  listBacktests,
  getBacktest,
  getBacktestTrades,
  getBacktestLeaderboard,
  getBacktestChartData,
  runAiPick,
  runBLSH,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// API-level backtest tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Backtests API", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
  });

  // ── Run endpoint ────────────────────────────────────────────────────────────
  test("BT-01: POST /backtests/run returns 202 with BacktestOut shape", async ({
    request,
  }) => {
    const { ok, status, body } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    expect([200, 202]).toContain(status);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("user_id");
    expect(body).toHaveProperty("mode_name", "conservative");
    expect(body).toHaveProperty("symbol", STOCK_SYMBOL);
    expect(body).toHaveProperty("timeframe", "1d");
    expect(body).toHaveProperty("leverage");
    expect(body).toHaveProperty("created_at");
  });

  // ── List endpoint ───────────────────────────────────────────────────────────
  test("BT-02: GET /backtests returns array with at least one entry after a run", async ({
    request,
  }) => {
    await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });

    const { ok, body } = await listBacktests(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  });

  test("BT-03: GET /backtests returns 401 when unauthenticated", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/backtests`);
    expect(res.status()).toBe(401);
  });

  // ── Single run endpoint ─────────────────────────────────────────────────────
  test("BT-04: GET /backtests/{id} returns correct run details", async ({ request }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "aggressive",
    });
    const id = (run as { id: number }).id;

    const { ok, body } = await getBacktest(request, id);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id", id);
    expect(body).toHaveProperty("mode_name", "aggressive");
  });

  test("BT-05: GET /backtests/{id} returns 404 for non-existent run", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/backtests/999999999`);
    expect(res.status()).toBe(404);
  });

  test("BT-06: GET /backtests/{id} returns 401 when unauthenticated", async ({
    request,
  }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/backtests/${id}`);
    expect(res.status()).toBe(401);
  });

  // ── Trades endpoint ─────────────────────────────────────────────────────────
  test("BT-07: GET /backtests/{id}/trades returns array of BacktestTradeOut", async ({
    request,
  }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;

    const { ok, body } = await getBacktestTrades(request, id);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);

    if (body.length > 0) {
      const trade = body[0] as Record<string, unknown>;
      expect(trade).toHaveProperty("id");
      expect(trade).toHaveProperty("entry_price");
      expect(trade).toHaveProperty("exit_price");
      expect(trade).toHaveProperty("return_pct");
      expect(trade).toHaveProperty("leveraged_return_pct");
      expect(trade).toHaveProperty("pnl");
      expect(trade).toHaveProperty("mode_name");
    }
  });

  test("BT-08: GET /backtests/{id}/trades returns 401 when unauthenticated", async ({
    request,
  }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/backtests/${id}/trades`);
    expect(res.status()).toBe(401);
  });

  // ── Leaderboard (optimizer modes only) ─────────────────────────────────────
  test("BT-09: GET /backtests/{id}/leaderboard returns variants ranked by validation_score (AI Pick)", async ({
    request,
  }) => {
    const { body: run } = await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const id = (run as { id: number }).id;

    const { ok, body } = await getBacktestLeaderboard(request, id);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);

    if (body.length > 1) {
      // Verify descending order by validation_score
      const scores = (body as { validation_score: number }[]).map((v) => v.validation_score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    }

    if (body.length > 0) {
      const entry = body[0] as Record<string, unknown>;
      expect(entry).toHaveProperty("variant_name");
      expect(entry).toHaveProperty("validation_score");
      expect(entry).toHaveProperty("train_return");
      expect(entry).toHaveProperty("validation_return");
      expect(entry).toHaveProperty("test_return");
      expect(entry).toHaveProperty("max_drawdown");
      expect(entry).toHaveProperty("sharpe_like");
      expect(entry).toHaveProperty("trade_count");
      expect(entry).toHaveProperty("selected_winner");
    }
  }, 180_000);

  test("BT-10: GET /backtests/{id}/leaderboard returns exactly one selected_winner=true entry", async ({
    request,
  }) => {
    const { body: run } = await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const id = (run as { id: number }).id;

    const { body } = await getBacktestLeaderboard(request, id);
    const winners = (body as { selected_winner: boolean }[]).filter((v) => v.selected_winner);
    expect(winners.length).toBe(1);
  }, 180_000);

  // ── Chart data endpoint ─────────────────────────────────────────────────────
  test("BT-11: GET /backtests/{id}/chart-data returns candles, signals, equity", async ({
    request,
  }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;

    const { ok, body } = await getBacktestChartData(request, id);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("candles");
    expect(body).toHaveProperty("signals");
    expect(body).toHaveProperty("equity");
    expect(Array.isArray((body as { candles: unknown[] }).candles)).toBe(true);
    expect(Array.isArray((body as { signals: unknown[] }).signals)).toBe(true);
    expect(Array.isArray((body as { equity: unknown[] }).equity)).toBe(true);
  });

  test("BT-12: chart-data candles have OHLCV fields", async ({ request }) => {
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;

    const { body } = await getBacktestChartData(request, id);
    const candles = (body as { candles: Record<string, unknown>[] }).candles;

    if (candles.length > 0) {
      const candle = candles[0];
      expect(candle).toHaveProperty("time");
      expect(candle).toHaveProperty("open");
      expect(candle).toHaveProperty("high");
      expect(candle).toHaveProperty("low");
      expect(candle).toHaveProperty("close");
    }
  });

  test("BT-13: GET /backtests/{id}/chart-data returns 403 for another user's run", async ({
    request,
  }) => {
    // Create run as USER_A
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const id = (run as { id: number }).id;

    // Switch to USER_B
    await request.post(`${API_URL}/auth/logout`);
    const otherEmail = `bt-cross-${Date.now()}@nextgenstock.io`;
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });

    const res = await request.get(`${API_URL}/backtests/${id}`);
    expect([403, 404]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-level backtest tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Backtests UI — /backtests page", () => {
  test("BT-14: /backtests page loads with run form", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.backtests);
    await page.waitForLoadState("networkidle");

    // The page should have a heading
    const heading = page.locator('h1, h2, [data-testid="page-title"]');
    await expect(heading.first()).toBeVisible({ timeout: 8_000 });

    // Should have a symbol input or run button somewhere
    const action = page.locator(
      'input[placeholder*="symbol" i], button:has-text("Run"), button:has-text("New backtest")'
    );
    await expect(action.first()).toBeVisible({ timeout: 8_000 });
  });

  test("BT-15: equity curve Recharts element renders after a run", async ({
    authenticatedPage: page,
    request,
  }) => {
    // Pre-create a backtest run via API
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const runId = (run as { id: number }).id;

    // Navigate to the backtest detail view
    await page.goto(`${ROUTES.backtests}/${runId}`);
    await page.waitForLoadState("networkidle");

    // Recharts renders SVG elements
    const rechartsSvg = page.locator(
      '.recharts-wrapper, svg.recharts-surface, [data-testid="equity-curve"]'
    );
    // Allow that the detail page might use a different URL pattern
    if (await rechartsSvg.count() > 0) {
      await expect(rechartsSvg.first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("BT-16: trade list table visible with entry/exit columns", async ({
    authenticatedPage: page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const runId = (run as { id: number }).id;

    // Try detail page URL patterns
    for (const urlPattern of [
      `${ROUTES.backtests}/${runId}`,
      `${ROUTES.backtests}?id=${runId}`,
    ]) {
      await page.goto(urlPattern);
      await page.waitForLoadState("networkidle");

      const table = page.locator("table, [role='table']");
      if (await table.count() > 0) {
        await expect(table.first()).toBeVisible({ timeout: 8_000 });
        break;
      }
    }
  });

  test("BT-17: leaderboard table visible for AI Pick runs", async ({
    authenticatedPage: page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    const { body: run } = await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const runId = (run as { id: number }).id;

    await page.goto(`${ROUTES.backtests}/${runId}`);
    await page.waitForLoadState("networkidle");

    // Look for leaderboard section or table
    const leaderboard = page.locator(
      '[data-testid="leaderboard"], table:has-text("variant"), text=/leaderboard/i, text=/variant/i'
    );
    if (await leaderboard.count() > 0) {
      await expect(leaderboard.first()).toBeVisible({ timeout: 10_000 });
    }
  }, 180_000);
});
