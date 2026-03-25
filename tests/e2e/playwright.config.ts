import { defineConfig, devices } from "@playwright/test";

/**
 * NextGenStock — Playwright E2E configuration
 *
 * Backend:  http://localhost:8000  (FastAPI / uvicorn)
 * Frontend: http://localhost:3000  (Next.js dev server)
 *
 * Set PLAYWRIGHT_BASE_URL to override the frontend URL (e.g. for staging).
 * Set PLAYWRIGHT_API_URL  to override the backend URL.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

export default defineConfig({
  // ── Global setup (runs once before all tests) ─────────────────────────────
  globalSetup: "./global-setup",

  // ── Discovery ──────────────────────────────────────────────────────────────
  testDir: "./specs",
  fullyParallel: false,   // single worker — shares one DB; avoids cross-test pollution
  workers: 1,

  // ── Timeouts ───────────────────────────────────────────────────────────────
  timeout: 60_000,                // per-test timeout (60 s)
  expect: { timeout: 10_000 },   // assertion timeout (10 s)

  // ── Retry ─────────────────────────────────────────────────────────────────
  retries: process.env.CI ? 2 : 0,

  // ── Reporter ──────────────────────────────────────────────────────────────
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],

  // ── Global env passed to every test ───────────────────────────────────────
  use: {
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-e2e-test": "1",
    },
    // Include cookies on every request (JWT auth)
    storageState: undefined,        // each spec manages its own auth state

    // Screenshots and traces on failure
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },

  // ── Projects ──────────────────────────────────────────────────────────────
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  // ── Web server (optional — comment out if servers are started separately) ─
  // webServer: [
  //   {
  //     command: "cd ../../backend && uvicorn app.main:app --port 8000",
  //     url: `${API_URL}/healthz`,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 30_000,
  //   },
  //   {
  //     command: "cd ../../frontend && npm run dev",
  //     url: BASE_URL,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 60_000,
  //   },
  // ],
});

export { BASE_URL, API_URL };
