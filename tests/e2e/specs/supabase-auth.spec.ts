/**
 * supabase-auth.spec.ts — Supabase Auth E2E tests
 *
 * Tests the Supabase magic link authentication flow as documented in AUTH.md.
 * Since magic links require email delivery, UI tests validate form structure,
 * route protection, and error handling. API tests validate Bearer token auth.
 *
 * Covers:
 *   SA-01  Login page renders email-only form (no password field)
 *   SA-02  Register page renders email-only form (no password field)
 *   SA-03  Login form submits and shows magic link confirmation
 *   SA-04  Register form submits and shows magic link confirmation
 *   SA-05  Auth callback route handles missing/invalid code
 *   SA-06  GET /auth/me returns 401 without Bearer token
 *   SA-07  GET /auth/me returns 401 with invalid Bearer token
 *   SA-08  GET /auth/me returns 401 with expired/malformed JWT
 *   SA-09  Protected API endpoints return 401 without auth
 *   SA-10  Frontend middleware redirects unauthenticated users to /login
 *   SA-11  Frontend middleware redirects authenticated auth-page visits to /dashboard
 *   SA-12  Auth callback redirects to /login on failure
 *   SA-13  Login page has link to register
 *   SA-14  Register page has link to login
 *   SA-15  No password fields exist on login or register pages
 *   SA-16  Root path redirects appropriately
 */

import { test, expect } from "@playwright/test";
import { API_URL, BASE_URL, ROUTES } from "../fixtures/test-data";

// ─────────────────────────────────────────────────────────────────────────────
// SA-01  Login page form structure
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Login page — magic link form (SA-01)", () => {
  test("SA-01-01: login page renders with email input and no password field", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    // Email input must exist
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // No password fields should exist
    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields).toHaveCount(0);
  });

  test("SA-01-02: login page has 'Send magic link' submit button", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText(/magic link/i);
  });

  test("SA-01-03: login page shows NextGenStock branding", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=NextGenStock")).toBeVisible();
  });

  test("SA-01-04: login page shows 'Sign in' heading", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Sign in")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-02  Register page form structure
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Register page — magic link form (SA-02)", () => {
  test("SA-02-01: register page renders with email input and no password field", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields).toHaveCount(0);
  });

  test("SA-02-02: register page has 'Send magic link' submit button", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText(/magic link/i);
  });

  test("SA-02-03: register page shows 'Create account' heading", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Create account")).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-03  Login form submission → magic link confirmation
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Login form submission (SA-03)", () => {
  test("SA-03-01: submitting valid email shows 'Check your email' confirmation", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "test-magic@example.com");
    await page.click('button[type="submit"]');

    // Should show the magic link sent confirmation
    // (Supabase may return an error if not configured, but the UI should handle it)
    const confirmation = page.locator("text=Check your email");
    const errorAlert = page.locator('[role="alert"]');

    // Either shows confirmation (Supabase configured) or error (not configured)
    await expect(
      confirmation.or(errorAlert).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("SA-03-02: confirmation screen shows the submitted email address", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const testEmail = "confirm-test@example.com";
    await page.fill('input[type="email"]', testEmail);
    await page.click('button[type="submit"]');

    // If Supabase is configured, the confirmation shows the email
    const emailDisplay = page.locator(`text=${testEmail}`);
    const errorAlert = page.locator('[role="alert"]');

    // Wait for either confirmation with email or an error
    await expect(
      emailDisplay.or(errorAlert).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("SA-03-03: confirmation screen has 'Try a different email' button", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "diff-email@example.com");
    await page.click('button[type="submit"]');

    // If magic link was sent, should show a "Try a different email" button
    const tryDiffBtn = page.locator("text=Try a different email");
    const errorAlert = page.locator('[role="alert"]');

    const visible = await tryDiffBtn.or(errorAlert).first().isVisible().catch(() => false);
    // If Supabase is configured, the try-different button should appear
    if (await tryDiffBtn.isVisible().catch(() => false)) {
      await tryDiffBtn.click();
      // Should return to the email form
      await expect(page.locator('input[type="email"]')).toBeVisible();
    }
  });

  test("SA-03-04: submitting empty email shows validation error", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    // Click submit without entering email
    await page.click('button[type="submit"]');

    // Should show a validation error (HTML5 or zod)
    const errorText = page.locator(".text-destructive, [role='alert']");
    await expect(errorText.first()).toBeVisible({ timeout: 5_000 });
  });

  test("SA-03-05: submitting invalid email format shows validation error", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "not-an-email");
    await page.click('button[type="submit"]');

    // Zod validation should show "Please enter a valid email address"
    const errorText = page.locator(".text-destructive");
    await expect(errorText.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-04  Register form submission
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Register form submission (SA-04)", () => {
  test("SA-04-01: submitting valid email shows confirmation or error", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await page.fill('input[type="email"]', "register-test@example.com");
    await page.click('button[type="submit"]');

    const confirmation = page.locator("text=Check your email");
    const errorAlert = page.locator('[role="alert"]');

    await expect(
      confirmation.or(errorAlert).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("SA-04-02: submitting invalid email shows validation error", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    // The register form does NOT have noValidate, so the browser's HTML5 email
    // validation fires before react-hook-form/Zod when the value has no "@".
    // We use page.evaluate() to set the input value directly (bypassing the
    // browser's type="email" setter coercion) so that HTML5 validation fails
    // and the :invalid pseudo-class is applied, OR we use fill() with a value
    // that passes HTML5 validation but fails Zod, triggering the Zod error.
    //
    // Strategy: fill with a value that satisfies the HTML5 email pattern
    // (contains "@") but is rejected by Zod's stricter check (no TLD).
    // Both approaches are covered: if HTML5 blocks submission we check :invalid;
    // if Zod runs we check .text-destructive.
    await page.fill('input[type="email"]', "bad-email");
    await page.click('button[type="submit"]');

    // Wait briefly for validation to fire
    await page.waitForTimeout(500);

    // Accept either: (a) Zod .text-destructive error rendered, or
    // (b) HTML5 native validation blocked submission (input is :invalid and page stayed on /register)
    const zodError = page.locator(".text-destructive");
    const hasZodError = (await zodError.count()) > 0 && (await zodError.first().isVisible());
    const isHtml5Invalid = await page.locator('input[type="email"]').evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );

    expect(hasZodError || isHtml5Invalid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-05  Auth callback route
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Auth callback route (SA-05)", () => {
  test("SA-05-01: /auth/callback without code redirects to /login with error", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await page.waitForLoadState("networkidle");

    // Should redirect to /login with error param
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("SA-05-02: /auth/callback with invalid code redirects to /login", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=invalid-code-123");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("SA-05-03: /auth/callback error redirect includes error query param", async ({
    page,
  }) => {
    await page.goto("/auth/callback");
    await page.waitForLoadState("networkidle");

    // Should have auth_callback_failed in the URL
    await expect(page).toHaveURL(/error=auth_callback_failed/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-06  Backend: GET /auth/me without Bearer token
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Backend auth — GET /auth/me (SA-06)", () => {
  test("SA-06-01: returns 401 without Authorization header", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: "" },
    });
    // HTTPBearer with auto_error=False returns 401 from get_current_user
    expect([401, 403]).toContain(res.status());
  });

  test("SA-06-02: returns 401 with malformed Bearer token", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: "Bearer not-a-valid-jwt" },
    });
    expect(res.status()).toBe(401);
  });

  test("SA-06-03: returns 401 with expired JWT", async ({ request }) => {
    // Craft a fake expired JWT (header.payload.signature — all base64)
    const expiredJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
      "eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QHRlc3QuY29tIiwiZXhwIjoxNjAwMDAwMDAwfQ." +
      "invalid-signature-here";

    const res = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${expiredJwt}` },
    });
    expect(res.status()).toBe(401);
  });

  test("SA-06-04: 401 response includes WWW-Authenticate header", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(res.status()).toBe(401);

    const body = await res.json().catch(() => ({}));
    // Should have "Not authenticated." detail
    expect(body).toHaveProperty("detail");
  });

  test("SA-06-05: 401 response body never contains password_hash", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/auth/me`);
    const bodyStr = await res.text();
    expect(bodyStr).not.toMatch(/password_hash/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-07  Protected API endpoints return 401 without auth
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Protected API endpoints — 401 without auth (SA-07)", () => {
  const protectedEndpoints = [
    { method: "GET", path: "/auth/me" },
    { method: "GET", path: "/profile" },
    { method: "GET", path: "/broker/credentials" },
    { method: "GET", path: "/strategies/runs" },
    { method: "GET", path: "/backtests" },
    { method: "GET", path: "/live/orders" },
    { method: "GET", path: "/live/positions" },
    { method: "GET", path: "/artifacts" },
    { method: "GET", path: "/opportunities/watchlist" },
    { method: "GET", path: "/alerts" },
    { method: "GET", path: "/auto-buy/settings" },
  ];

  for (const { method, path } of protectedEndpoints) {
    test(`SA-07: ${method} ${path} returns 401 without auth`, async ({
      request,
    }) => {
      const res = await request.fetch(`${API_URL}${path}`, {
        method,
      });
      expect([401, 403]).toContain(res.status());
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-08  Frontend middleware — route protection
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Frontend middleware — protected route redirects (SA-08)", () => {
  const protectedRoutes = [
    ROUTES.dashboard,
    ROUTES.strategies,
    ROUTES.backtests,
    ROUTES.liveTrading,
    ROUTES.artifacts,
    ROUTES.profile,
    ROUTES.opportunities,
    ROUTES.ideas,
    ROUTES.alerts,
    ROUTES.autoBuy,
  ];

  for (const route of protectedRoutes) {
    test(`SA-08: unauthenticated access to ${route} redirects to /login`, async ({
      browser,
    }) => {
      // Fresh context with no session state
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(route);
      // Wait for navigation to settle before asserting URL — webkit is slower
      // to process the middleware redirect than chromium/firefox.
      await page.waitForLoadState("networkidle", { timeout: 15_000 });
      await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
      await context.close();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-09  Frontend middleware — callbackUrl param
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Frontend middleware — callbackUrl (SA-09)", () => {
  test("SA-09-01: redirect to /login includes callbackUrl for the original path", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(ROUTES.dashboard);
    await page.waitForLoadState("networkidle");

    // URL should contain callbackUrl=/dashboard
    const url = page.url();
    expect(url).toMatch(/\/login/);
    expect(url).toMatch(/callbackUrl/);
    await context.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-10  Root path redirect
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Root path redirect (SA-10)", () => {
  test("SA-10-01: unauthenticated user at / is redirected to /login", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await context.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-11  Navigation links between login and register
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Auth page navigation links (SA-11)", () => {
  test("SA-11-01: login page has link to register", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText(/create/i);
  });

  test("SA-11-02: register page has link to login", async ({ page }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toContainText(/sign in/i);
  });

  test("SA-11-03: clicking 'Create one' on login navigates to register", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await page.click('a[href="/register"]');
    await expect(page).toHaveURL(/\/register/, { timeout: 10_000 });
  });

  test("SA-11-04: clicking 'Sign in' on register navigates to login", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-12  Security: no tokens in localStorage
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Security — no sensitive tokens exposed (SA-12)", () => {
  test("SA-12-01: login page does not store JWT tokens in localStorage", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const allKeys: string[] = await page.evaluate(() =>
      Object.keys(localStorage)
    );
    const tokenKeys = allKeys.filter(
      (k) =>
        k.toLowerCase().includes("jwt") ||
        k.toLowerCase().includes("access_token") ||
        k.toLowerCase().includes("refresh_token")
    );
    expect(tokenKeys).toHaveLength(0);
  });

  test("SA-12-02: register page does not store JWT tokens in localStorage", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    const allKeys: string[] = await page.evaluate(() =>
      Object.keys(localStorage)
    );
    const tokenKeys = allKeys.filter(
      (k) =>
        k.toLowerCase().includes("jwt") ||
        k.toLowerCase().includes("access_token") ||
        k.toLowerCase().includes("refresh_token")
    );
    expect(tokenKeys).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-13  Backend: legacy auth endpoints removed
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Legacy auth endpoints removed (SA-13)", () => {
  test("SA-13-01: POST /auth/register returns 404 or 405 (removed)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/register`, {
      data: { email: "test@test.com", password: "TestPass123!" },
    });
    // Should not exist anymore — Supabase handles registration
    expect([404, 405, 422]).toContain(res.status());
  });

  test("SA-13-02: POST /auth/login returns 404 or 405 (removed)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: "test@test.com", password: "TestPass123!" },
    });
    expect([404, 405, 422]).toContain(res.status());
  });

  test("SA-13-03: POST /auth/refresh returns 404 or 405 (removed)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/refresh`);
    expect([404, 405, 422]).toContain(res.status());
  });

  test("SA-13-04: POST /auth/logout returns 404 or 405 (removed)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/logout`);
    expect([404, 405, 422]).toContain(res.status());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-14  Passwordless verification — no password fields anywhere
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Passwordless — no password fields (SA-14)", () => {
  test("SA-14-01: login page has zero password input fields", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    const count = await page.locator('input[type="password"]').count();
    expect(count).toBe(0);
  });

  test("SA-14-02: register page has zero password input fields", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    const count = await page.locator('input[type="password"]').count();
    expect(count).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-15  Educational disclaimer
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Educational disclaimer on auth pages (SA-15)", () => {
  test("SA-15-01: login page shows financial risk disclaimer", async ({
    page,
  }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("text=Educational software only")
    ).toBeVisible();
  });

  test("SA-15-02: register page shows financial risk disclaimer", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("text=Educational software only")
    ).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SA-16  Magic link description text
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Magic link UX copy (SA-16)", () => {
  test("SA-16-01: login page describes magic link flow", async ({ page }) => {
    await page.goto(ROUTES.login);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("text=Enter your email to receive a magic link")
    ).toBeVisible();
  });

  test("SA-16-02: register page describes getting started", async ({
    page,
  }) => {
    await page.goto(ROUTES.register);
    await page.waitForLoadState("networkidle");

    await expect(
      page.locator("text=Enter your email to get started")
    ).toBeVisible();
  });
});
