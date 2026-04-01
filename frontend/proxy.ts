import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  "/portfolio",
  "/options",
  "/gold",
  "/multi-chart",
  "/stock",
];

/**
 * Auth routes: authenticated users should be redirected to /dashboard.
 */
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Create a Supabase server client to refresh the session if needed
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  let user = null;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    // Refresh the session — this also refreshes expired tokens
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  // Also accept dev_token cookie (set via /test/token dev login)
  const devToken = request.cookies.get("dev_token")?.value;
  const hasSession = !!user || !!devToken;

  // Redirect authenticated users away from auth pages
  if (
    hasSession &&
    AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (
    !hasSession &&
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    )
  ) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Root redirect: / -> /dashboard (authenticated) or /login (unauthenticated)
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(hasSession ? "/dashboard" : "/login", request.url)
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
