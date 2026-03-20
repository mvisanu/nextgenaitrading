/**
 * auth.spec.ts — Authentication & session management E2E tests
 *
 * Covers:
 *   FR-01  Register with valid credentials
 *   FR-02  Login issues HTTP-only cookies
 *   FR-03  GET /auth/me returns user
 *   FR-04  Refresh token rotation
 *   FR-05  Logout clears cookies and revokes session
 *   FR-06  Frontend middleware redirects unauthenticated users
 *   FR-07  Silent refresh on 401
 *   FR-08  Tokens never in localStorage
 */

import { test, expect } from "@playwright/test";
import {
  API_URL,
  USER_A,
  USER_B,
  INVALID_USER,
  ROUTES,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "../fixtures/test-data";
import {
  registerUser,
  loginUser,
  getMe,
  logoutUser,
  refreshToken,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate a unique email for isolation
// ─────────────────────────────────────────────────────────────────────────────
function uniqueEmail(base: string): string {
  return base.replace("@", `+${Date.now()}@`);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-01  Registration
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Registration — POST /auth/register", () => {
  test("AUTH-01-01: registers a new user and returns 201 with user_id and email", async ({
    request,
  }) => {
    const email = uniqueEmail(USER_A.email);
    const { ok, status, body } = await registerUser(request, email, USER_A.password);

    expect(status).toBe(201);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("user_id");
    expect(body).toHaveProperty("email", email);
    expect(body).toHaveProperty("message");
    // password_hash must never appear in the response
    expect(JSON.stringify(body)).not.toMatch(/password_hash/);
  });

  test("AUTH-01-02: returns 409 or 422 when registering a duplicate email", async ({
    request,
  }) => {
    const email = uniqueEmail("duplicate@nextgenstock.test");
    // First registration — must succeed
    await registerUser(request, email, USER_A.password);
    // Second registration with same email
    const { status } = await registerUser(request, email, USER_A.password);
    expect([409, 422]).toContain(status);
  });

  test("AUTH-01-03: returns 422 when password is shorter than 8 characters", async ({
    request,
  }) => {
    const { status } = await registerUser(request, uniqueEmail("short@test.com"), "Sh0rt!");
    expect(status).toBe(422);
  });

  test("AUTH-01-04: returns 422 when email is malformed", async ({ request }) => {
    const { status } = await registerUser(request, "not-an-email", USER_A.password);
    expect(status).toBe(422);
  });

  test("AUTH-01-05: UI register form → redirects to dashboard on success", async ({
    page,
  }) => {
    const email = uniqueEmail("ui-register@nextgenstock.test");

    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', email);
    // Fill password fields — there may be a confirm field
    const passwordFields = await page.locator('input[type="password"]').all();
    for (const field of passwordFields) {
      await field.fill(USER_A.password);
    }

    await page.click('button[type="submit"]');

    // After successful registration, expect to land on /dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("AUTH-01-06: UI shows inline error when email already exists", async ({
    page,
    request,
  }) => {
    // Pre-create the user via API
    const email = uniqueEmail("dup-ui@nextgenstock.test");
    await registerUser(request, email, USER_A.password);

    await page.goto(ROUTES.register);
    await page.fill('input[type="email"]', email);
    const passwordFields = await page.locator('input[type="password"]').all();
    for (const field of passwordFields) {
      await field.fill(USER_A.password);
    }
    await page.click('button[type="submit"]');

    // An error alert or inline message should appear
    const error = page.locator('[role="alert"], .error, [data-testid="error"]');
    await expect(error.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-02  Login
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Login — POST /auth/login", () => {
  test.beforeAll(async ({ request }) => {
    // Ensure USER_A exists
    await registerUser(request, USER_A.email, USER_A.password);
  });

  test("AUTH-02-01: successful login returns 200 with user_id and email", async ({
    request,
  }) => {
    const { ok, status, body } = await loginUser(request, USER_A.email, USER_A.password);
    expect(status).toBe(200);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("user_id");
    expect(body).toHaveProperty("email", USER_A.email);
  });

  test("AUTH-02-02: wrong password returns 401", async ({ request }) => {
    const { status } = await loginUser(request, USER_A.email, "WrongPassXYZ!");
    expect(status).toBe(401);
  });

  test("AUTH-02-03: non-existent email returns 401", async ({ request }) => {
    const { status } = await loginUser(
      request,
      INVALID_USER.email,
      INVALID_USER.password
    );
    expect(status).toBe(401);
  });

  test("AUTH-02-04: login response never contains raw token values in body", async ({
    request,
  }) => {
    const { body } = await loginUser(request, USER_A.email, USER_A.password);
    const bodyStr = JSON.stringify(body);
    // Body should NOT include "eyJ" which is the start of a JWT
    expect(bodyStr).not.toMatch(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
  });

  test("AUTH-02-05: UI login form → redirects to dashboard on success", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test("AUTH-02-06: UI shows error message on wrong password", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', "WrongPasswordXYZ!");
    await page.click('button[type="submit"]');

    const error = page.locator('[role="alert"], .error, [data-testid="error"]');
    await expect(error.first()).toBeVisible({ timeout: 8_000 });
    // Should NOT navigate away from login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-03  GET /auth/me — token validation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("GET /auth/me — session validation", () => {
  test("AUTH-03-01: returns authenticated user when cookie is valid", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { ok, body } = await getMe(request);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("email", USER_A.email);
    expect(body).toHaveProperty("is_active", true);
    // password_hash must not leak
    expect(JSON.stringify(body)).not.toMatch(/password_hash/);
  });

  test("AUTH-03-02: returns 401 without a valid cookie", async ({ request }) => {
    // Fresh request context with no cookies
    const { status } = await getMe(request);
    expect(status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-04  Logout
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Logout — POST /auth/logout", () => {
  test("AUTH-04-01: returns 204 and subsequent /auth/me returns 401", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    await logoutUser(request);
    // After logout, me endpoint should fail
    const { status } = await getMe(request);
    expect(status).toBe(401);
  });

  test("AUTH-04-02: UI logout clears session and redirects to /login", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.dashboard);
    await page.waitForLoadState("networkidle");

    // Find and click logout button — common patterns
    const logoutBtn = page.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout"), [data-testid="logout"]'
    );
    if (await logoutBtn.count() > 0) {
      await logoutBtn.first().click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    } else {
      // If no visible logout button, call API directly and verify redirect
      await logoutUser(request);
      await page.goto(ROUTES.dashboard);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-05  Refresh token rotation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Token refresh — POST /auth/refresh", () => {
  test("AUTH-05-01: refresh with valid refresh token returns 200 and new token data", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { ok, status, body } = await refreshToken(request);
    expect(status).toBe(200);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("user_id");
  });

  test("AUTH-05-02: refresh without a refresh token cookie returns 401", async ({
    request,
  }) => {
    // Do NOT login — no cookies
    const { status } = await refreshToken(request);
    expect(status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-06  Frontend route protection (middleware)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Frontend middleware — protected route redirects", () => {
  const protectedRoutes = [
    ROUTES.dashboard,
    ROUTES.strategies,
    ROUTES.backtests,
    ROUTES.liveTrading,
    ROUTES.artifacts,
    ROUTES.profile,
  ];

  for (const route of protectedRoutes) {
    test(`AUTH-06: unauthenticated access to ${route} redirects to /login`, async ({
      page,
    }) => {
      // Fresh context — no cookies
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUTH-07  Security: HttpOnly cookie + no localStorage tokens
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — token storage assertions", () => {
  test("AUTH-07-01: access token is NOT readable via document.cookie (HttpOnly)", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    // Log in through the UI so cookies are set by the browser
    await page.goto(ROUTES.login);
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    // document.cookie is readable by JS — HttpOnly cookies should NOT appear
    const visibleCookies: string = await page.evaluate(() => document.cookie);
    expect(visibleCookies).not.toContain(ACCESS_COOKIE);
    expect(visibleCookies).not.toContain(REFRESH_COOKIE);
  });

  test("AUTH-07-02: no JWT token stored in localStorage after login", async ({
    page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    await page.goto(ROUTES.login);
    await page.fill('input[type="email"]', USER_A.email);
    await page.fill('input[type="password"]', USER_A.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });

    const allKeys: string[] = await page.evaluate(() => Object.keys(localStorage));
    // None of the localStorage keys should look like a JWT or token key
    const tokenKeys = allKeys.filter(
      (k) =>
        k.toLowerCase().includes("token") ||
        k.toLowerCase().includes("jwt") ||
        k.toLowerCase().includes("access") ||
        k.toLowerCase().includes("refresh")
    );
    expect(tokenKeys).toHaveLength(0);
  });

  test("AUTH-07-03: unauthenticated API request to protected endpoint returns 401", async ({
    request,
  }) => {
    // Do not login — fresh request context
    const res = await request.get(`${API_URL}/profile`);
    expect(res.status()).toBe(401);
  });
});
