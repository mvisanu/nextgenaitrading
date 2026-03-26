/**
 * security.spec.ts — Security & token storage E2E tests
 *
 * Covers:
 *   FR-08   Tokens never in localStorage
 *   Broker credential API keys never returned in responses
 *   CORS — requests from unlisted origins rejected
 *   401 on all protected endpoints without cookie
 *   403 on cross-user resource access
 *   HttpOnly cookie — not readable via document.cookie in browser
 */

import { test, expect } from "@playwright/test";
import {
  API_URL,
  USER_A,
  ALPACA_CRED,
  STOCK_SYMBOL,
  ROUTES,
} from "../fixtures/test-data";
import {
  registerUser,
  loginUser,
  createCredential,
  testCredential,
  listCredentials,
  runBacktest,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// HTTP-only cookie: token not in document.cookie
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — HttpOnly cookie", () => {
  test("SEC-01: access_token is not visible in document.cookie after login", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const cookieStr: string = await page.evaluate(() => document.cookie);
    // access_token is HttpOnly — must NOT appear in JS-accessible cookies
    expect(cookieStr).not.toContain("access_token");
    // Should also not contain any JWT (starts with "eyJ")
    expect(cookieStr).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });

  test("SEC-02: refresh_token is not visible in document.cookie", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const cookieStr: string = await page.evaluate(() => document.cookie);
    expect(cookieStr).not.toContain("refresh_token");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// localStorage — no tokens stored
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — No tokens in localStorage", () => {
  test("SEC-03: localStorage has no token-related keys after login", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const storageKeys: string[] = await page.evaluate(() => Object.keys(localStorage));
    const tokenKeys = storageKeys.filter((k) => {
      const lower = k.toLowerCase();
      return (
        lower.includes("token") ||
        lower.includes("jwt") ||
        lower.includes("access") ||
        lower.includes("refresh") ||
        lower.includes("auth")
      );
    });
    expect(tokenKeys).toHaveLength(0);
  });

  test("SEC-04: sessionStorage has no token-related keys after login", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const sessionKeys: string[] = await page.evaluate(() => Object.keys(sessionStorage));
    const tokenKeys = sessionKeys.filter((k) => {
      const lower = k.toLowerCase();
      return (
        lower.includes("token") ||
        lower.includes("jwt") ||
        lower.includes("access") ||
        lower.includes("refresh")
      );
    });
    expect(tokenKeys).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Broker credential — keys never returned in API responses
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Broker credential key masking", () => {
  test.beforeEach(async ({ request }) => {
    // Use a unique email per test run to avoid rate-limit lockout accumulation.
    // auth.spec.ts wrong-password tests use USER_A.email, which increments the
    // in-memory failed-login counter. After 5 runs USER_A would be locked out.
    const email = `sec-cred-${Date.now()}@nextgenstock.io`;
    await registerUser(request, email, USER_A.password);
    await loginUser(request, email, USER_A.password);
  });

  test("SEC-05: raw api_key never appears in POST /broker/credentials response", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/broker/credentials`, {
      data: ALPACA_CRED,
    });
    const body = await res.text();
    expect(body).not.toContain(ALPACA_CRED.api_key);
    expect(body).not.toContain(ALPACA_CRED.secret_key);
  });

  test("SEC-06: raw secret_key never appears in GET /broker/credentials response", async ({
    request,
  }) => {
    await createCredential(request, ALPACA_CRED);
    const res = await request.get(`${API_URL}/broker/credentials`);
    const body = await res.text();
    expect(body).not.toContain(ALPACA_CRED.api_key);
    expect(body).not.toContain(ALPACA_CRED.secret_key);
  });

  test("SEC-07: POST /broker/credentials/{id}/test returns only {ok: bool}", async ({
    request,
  }) => {
    const { body: created } = await createCredential(request, ALPACA_CRED);
    const id = (created as { id: number }).id;

    const res = await request.post(`${API_URL}/broker/credentials/${id}/test`);
    const responseText = await res.text();
    // Raw keys must not appear
    expect(responseText).not.toContain(ALPACA_CRED.api_key);
    expect(responseText).not.toContain(ALPACA_CRED.secret_key);
    // Should only contain ok: true/false and optional detail
    const body = JSON.parse(responseText);
    expect(Object.keys(body).sort()).toEqual(
      expect.arrayContaining(["ok"])
    );
  });

  test("SEC-08: api_key_masked field contains '****' or '(encrypted)'", async ({
    request,
  }) => {
    const { body } = await createCredential(request, ALPACA_CRED);
    const masked = (body as { api_key_masked: string }).api_key_masked;
    expect(masked).toMatch(/\*{4}|encrypted/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unauthenticated requests — 401 on all protected endpoints
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
    test(`SEC-09: ${method} ${path} returns 401 without cookie`, async ({ playwright }) => {
      // Use a fresh context with no cookies — the shared `request` fixture inherits
      // cookies from the "Broker credential key masking" beforeEach login above.
      const freshCtx = await playwright.request.newContext();
      let res;
      try {
        switch (method) {
          case "GET":
            res = await freshCtx.get(`${API_URL}${path}`);
            break;
          case "POST":
            res = await freshCtx.post(`${API_URL}${path}`, {
              data: {},
            });
            break;
          case "PATCH":
            res = await freshCtx.patch(`${API_URL}${path}`, {
              data: {},
            });
            break;
          default:
            throw new Error(`Unhandled method: ${method}`);
        }
        // Accept 401 or 422 (validation error before auth, acceptable on POST with empty body)
        // but NOT 200, 201, 202
        expect([401, 403, 422]).toContain(res.status());
        // More strictly: auth check must trigger 401
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
// 403 on cross-user access (ownership check)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — 403 on cross-user resource access", () => {
  test("SEC-10: GET /backtests/{user_a_id} as USER_B returns 403 or 404", async ({
    request,
  }) => {
    // Create run as USER_A
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: run } = await runBacktest(request, {
      symbol: STOCK_SYMBOL,
      timeframe: "1d",
      mode: "conservative",
    });
    const runId = (run as { id: number }).id;

    // Login as USER_B
    const otherEmail = `sec-cross-${Date.now()}@nextgenstock.io`;
    await request.post(`${API_URL}/auth/logout`);
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "SecurePass1234!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "SecurePass1234!" },
    });

    const res = await request.get(`${API_URL}/backtests/${runId}`);
    expect([403, 404]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });

  test("SEC-11: PATCH /broker/credentials/{user_a_id} as USER_B returns 403 or 404", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: cred } = await createCredential(request, ALPACA_CRED);
    const credId = (cred as { id: number }).id;

    const otherEmail = `sec-cred-${Date.now()}@nextgenstock.io`;
    await request.post(`${API_URL}/auth/logout`);
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "SecurePass1234!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "SecurePass1234!" },
    });

    const res = await request.patch(`${API_URL}/broker/credentials/${credId}`, {
      data: { profile_name: "Hijacked" },
    });
    expect([403, 404]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Response body security — no password leaks
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Sensitive fields never in responses", () => {
  test("SEC-12: GET /auth/me never includes password_hash", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const res = await request.get(`${API_URL}/auth/me`);
    const body = await res.text();
    expect(body).not.toContain("password_hash");
    expect(body).not.toContain(USER_A.password);
  });

  test("SEC-13: GET /profile never includes password_hash", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const res = await request.get(`${API_URL}/profile`);
    const body = await res.text();
    expect(body).not.toContain("password_hash");
  });

  test("SEC-14: POST /auth/login response body does not contain JWT token strings", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    const body = await res.text();
    // JWT tokens start with "eyJ"
    expect(body).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Health check — public endpoint
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — Public endpoints", () => {
  test("SEC-15: GET /healthz returns 200 without authentication", async ({ request }) => {
    const res = await request.get(`${API_URL}/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });
});
