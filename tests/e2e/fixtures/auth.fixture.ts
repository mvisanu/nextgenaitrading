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
 * Authentication uses POST /test/token (debug-only) which:
 * 1. Auto-provisions the user if needed
 * 2. Returns a signed JWT in the JSON body
 * 3. Sets a `dev_token` cookie in the response
 *
 * The `dev_token` cookie is captured via storageState() and transferred to
 * the browser context. The frontend middleware (proxy.ts) accepts `dev_token`
 * as a valid session, and the backend accepts it as a fallback Bearer token
 * in debug mode (auth/dependencies.py).
 */

import { test as base, expect, type Page } from "@playwright/test";
import { API_URL, USER_A } from "./test-data";

// ─────────────────────────────────────────────────────────────────────────────
// Fixture types
// ─────────────────────────────────────────────────────────────────────────────

type AuthFixtures = {
  /** A Playwright Page with a valid USER_A dev_token session cookie already set. */
  authenticatedPage: Page;
};

// ─────────────────────────────────────────────────────────────────────────────
// Extended test object
// ─────────────────────────────────────────────────────────────────────────────

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ browser, request }, use) => {
    // 1. Provision user and get JWT via /test/token.
    //    The endpoint sets `dev_token` cookie in the response, which Playwright
    //    stores in the request context's cookie jar automatically.
    const tokenRes = await request.post(`${API_URL}/test/token`, {
      data: { email: USER_A.email },
    });
    if (!tokenRes.ok()) {
      throw new Error(
        `authenticatedPage /test/token failed: ${tokenRes.status()} ${await tokenRes.text()}`
      );
    }

    // 2. Capture cookies (including dev_token) from the API request context
    //    and transfer them to a fresh browser context.
    const storageState = await request.storageState();

    // Filter/remap cookies for the browser context — ensure domain is set correctly
    const cookies = storageState.cookies
      .filter((c) => c.name === "dev_token" || c.name === "auth_session")
      .map((c) => ({
        ...c,
        domain: c.domain || "localhost",
        path: c.path || "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax" as const,
      }));

    // Also inject auth_session=1 so the cross-origin auth check passes
    if (!cookies.find((c) => c.name === "auth_session")) {
      cookies.push({
        name: "auth_session",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      });
    }

    const context = await browser.newContext();
    await context.addCookies(cookies);
    const page = await context.newPage();

    await use(page);

    await context.close();
  },
});

export { expect };
