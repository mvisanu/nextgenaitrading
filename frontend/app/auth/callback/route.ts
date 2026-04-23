/**
 * Auth callback route handler.
 *
 * After the user clicks the magic link in their email, Supabase redirects
 * them to this route with a `code` query parameter. We exchange that code
 * for a session, then redirect to /pin-setup (which handles the has-PIN
 * check and either shows the setup form or bounces to the dashboard).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Redirect to pin-setup, passing the original next destination through
    const pinSetupUrl = new URL("/pin-setup", origin);
    pinSetupUrl.searchParams.set("next", next);
    // response is created BEFORE exchangeCodeForSession so the setAll cookie
    // handler can mutate it in-place. Per @supabase/ssr pattern — do not reorder.
    const response = NextResponse.redirect(pinSetupUrl);

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
