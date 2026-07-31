/**
 * Auth callback route handler.
 *
 * Supabase redirects here with a `code` after the user clicks a magic
 * link, a signup confirmation, or a password-recovery link. We exchange
 * the code for a session and forward to `next`.
 *
 * `next` used to be hard-coded to /pin-setup; that page is gone, so the
 * caller now chooses the destination (/reset-password for recovery,
 * /dashboard otherwise).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/** Only allow same-origin relative paths — never an attacker-supplied URL. */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    // The response is created BEFORE exchangeCodeForSession so the setAll
    // cookie handler can mutate it in place. Per @supabase/ssr — do not reorder.
    const response = NextResponse.redirect(new URL(next, origin));

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=auth_callback_failed", origin)
  );
}
