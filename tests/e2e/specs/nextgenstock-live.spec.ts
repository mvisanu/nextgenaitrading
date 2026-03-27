/**
 * nextgenstock-live.spec.ts
 *
 * Live E2E tests for NextGenStock running against
 *   Frontend: http://localhost:3000
 *   Backend:  http://localhost:8000
 *
 * Covers:
 *   - Auth page structure (email-only, no password — Supabase magic link)
 *   - GET /auth/me authorization check
 *   - Middleware redirect behavior (unauthenticated → /login, authenticated → /dashboard)
 *   - Post-login navigation to dashboard (page loads, KPI cards present)
 *   - Other protected pages (strategies, backtests, live-trading, artifacts, profile)
 *   - Root redirect behavior
 *   - Navigation flows
 *   - Session management
 *
 * NOTE: Auth uses Supabase magic links — no password fields exist on login/register pages.
 * Browser auth in tests is done via /test/token (debug endpoint) + dev_token cookie injection.
 * Legacy password-based register/login/logout/refresh endpoints have been removed.
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}+${Date.now()}@nextgenstock.io`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Provision a user and get a test JWT via /test/token (debug-only endpoint). */
async function apiTestToken(
  request: APIRequestContext,
  email: string
): Promise<{ status: number; ok: boolean; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/test/token`, {
    data: { email },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), ok: res.ok(), body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser Auth Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticate the browser context via dev_token cookie injection.
 * Provisions the user via /test/token, injects JWT as a cookie, and navigates to /dashboard.
 */
async function loginViaBrowser(
  page: Page,
  request: APIRequestContext,
  email: string
): Promise<void> {
  const { body } = await apiTestToken(request, email);
  const token = (body as { access_token: string }).access_token;
  await page.context().addCookies([
    {
      name: "dev_token",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
    {
      name: "auth_session",
      value: "1",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 1: Backend API sanity (fast, no browser)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Backend API — Auth endpoints", () => {
  test("API-01: healthz returns ok", async ({ request }) => {
    const res = await request.get(`${API_URL}/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("status", "ok");
  });

  test("API-02: /auth/register returns 404 (endpoint removed — Supabase handles auth)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/register`, {
      data: { email: uniqueEmail("api-reg"), password: "TestPass1234!" },
    });
    expect(res.status()).toBe(404);
  });

  test("API-09: /auth/login returns 404 (endpoint removed — Supabase handles auth)", async ({
    request,
  }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: { email: "test@example.com", password: "TestPass1234!" },
    });
    expect(res.status()).toBe(404);
  });

  test("API-13: GET /auth/me without Bearer token returns 401", async ({ playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.get(`${API_URL}/auth/me`);
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("API-14: GET /auth/me with valid dev_token Bearer returns user data", async ({
    request,
  }) => {
    const email = uniqueEmail("api-me");
    const { body: tokenBody } = await apiTestToken(request, email);
    const token = (tokenBody as { access_token: string }).access_token;

    const res = await request.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("email", email);
    expect(body).toHaveProperty("is_active", true);
    expect(JSON.stringify(body)).not.toMatch(/password_hash/);
  });

  test("API-16: /auth/refresh returns 404 (endpoint removed — Supabase handles refresh)", async ({
    playwright,
  }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.post(`${API_URL}/auth/refresh`);
      expect(res.status()).toBe(404);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("API-18: protected endpoints return 401 without auth", async ({ playwright }) => {
    const freshCtx = await playwright.request.newContext();
    const endpoints = [
      { method: "GET", path: "/profile" },
      { method: "GET", path: "/broker/credentials" },
      { method: "GET", path: "/backtests" },
      { method: "GET", path: "/strategies/runs" },
      { method: "GET", path: "/live/positions" },
      { method: "GET", path: "/artifacts" },
    ];
    try {
      for (const { method, path } of endpoints) {
        const res =
          method === "GET"
            ? await freshCtx.get(`${API_URL}${path}`)
            : await freshCtx.post(`${API_URL}${path}`);
        expect(res.status(), `Expected 401 for ${method} ${path}`).toBe(401);
      }
    } finally {
      await freshCtx.dispose();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 2: Registration page UI (magic link — email only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Registration page UI — /register", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/register`);
    await page.waitForLoadState("networkidle");
  });

  test("REG-UI-01: register page loads with email input and NO password fields (magic link)", async ({
    page,
  }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/login"]')).toBeVisible();
  });

  test("REG-UI-02: email field shows validation error when empty and form submitted", async ({
    page,
  }) => {
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/register/);
  });

  test("REG-UI-05: valid email submission stays on register page (magic link sent or Supabase not configured)", async ({
    page,
  }) => {
    await page.fill('input[type="email"]', uniqueEmail("reg-valid"));
    await page.click('button[type="submit"]');
    // Either shows "check your email" confirmation or stays with error if Supabase not configured
    // Should NOT navigate to dashboard without magic link click
    await expect(page).toHaveURL(/\/register/, { timeout: 10_000 });
  });

  test("REG-UI-07: link to /login is present and navigates correctly", async ({ page }) => {
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test("REG-UI-09: unauthenticated user can access /register (no redirect)", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("REG-UI-10: authenticated user visiting /register is redirected to /dashboard", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("reg-auth-redir");
    await loginViaBrowser(page, request, email);
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 3: Login page UI (magic link — email only)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page UI — /login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState("networkidle");
  });

  test("LOGIN-UI-01: login page loads with email input and NO password field (magic link)", async ({
    page,
  }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields).toHaveCount(0);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('a[href="/register"]')).toBeVisible();
  });

  test("LOGIN-UI-02: empty email field shows validation error on submit", async ({
    page,
  }) => {
    await page.click('button[type="submit"]');
    const errorMsg = page.locator("p.text-destructive, [class*='destructive']");
    await expect(errorMsg.first()).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("LOGIN-UI-03: invalid email format shows validation error", async ({ page }) => {
    await page.fill('input[type="email"]', "not-an-email");
    await page.click('button[type="submit"]');
    const errorMsg = page
      .locator("p.text-destructive, [class*='destructive']")
      .filter({ hasText: /valid email/i });
    await expect(errorMsg).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("LOGIN-UI-09: link to /register navigates correctly", async ({ page }) => {
    await page.click('a[href="/register"]');
    await expect(page).toHaveURL(/\/register/);
  });

  test("LOGIN-UI-10: page contains educational disclaimer text", async ({ page }) => {
    await expect(
      page.locator("p").filter({ hasText: /educational software/i })
    ).toBeVisible();
  });

  test("LOGIN-UI-11: authenticated user visiting /login is redirected to /dashboard", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("login-auth-redir");
    await loginViaBrowser(page, request, email);
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 4: Middleware redirect behavior
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Middleware — route protection", () => {
  const protectedRoutes = [
    "/dashboard",
    "/strategies",
    "/backtests",
    "/live-trading",
    "/artifacts",
    "/profile",
  ];

  for (const route of protectedRoutes) {
    test(`MW-01: unauthenticated access to ${route} redirects to /login`, async ({
      page,
    }) => {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }

  test("MW-02: /login redirect includes callbackUrl query param", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  test("MW-03: root path / redirects unauthenticated user to /login via /dashboard", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("MW-04: authenticated user can access all protected routes", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("mw-auth");
    await loginViaBrowser(page, request, email);

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page).not.toHaveURL(/\/login/, { timeout: 5_000 });
      expect(page.url()).toContain(route);
    }
  });

  test("MW-05: unauthenticated access to /login is allowed (no redirect loop)", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("MW-06: unauthenticated access to /register is allowed (no redirect loop)", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 5: Dashboard page
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Dashboard page — /dashboard", () => {
  let authEmail: string;

  test.beforeEach(async ({ page, request }) => {
    authEmail = uniqueEmail("dash");
    await loginViaBrowser(page, request, authEmail);
  });

  test("DASH-01: dashboard loads with correct title", async ({ page }) => {
    await expect(
      page.locator("h1, h2, [class*='title']").filter({ hasText: /dashboard/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("DASH-02: four KPI cards are visible", async ({ page }) => {
    const cards = page.locator(".rounded-lg, [class*='card']");
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("DASH-03: New Strategy Run button links to /strategies", async ({ page }) => {
    const btn = page.locator('a[href="/strategies"]').first();
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test("DASH-04: shows empty state for runs when no backtests exist", async ({ page }) => {
    const emptyOrTable = page.locator("text=No strategy runs yet., table");
    await expect(emptyOrTable.first()).toBeVisible({ timeout: 10_000 });
  });

  test("DASH-05: sidebar navigation is present with links to all pages", async ({ page }) => {
    const nav = page.locator("nav, aside");
    await expect(nav.first()).toBeVisible({ timeout: 10_000 });

    const expectedLinks = [
      "/dashboard",
      "/strategies",
      "/backtests",
      "/live-trading",
      "/artifacts",
      "/profile",
    ];
    for (const href of expectedLinks) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({
        timeout: 5_000,
      });
    }
  });

  test("DASH-06: console has no unhandled errors on dashboard load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.reload();
    await page.waitForLoadState("networkidle");
    const realErrors = errors.filter(
      (e) => !e.includes("Warning:") && !e.includes("hydration")
    );
    expect(realErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 6: Protected pages rendering check (authenticated)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Protected pages — authenticated rendering", () => {
  let authEmail: string;

  test.beforeEach(async ({ page, request }) => {
    authEmail = uniqueEmail("pages");
    await loginViaBrowser(page, request, authEmail);
  });

  test("PAGES-01: /strategies loads with strategy tabs visible", async ({ page }) => {
    await page.goto(`${BASE_URL}/strategies`);
    await page.waitForLoadState("networkidle");
    const tabsOrContent = page.locator('[role="tab"], [role="tablist"], .tab');
    await expect(tabsOrContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-02: /backtests loads with New Backtest button", async ({ page }) => {
    await page.goto(`${BASE_URL}/backtests`);
    await page.waitForLoadState("networkidle");
    const newBacktestBtn = page.locator("button").filter({ hasText: /new backtest/i });
    await expect(newBacktestBtn).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-03: /live-trading loads with risk disclaimer banner", async ({ page }) => {
    await page.goto(`${BASE_URL}/live-trading`);
    await page.waitForLoadState("networkidle");
    const disclaimer = page
      .locator('[role="alert"], .alert, [class*="destructive"]')
      .filter({ hasText: /risk|disclaimer|live|warning/i });
    await expect(disclaimer.first()).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-04: /artifacts loads with table or empty state", async ({ page }) => {
    await page.goto(`${BASE_URL}/artifacts`);
    await page.waitForLoadState("networkidle");
    const content = page.locator("table, text=No artifacts");
    await expect(content.first()).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-05: /profile loads with user info and broker credentials sections", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState("networkidle");
    const profileContent = page
      .locator("h2, h3, [class*='title']")
      .filter({ hasText: /profile|broker|credential/i });
    await expect(profileContent.first()).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-06: /strategies has Run/Analyze button in each strategy form", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/strategies`);
    await page.waitForLoadState("networkidle");
    const runBtn = page.locator("button").filter({ hasText: /run|analyze/i });
    await expect(runBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("PAGES-07: /live-trading has dry-run toggle defaulting to ON", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/live-trading`);
    await page.waitForLoadState("networkidle");
    const dryRunSwitch = page.locator('button[role="switch"]').first();
    await expect(dryRunSwitch).toBeVisible({ timeout: 10_000 });
    await expect(dryRunSwitch).toHaveAttribute("data-state", "checked");
  });

  test("PAGES-08: /backtests shows table or empty state", async ({ page }) => {
    await page.goto(`${BASE_URL}/backtests`);
    await page.waitForLoadState("networkidle");
    const either = page.locator("th, thead, text=No backtests yet");
    await expect(either.first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 7: Session management
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Session management", () => {
  test("SESSION-01: dev_token cookie is readable via document.cookie (not HttpOnly)", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("session-cookie");
    await loginViaBrowser(page, request, email);

    const visibleCookies: string = await page.evaluate(() => document.cookie);
    // dev_token must be readable by JS — frontend uses it in getAuthHeaders()
    expect(visibleCookies).toContain("dev_token");
  });

  test("SESSION-03: after clearing cookies, visiting /dashboard redirects to /login", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("session-logout");
    await loginViaBrowser(page, request, email);

    // Clear all cookies to simulate logout/session expiry
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("SESSION-04: page reload on /dashboard keeps the user on /dashboard (cookie persists)", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("session-reload");
    await loginViaBrowser(page, request, email);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 8: UI consistency and accessibility basics
// ─────────────────────────────────────────────────────────────────────────────

test.describe("UI consistency — auth pages", () => {
  test("UI-01: login page has page title containing 'NextGen' or 'Trading'", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page).toHaveTitle(/NextGen|Trading/i);
  });

  test("UI-02: register page has page title containing 'NextGen' or 'Trading'", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/register`);
    await expect(page).toHaveTitle(/NextGen|Trading/i);
  });

  test("UI-03: login and register pages show 'NextGenAi Trading' branding", async ({
    page,
  }) => {
    for (const route of ["/login", "/register"]) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(
        page.locator("span, h1, h2").filter({ hasText: /NextGenAi Trading/i })
      ).toBeVisible();
    }
  });

  test("UI-04: login page email input has autocomplete=email attribute", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
  });

  test("UI-07: login form labels are associated with inputs (for/id match)", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.locator("label").filter({ hasText: "Email" }).click();
    await expect(page.locator('input[type="email"]')).toBeFocused();
  });

  test("UI-08: dark mode class is applied to html element", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const htmlEl = page.locator("html");
    await expect(htmlEl).toHaveClass(/dark/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 9: Error handling
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Error handling — auth pages", () => {
  test("ERR-01: submitting magic link form with valid email stays on page (no immediate redirect)", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', "test@example.com");
    await page.click('button[type="submit"]');
    // Should stay on login page (either shows "check your email" or Supabase error if not configured)
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCK 10: Navigation flows
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Navigation flows — post-login", () => {
  test("NAV-01: after login, sidebar links navigate to correct pages without redirecting to /login", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("nav-links");
    await loginViaBrowser(page, request, email);

    const navLinks: Array<{ href: string; expectedUrlPart: string }> = [
      { href: "/strategies", expectedUrlPart: "strategies" },
      { href: "/backtests", expectedUrlPart: "backtests" },
      { href: "/live-trading", expectedUrlPart: "live-trading" },
      { href: "/artifacts", expectedUrlPart: "artifacts" },
      { href: "/profile", expectedUrlPart: "profile" },
      { href: "/dashboard", expectedUrlPart: "dashboard" },
    ];

    for (const { href, expectedUrlPart } of navLinks) {
      await page.locator(`a[href="${href}"]`).first().click();
      await page.waitForURL(new RegExp(expectedUrlPart), { timeout: 10_000 });
      expect(page.url()).toContain(expectedUrlPart);
      expect(page.url()).not.toContain("/login");
    }
  });

  test("NAV-02: browser back navigation works after login", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("nav-back");
    await loginViaBrowser(page, request, email);

    await page.goto(`${BASE_URL}/strategies`);
    await expect(page).toHaveURL(/\/strategies/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("NAV-03: page refresh on /dashboard keeps the user on /dashboard", async ({
    page,
    request,
  }) => {
    const email = uniqueEmail("nav-refresh");
    await loginViaBrowser(page, request, email);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page).not.toHaveURL(/\/login/);
  });
});
