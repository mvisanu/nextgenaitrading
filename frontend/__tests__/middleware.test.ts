/**
 * @jest-environment node
 *
 * Tests for proxy.ts (formerly middleware.ts)
 * Covers: protected route redirect when no cookie, public route redirect when
 *         authenticated, pass-through for unmatched paths.
 *
 * Uses the node environment so that the Web Fetch API (Request, Headers, etc.)
 * is available from Node's built-in globals (Node 18+).
 */

import { proxy as middleware } from "@/proxy";
import { NextRequest } from "next/server";

// Helper to create a NextRequest with optional access_token cookie
function makeRequest(pathname: string, hasToken = false): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  const headers = new Headers();
  if (hasToken) {
    headers.set("cookie", "access_token=test_token_value");
  }
  return new NextRequest(url, { headers });
}

// ─── Protected routes without token ───────────────────────────────────────────

describe("middleware — unauthenticated access to protected routes", () => {
  const protectedPaths = [
    "/dashboard",
    "/strategies",
    "/backtests",
    "/live-trading",
    "/artifacts",
    "/profile",
    "/dashboard/sub-page",
  ];

  test.each(protectedPaths)("redirects %s to /login", (path) => {
    const req = makeRequest(path, false);
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("includes callbackUrl in redirect for protected path", () => {
    const req = makeRequest("/dashboard", false);
    const res = middleware(req);

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("callbackUrl=%2Fdashboard");
  });
});

// ─── Protected routes with token ──────────────────────────────────────────────

describe("middleware — authenticated access to protected routes", () => {
  it("passes through /dashboard when token present", () => {
    const req = makeRequest("/dashboard", true);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it("passes through /profile when token present", () => {
    const req = makeRequest("/profile", true);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});

// ─── Public routes with token (already authenticated) ─────────────────────────

describe("middleware — authenticated access to public routes", () => {
  it("redirects /login to /dashboard when token present", () => {
    const req = makeRequest("/login", true);
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects /register to /dashboard when token present", () => {
    const req = makeRequest("/register", true);
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirect to dashboard does NOT include callbackUrl", () => {
    const req = makeRequest("/login", true);
    const res = middleware(req);

    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("callbackUrl");
  });
});

// ─── Public routes without token ──────────────────────────────────────────────

describe("middleware — unauthenticated access to public routes", () => {
  it("passes through /login without token", () => {
    const req = makeRequest("/login", false);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });

  it("passes through /register without token", () => {
    const req = makeRequest("/register", false);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});

// ─── Unmatched paths ──────────────────────────────────────────────────────────

describe("middleware — unmatched / root paths", () => {
  it("redirects root / to /login without token", () => {
    const req = makeRequest("/", false);
    const res = middleware(req);

    // proxy.ts redirects / → /login (unauthenticated) or /dashboard (authenticated)
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects root / to /dashboard with token", () => {
    const req = makeRequest("/", true);
    const res = middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("passes through unknown path /foobar without token", () => {
    const req = makeRequest("/foobar", false);
    const res = middleware(req);

    expect(res.status).toBe(200);
  });
});
