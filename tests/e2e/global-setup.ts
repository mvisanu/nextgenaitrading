/**
 * Playwright global setup — runs once before all tests.
 *
 * Calls POST /test/reset to delete test user accounts (USER_A, USER_B) so
 * every test run starts with a clean DB state. The endpoint is only available
 * when DEBUG=true is set in the backend .env.
 */

import { request } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: API_URL });

  try {
    const res = await ctx.post(`${API_URL}/test/reset`);
    if (res.ok()) {
      const body = await res.json();
      console.log(
        `[global-setup] DB reset: deleted ${body.deleted_users} test user(s)`
      );
    } else if (res.status() === 403) {
      console.warn(
        "[global-setup] /test/reset returned 403 — DEBUG=true is required. " +
          "Running tests against an unclean database state."
      );
    } else {
      console.error(
        `[global-setup] /test/reset failed: ${res.status()} ${await res.text()}`
      );
    }
  } catch (err) {
    console.warn(
      `[global-setup] Could not reach backend at ${API_URL} — is it running?`,
      err
    );
  } finally {
    await ctx.dispose();
  }
}
