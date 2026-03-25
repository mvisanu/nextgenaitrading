/**
 * Shared authenticated page fixture for NextGenStock E2E tests.
 *
 * Usage:
 *   import { test, expect } from "../fixtures/auth.fixture";
 *
 *   test("my test", async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto("/dashboard");
 *     // ... already logged in as USER_A
 *   });
 *
 * The fixture registers USER_A (if needed) via the API, logs in, and
 * exposes a `page` that has a valid session cookie.  It does NOT go
 * through the UI login form — that is tested explicitly in auth.spec.ts.
 */

import { test as base, expect, type Page, type APIRequestContext } from "@playwright/test";
import { API_URL, USER_A, ACCESS_COOKIE, REFRESH_COOKIE } from "./test-data";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a user via the backend API (no browser involved).
 * Silently ignores 409 Conflict (user already exists).
 */
export async function apiRegister(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<void> {
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password },
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(
      `apiRegister failed: ${res.status()} ${await res.text()}`
    );
  }
}

/**
 * Log in via the backend API by logging in with the request context (which
 * stores cookies internally), then transferring those cookies to a new browser
 * context using storageState().
 *
 * Returns the Playwright storageState object for use with browser.newContext().
 */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
  _domain: string = "localhost"
): Promise<
  {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  }[]
> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`apiLogin failed: ${res.status()} ${await res.text()}`);
  }

  // Use Playwright's storageState to capture cookies set by the login response.
  // This is more robust than parsing Set-Cookie headers manually (which breaks
  // on cookies containing commas in their expires attribute).
  const state = await request.storageState();
  const cookies = state.cookies
    .filter((c) => c.name === ACCESS_COOKIE || c.name === REFRESH_COOKIE)
    .map((c) => ({
      name: c.name,
      value: c.value,
      // For localhost, Playwright requires the domain to include leading dot or
      // be exactly "localhost". Use the value from storageState when available.
      // If empty, fall back to "localhost".
      domain: c.domain || "localhost",
      path: c.path || "/",
      httpOnly: c.httpOnly ?? true,
      secure: c.secure ?? false,
      // Playwright's addCookies() expects "Strict" | "Lax" | "None"
      sameSite: (c.sameSite === "None"
        ? "None"
        : c.sameSite === "Strict"
        ? "Strict"
        : "Lax") as "Strict" | "Lax" | "None",
    }));

  return cookies;
}

/**
 * Log out via the backend API (invalidates the refresh token session record).
 */
export async function apiLogout(request: APIRequestContext): Promise<void> {
  await request.post(`${API_URL}/auth/logout`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixture types
// ─────────────────────────────────────────────────────────────────────────────

type AuthFixtures = {
  /** A Playwright Page with a valid USER_A session cookie already set. */
  authenticatedPage: Page;
};

// ─────────────────────────────────────────────────────────────────────────────
// Extended test object
// ─────────────────────────────────────────────────────────────────────────────

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser, request }, use) => {
    // 1. Ensure user exists
    await apiRegister(request, USER_A.email, USER_A.password);

    // 2. Log in via API and retrieve cookies
    const cookies = await apiLogin(request, USER_A.email, USER_A.password);

    // 3. Create a fresh browser context with those cookies pre-loaded
    const context = await browser.newContext();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    await use(page);

    // 4. Clean up
    await apiLogout(request);
    await context.close();
  },
});

export { expect };
