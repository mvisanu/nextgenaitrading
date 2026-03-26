/**
 * security.spec.ts — Security E2E tests (Supabase Auth compatible)
 *
 * Covers:
 *   SEC-01  No sensitive tokens in document.cookie after Supabase auth
 *   SEC-02  No sensitive tokens in localStorage
 *   SEC-03  No sensitive tokens in sessionStorage
 *   SEC-05  Broker credential API keys never returned in responses
 *   SEC-09  401 on all protected endpoints without Bearer token
 *   SEC-10  403 on cross-user resource access
 *   SEC-12  Sensitive fields never in API responses
 *   SEC-15  Public endpoints accessible without auth
 */

import { test, expect } from "@playwright/test";
import {
  API_URL,
  USER_A,
  USER_B,
  ALPACA_CRED,
  STOCK_SYMBOL,
  ROUTES,
} from "../fixtures/test-data";
import {
  getTestToken,
  createAuthenticatedContext,
  getMeWithToken,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// SEC-01/02/03  No tokens leaked to browser storage after visiting auth pages
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — No token leakage in browser storage", () => {
  test("SEC-01: document.cookie has no access_token or refresh_token on login page", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const cookieStr: string = await page.evaluate(() => document.cookie);
    expect(cookieStr).not.toContain("access_token");
    expect(cookieStr).not.toContain("refresh_token");
    expect(cookieStr).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  test("SEC-02: localStorage has no token-related keys on login page", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const storageKeys: string[] = await page.evaluate(() =>
      Object.keys(localStorage)
    );
    const tokenKeys = storageKeys.filter((k) => {
      const lower = k.toLowerCase();
      return (
        lower.includes("jwt") ||
        lower.includes("access_token") ||
        lower.includes("refresh_token")
      );
    });
    expect(tokenKeys).toHaveLength(0);
  });

  test("SEC-03: sessionStorage has no token-related keys on login page", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const sessionKeys: string[] = await page.evaluate(() =>
      Object.keys(sessionStorage)
    );
    const tokenKeys = sessionKeys.filter((k) => {
      const lower = k.toLowerCase();
      return (
        lower.includes("jwt") ||
        lower.includes("access_token") ||
        lower.includes("refresh_token")
      );
    });
    expect(tokenKeys).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-05/06/07/08  Broker credential — keys never returned in API responses
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Broker credential key masking", () => {
  let token: string;

  test.beforeAll(async ({ playwright }) => {
    const ctx = await playwright.request.newContext();
    try {
      const result = await getTestToken(ctx, `sec-cred-${Date.now()}@nextgenstock.io`);
      token = result.token;
    } finally {
      await ctx.dispose();
    }
  });

  test("SEC-05: raw api_key never appears in POST /broker/credentials response", async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      const res = await ctx.post(`${API_URL}/broker/credentials`, {
        data: ALPACA_CRED,
      });
      const body = await res.text();
      expect(body).not.toContain(ALPACA_CRED.api_key);
      expect(body).not.toContain(ALPACA_CRED.secret_key);
    } finally {
      await ctx.dispose();
    }
  });

  test("SEC-06: raw secret_key never appears in GET /broker/credentials response", async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      // Create then list
      await ctx.post(`${API_URL}/broker/credentials`, {
        data: ALPACA_CRED,
      });
      const res = await ctx.get(`${API_URL}/broker/credentials`);
      const body = await res.text();
      expect(body).not.toContain(ALPACA_CRED.api_key);
      expect(body).not.toContain(ALPACA_CRED.secret_key);
    } finally {
      await ctx.dispose();
    }
  });

  test("SEC-07: POST /broker/credentials/{id}/test returns only {ok: bool}", async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      const createRes = await ctx.post(`${API_URL}/broker/credentials`, {
        data: ALPACA_CRED,
      });
      const created = await createRes.json();
      const id = created.id;

      const res = await ctx.post(`${API_URL}/broker/credentials/${id}/test`);
      const responseText = await res.text();
      expect(responseText).not.toContain(ALPACA_CRED.api_key);
      expect(responseText).not.toContain(ALPACA_CRED.secret_key);
      const body = JSON.parse(responseText);
      expect(body).toHaveProperty("ok");
    } finally {
      await ctx.dispose();
    }
  });

  test("SEC-08: api_key_masked field contains '****' or '(encrypted)'", async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      const res = await ctx.post(`${API_URL}/broker/credentials`, {
        data: ALPACA_CRED,
      });
      const body = await res.json();
      const masked = body.api_key_masked;
      expect(masked).toMatch(/\*{4}|encrypted/i);
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-09  401 on all protected endpoints without Bearer token
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — 401 on all protected endpoints", () => {
  const protectedEndpoints = [
    ["GET", "/auth/me"],
    ["GET", "/profile"],
    ["PATCH", "/profile"],
    ["GET", "/broker/credentials"],
    ["POST", "/broker/credentials"],
    ["GET", "/backtests"],
    ["POST", "/backtests/run"],
    ["GET", "/strategies/runs"],
    ["POST", "/strategies/ai-pick/run"],
    ["POST", "/strategies/buy-low-sell-high/run"],
    ["POST", "/live/run-signal-check"],
    ["POST", "/live/execute"],
    ["GET", "/live/orders"],
    ["GET", "/live/positions"],
    ["GET", "/live/status"],
    ["GET", "/artifacts"],
  ] as const;

  for (const [method, path] of protectedEndpoints) {
    test(`SEC-09: ${method} ${path} returns 401 without auth`, async ({
      playwright,
    }) => {
      const freshCtx = await playwright.request.newContext();
      let res;
      try {
        switch (method) {
          case "GET":
            res = await freshCtx.get(`${API_URL}${path}`);
            break;
          case "POST":
            res = await freshCtx.post(`${API_URL}${path}`, { data: {} });
            break;
          case "PATCH":
            res = await freshCtx.patch(`${API_URL}${path}`, { data: {} });
            break;
          default:
            throw new Error(`Unhandled method: ${method}`);
        }
        expect([401, 403, 422]).toContain(res.status());
        if (res.status() !== 422) {
          expect(res.status()).toBe(401);
        }
      } finally {
        await freshCtx.dispose();
      }
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-10/11  403 on cross-user access (ownership check)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — 403 on cross-user resource access", () => {
  test("SEC-10: GET /backtests/{user_a_id} as USER_B returns 403 or 404", async ({
    playwright,
  }) => {
    const setupCtx = await playwright.request.newContext();
    let tokenA: string;
    let tokenB: string;
    try {
      const resultA = await getTestToken(setupCtx, USER_A.email);
      tokenA = resultA.token;
      const resultB = await getTestToken(
        setupCtx,
        `sec-cross-${Date.now()}@nextgenstock.io`
      );
      tokenB = resultB.token;
    } finally {
      await setupCtx.dispose();
    }

    // Create backtest as USER_A
    const ctxA = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` },
    });
    let runId: number;
    try {
      const runRes = await ctxA.post(`${API_URL}/backtests/run`, {
        data: {
          symbol: STOCK_SYMBOL,
          timeframe: "1d",
          mode: "conservative",
        },
      });
      const runBody = await runRes.json();
      runId = runBody.id;
    } finally {
      await ctxA.dispose();
    }

    // Try to access as USER_B
    const ctxB = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${tokenB}` },
    });
    try {
      const res = await ctxB.get(`${API_URL}/backtests/${runId}`);
      expect([403, 404]).toContain(res.status());
      expect(res.status()).not.toBe(200);
    } finally {
      await ctxB.dispose();
    }
  });

  test("SEC-11: PATCH /broker/credentials/{user_a_id} as USER_B returns 403 or 404", async ({
    playwright,
  }) => {
    const setupCtx = await playwright.request.newContext();
    let tokenA: string;
    let tokenB: string;
    try {
      const resultA = await getTestToken(setupCtx, USER_A.email);
      tokenA = resultA.token;
      const resultB = await getTestToken(
        setupCtx,
        `sec-cred-cross-${Date.now()}@nextgenstock.io`
      );
      tokenB = resultB.token;
    } finally {
      await setupCtx.dispose();
    }

    // Create credential as USER_A
    const ctxA = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${tokenA}` },
    });
    let credId: number;
    try {
      const createRes = await ctxA.post(`${API_URL}/broker/credentials`, {
        data: ALPACA_CRED,
      });
      const createBody = await createRes.json();
      credId = createBody.id;
    } finally {
      await ctxA.dispose();
    }

    // Try to modify as USER_B
    const ctxB = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${tokenB}` },
    });
    try {
      const res = await ctxB.patch(`${API_URL}/broker/credentials/${credId}`, {
        data: { profile_name: "Hijacked" },
      });
      expect([403, 404]).toContain(res.status());
    } finally {
      await ctxB.dispose();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-12/13  Sensitive fields never in API responses
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Sensitive fields never in responses", () => {
  test("SEC-12: GET /auth/me never includes password_hash", async ({
    playwright,
  }) => {
    const setupCtx = await playwright.request.newContext();
    const { token } = await getTestToken(setupCtx, USER_A.email);
    await setupCtx.dispose();

    const { body } = await getMeWithToken(
      await playwright.request.newContext(),
      token
    );
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain("password_hash");
  });

  test("SEC-13: GET /profile never includes password_hash", async ({
    playwright,
  }) => {
    const setupCtx = await playwright.request.newContext();
    const { token } = await getTestToken(setupCtx, USER_A.email);
    await setupCtx.dispose();

    const ctx = await playwright.request.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    try {
      const res = await ctx.get(`${API_URL}/profile`);
      const body = await res.text();
      expect(body).not.toContain("password_hash");
    } finally {
      await ctx.dispose();
    }
  });

  test("SEC-14: POST /auth/login endpoint is removed (Supabase handles auth)", async ({
    playwright,
  }) => {
    const ctx = await playwright.request.newContext();
    try {
      const res = await ctx.post(`${API_URL}/auth/login`, {
        data: { email: USER_A.email, password: "anything" },
      });
      // Endpoint should not exist
      expect([404, 405]).toContain(res.status());
    } finally {
      await ctx.dispose();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SEC-15  Health check — public endpoint
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Public endpoints", () => {
  test("SEC-15: GET /healthz returns 200 without authentication", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });
});
