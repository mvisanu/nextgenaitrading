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
];

/**
 * Auth routes: authenticated users should be redirected to /dashboard.
 */
const AUTH_ROUTES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasToken = request.cookies.has("access_token");

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
