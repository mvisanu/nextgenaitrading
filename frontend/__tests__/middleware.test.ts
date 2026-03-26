/**
 * @jest-environment node
 *
 * Tests for proxy.ts (Supabase-based middleware)
 * Covers: protected route redirect when no session, public route redirect when
 *         authenticated, pass-through for unmatched paths.
 *
 * Mocks the Supabase SSR client to control auth state.
 */

import { NextRequest } from "next/server";

// Mock the Supabase SSR module
let mockUser: { id: string; email: string } | null = null;

jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: mockUser ? null : { message: "not authenticated" },
      }),
    },
  }),
}));

// Import after mock is set up
import { proxy as middleware } from "@/proxy";

function makeRequest(pathname: string): NextRequest {
  const url = `http://localhost:3000${pathname}`;
  return new NextRequest(url);
}

function setAuthenticated(authenticated: boolean) {
  mockUser = authenticated
    ? { id: "uuid-123", email: "test@example.com" }
    : null;
}

beforeEach(() => {
  mockUser = null;
});

// ─── Protected routes without session ────────────────────────────────────────

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

  test.each(protectedPaths)("redirects %s to /login", async (path) => {
    setAuthenticated(false);
    const req = makeRequest(path);
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("includes callbackUrl in redirect for protected path", async () => {
    setAuthenticated(false);
    const req = makeRequest("/dashboard");
    const res = await middleware(req);

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("callbackUrl=%2Fdashboard");
  });
});

// ─── Protected routes with session ───────────────────────────────────────────

describe("middleware — authenticated access to protected routes", () => {
  it("passes through /dashboard when session present", async () => {
    setAuthenticated(true);
    const req = makeRequest("/dashboard");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });

  it("passes through /profile when session present", async () => {
    setAuthenticated(true);
    const req = makeRequest("/profile");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });
});

// ─── Public routes with session (already authenticated) ──────────────────────

describe("middleware — authenticated access to public routes", () => {
  it("redirects /login to /dashboard when session present", async () => {
    setAuthenticated(true);
    const req = makeRequest("/login");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects /register to /dashboard when session present", async () => {
    setAuthenticated(true);
    const req = makeRequest("/register");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });
});

// ─── Public routes without session ───────────────────────────────────────────

describe("middleware — unauthenticated access to public routes", () => {
  it("passes through /login without session", async () => {
    setAuthenticated(false);
    const req = makeRequest("/login");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });

  it("passes through /register without session", async () => {
    setAuthenticated(false);
    const req = makeRequest("/register");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });
});

// ─── Root path ───────────────────────────────────────────────────────────────

describe("middleware — root path", () => {
  it("redirects / to /login without session", async () => {
    setAuthenticated(false);
    const req = makeRequest("/");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects / to /dashboard with session", async () => {
    setAuthenticated(true);
    const req = makeRequest("/");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("passes through unknown path /foobar without session", async () => {
    setAuthenticated(false);
    const req = makeRequest("/foobar");
    const res = await middleware(req);

    expect(res.status).toBe(200);
  });
});
