import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routes that require authentication.
 * Unauthenticated access redirects to /login with a callbackUrl query param.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/strategies",
  "/backtests",
  "/live-trading",
  "/artifacts",
  "/profile",
  "/opportunities",
  "/ideas",
  "/alerts",
  "/auto-buy",
  "/screener",
  "/trade-log",
];

/**
 * Auth routes: authenticated users should be redirected to /dashboard.
 */
const AUTH_ROUTES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth: either the httponly access_token (same-origin deployment)
  // or the lightweight auth_session marker (cross-origin deployment where
  // the httponly cookie is on a different domain and invisible to middleware).
  const hasToken = request.cookies.has("access_token") || request.cookies.has("auth_session");

  // Redirect authenticated users away from auth pages
  if (hasToken && AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (!hasToken && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root redirect: / → /dashboard (authenticated) or /login (unauthenticated)
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasToken ? "/dashboard" : "/login", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
