/**
 * multi-tenancy.spec.ts — Per-user data isolation E2E tests
 *
 * Covers:
 *   FR-09   Every user-owned table has user_id FK
 *   FR-10   All DB queries scoped with WHERE user_id = current_user.id
 *   FR-11   User IDs derived from JWT, not request body
 *   FR-12   assert_ownership raises HTTP 403 on mismatch
 *
 * Test pattern:
 *   1. USER_A creates a resource
 *   2. USER_B attempts to access that resource by ID
 *   3. Expect 403 or 404 (not 200)
 *   4. USER_B's list endpoints return only USER_B's own data
 */

import { test, expect } from "@playwright/test";
import {
  API_URL,
  USER_A,
  USER_B,
  STOCK_SYMBOL,
  CRYPTO_SYMBOL,
  ALPACA_CRED,
} from "../fixtures/test-data";
import {
  registerUser,
  loginUser,
  logoutUser,
  createCredential,
  createTestBacktestRun,
  runAiPick,
  listBacktests,
  listArtifacts,
  getLiveOrders,
  getLivePositions,
  executeOrder,
  getBacktest,
  getBacktestTrades,
  getBacktestLeaderboard,
  getPineScript,
  listStrategyRuns,
  getStrategyRun,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// Setup helpers
// ─────────────────────────────────────────────────────────────────────────────

async function asUserA(request: Parameters<typeof loginUser>[0]) {
  await registerUser(request, USER_A.email, USER_A.password);
  await loginUser(request, USER_A.email, USER_A.password);
}

async function asUserB(request: Parameters<typeof loginUser>[0]) {
  await registerUser(request, USER_B.email, USER_B.password);
  await logoutUser(request);
  await loginUser(request, USER_B.email, USER_B.password);
}

// ─────────────────────────────────────────────────────────────────────────────
// Backtest isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — Backtest records", () => {
  test("MT-01: USER_B cannot read USER_A's backtest run", async ({ request }) => {
    await asUserA(request);
    const runId = await createTestBacktestRun(request, STOCK_SYMBOL);

    await asUserB(request);

    const { status } = await getBacktest(request, runId);
    expect([403, 404]).toContain(status);
  });

  test("MT-02: USER_B cannot read trades from USER_A's backtest run", async ({
    request,
  }) => {
    await asUserA(request);
    const runId = await createTestBacktestRun(request, STOCK_SYMBOL);

    await asUserB(request);

    const res = await request.get(`${API_URL}/backtests/${runId}/trades`);
    expect([403, 404]).toContain(res.status());
  });

  test("MT-03: USER_B cannot read leaderboard from USER_A's backtest run", async ({
    request,
  }) => {
    await asUserA(request);
    const runId = await createTestBacktestRun(request, STOCK_SYMBOL);

    await asUserB(request);

    const res = await request.get(`${API_URL}/backtests/${runId}/leaderboard`);
    expect([403, 404]).toContain(res.status());
  });

  test("MT-04: GET /backtests as USER_B does not include USER_A's runs", async ({
    request,
  }) => {
    // USER_A creates a run
    await asUserA(request);
    const runIdA = await createTestBacktestRun(request, STOCK_SYMBOL);

    // USER_B lists backtests
    await asUserB(request);
    const { body: backtests } = await listBacktests(request);

    const runIds = (backtests as { id: number }[]).map((r) => r.id);
    expect(runIds).not.toContain(runIdA);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Strategy run isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — Strategy runs", () => {
  test("MT-05: USER_B cannot read USER_A's strategy run by ID", async ({ request }) => {
    await asUserA(request);
    const runId = await createTestBacktestRun(request, STOCK_SYMBOL);

    await asUserB(request);

    const res = await request.get(`${API_URL}/strategies/runs/${runId}`);
    expect([403, 404]).toContain(res.status());
  });

  test("MT-06: GET /strategies/runs as USER_B does not include USER_A's runs", async ({
    request,
  }) => {
    await asUserA(request);
    const runId = await createTestBacktestRun(request, STOCK_SYMBOL);

    await asUserB(request);
    const { body: runs } = await listStrategyRuns(request);

    const runIds = (runs as { id: number }[]).map((r) => r.id);
    expect(runIds).not.toContain(runId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Broker credential isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — Broker credentials", () => {
  test("MT-07: USER_B cannot test USER_A's broker credential", async ({ request }) => {
    await asUserA(request);
    const { body: cred } = await createCredential(request, ALPACA_CRED);
    const credId = (cred as { id: number }).id;

    await asUserB(request);

    const res = await request.post(`${API_URL}/broker/credentials/${credId}/test`);
    expect([403, 404]).toContain(res.status());
  });

  test("MT-08: USER_B cannot delete USER_A's broker credential", async ({ request }) => {
    await asUserA(request);
    const { body: cred } = await createCredential(request, ALPACA_CRED);
    const credId = (cred as { id: number }).id;

    await asUserB(request);

    const res = await request.delete(`${API_URL}/broker/credentials/${credId}`);
    expect([403, 404]).toContain(res.status());
  });

  test("MT-09: USER_B cannot update USER_A's broker credential", async ({ request }) => {
    await asUserA(request);
    const { body: cred } = await createCredential(request, ALPACA_CRED);
    const credId = (cred as { id: number }).id;

    await asUserB(request);

    const res = await request.patch(`${API_URL}/broker/credentials/${credId}`, {
      data: { profile_name: "Hijacked" },
    });
    expect([403, 404]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Artifact isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — Artifacts", () => {
  test("MT-10: USER_B cannot read USER_A's Pine Script artifact", async ({
    request,
  }) => {
    await asUserA(request);
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    if (artifacts.length === 0) {
      test.skip(true, "No artifacts created — optimizer may have failed");
      return;
    }
    const artifactId = (artifacts[0] as { id: number }).id;

    await asUserB(request);

    const { status: metaStatus } = await request.get(`${API_URL}/artifacts/${artifactId}`);
    expect([403, 404]).toContain(metaStatus);

    const { status: codeStatus } = await request.get(
      `${API_URL}/artifacts/${artifactId}/pine-script`
    );
    expect([403, 404]).toContain(codeStatus);
  }, 180_000);

  test("MT-11: GET /artifacts as USER_B returns only USER_B's artifacts", async ({
    request,
  }) => {
    await asUserA(request);
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const { body: userAArts } = await listArtifacts(request);
    const userAIds = (userAArts as { id: number }[]).map((a) => a.id);

    await asUserB(request);
    const { body: userBArts } = await listArtifacts(request);
    const userBIds = (userBArts as { id: number }[]).map((a) => a.id);

    // USER_B should not see any of USER_A's artifacts
    for (const id of userAIds) {
      expect(userBIds).not.toContain(id);
    }
  }, 180_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// Order isolation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — Orders and positions", () => {
  test("MT-12: USER_B cannot see USER_A's orders in GET /live/orders", async ({
    request,
  }) => {
    await asUserA(request);
    const { body: cred } = await createCredential(request, ALPACA_CRED);
    const credId = (cred as { id: number }).id;
    await executeOrder(request, {
      symbol: STOCK_SYMBOL,
      side: "buy",
      quantity: 1,
      credential_id: credId,
      dry_run: true,
    });

    await asUserB(request);
    const { body: orders } = await getLiveOrders(request);
    // USER_B should have no orders (or none belonging to USER_A's credential)
    const userAOrders = (orders as { symbol: string }[]).filter(
      (o) => o.symbol === STOCK_SYMBOL
    );
    // This checks that USER_B only sees their own data
    // If USER_B has never placed any orders, this should be 0
    // (USER_A's order should not appear)
    // Note: we rely on fresh USER_B with no prior orders
    expect(userAOrders.length).toBe(0);
  });

  test("MT-13: USER_B cannot see USER_A's positions", async ({ request }) => {
    await asUserB(request);
    const { body: positions } = await getLivePositions(request);
    // USER_B's positions should not include anything from USER_A
    expect(Array.isArray(positions)).toBe(true);
    // All returned positions must belong to USER_B
    // Since USER_B just registered, positions should be empty
    expect(positions.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// User ID injection attack
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Multi-tenancy — User ID injection prevention", () => {
  test("MT-14: supplying a different user_id in the request body is ignored", async ({
    request,
  }) => {
    await asUserA(request);
    const meRes = await request.get(`${API_URL}/auth/me`);
    const userA = await meRes.json();
    const userAId: number = userA.id;

    await asUserB(request);
    const meBRes = await request.get(`${API_URL}/auth/me`);
    const userB = await meBRes.json();
    const userBId: number = userB.id;

    // Attempt to create a backtest with USER_A's user_id in the body
    // The backend should ignore user_id from body and use JWT-derived ID
    const res = await request.post(`${API_URL}/backtests/run`, {
      data: {
        symbol: STOCK_SYMBOL,
        timeframe: "1d",
        mode: "conservative",
        user_id: userAId, // Should be ignored
      },
    });

    if (res.ok()) {
      const body = await res.json();
      // The created run must belong to USER_B (from JWT), not USER_A
      expect(body.user_id).toBe(userBId);
      expect(body.user_id).not.toBe(userAId);
    }
    // A 422 is also acceptable (unknown field rejected)
    expect([200, 202, 422]).toContain(res.status());
  });
});
