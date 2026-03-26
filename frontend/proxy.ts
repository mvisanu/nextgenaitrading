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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies for downstream server components
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          // Update response cookies so they're sent back to the browser
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh the session — this also refreshes expired tokens
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hasSession = !!user;

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
