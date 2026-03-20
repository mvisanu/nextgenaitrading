import { NextRequest, NextResponse } from "next/server";

/**
 * Route protection middleware.
 *
 * Checks for the presence of the `access_token` cookie (set by the FastAPI
 * backend). If a protected route is accessed without the cookie, the user is
 * redirected to /login with a callbackUrl parameter.
 *
 * Note: The middleware only checks cookie presence, not validity. The backend
 * validates the JWT on every protected API call and returns 401 when expired,
 * triggering the silent-refresh flow in lib/api.ts.
 */

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/strategies",
  "/backtests",
  "/live-trading",
  "/artifacts",
  "/profile",
];

const PUBLIC_PATHS = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const isPublic = PUBLIC_PATHS.includes(pathname);

  const hasToken = request.cookies.has("access_token");

  // Redirect unauthenticated users away from protected routes
  if (isProtected && !hasToken) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/register to dashboard
  if (isPublic && hasToken) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
