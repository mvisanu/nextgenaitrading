/**
 * lib/auth-errors.ts
 *
 * Translates Supabase auth errors into plain language.
 *
 * Supabase surfaces raw GoTrue strings ("Invalid login credentials",
 * "AuthApiError: ...") which are unhelpful and occasionally leak
 * implementation detail. Every auth screen renders the output of
 * mapAuthError() and never the raw error object.
 */

/** Message shown when we genuinely have no idea what went wrong. */
const FALLBACK = "Something went wrong. Please try again.";

/**
 * Ordered list — first match wins, so put specific patterns before
 * general ones.
 */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /invalid login credentials|invalid email or password/i,
    "That email or password isn't right.",
  ],
  [
    /email not confirmed|not confirmed/i,
    "Please confirm your email first — check your inbox for the link.",
  ],
  [
    /user already registered|already registered|already been registered/i,
    "An account with that email already exists. Try signing in instead.",
  ],
  [
    /password should be at least|password is too short/i,
    "That password is too short.",
  ],
  [
    /weak password|password is too weak/i,
    "Please choose a stronger password.",
  ],
  [
    /for security purposes|only request this after|rate limit|too many requests/i,
    "Too many attempts. Please wait a minute and try again.",
  ],
  [
    /email address .* is invalid|unable to validate email|invalid email/i,
    "That email address doesn't look valid.",
  ],
  [
    /token has expired|expired or is invalid|otp_expired|link is invalid/i,
    "That link has expired. Please request a new one.",
  ],
  [
    /same password|should be different from the old password/i,
    "Your new password must be different from your current one.",
  ],
  [
    /user not found/i,
    "We couldn't find an account with that email.",
  ],
  [
    /signups not allowed|signup is disabled/i,
    "New sign-ups are currently disabled.",
  ],
  // Network / outage cases. Supabase throws a bare TypeError("Failed to
  // fetch") when the project host is unreachable (paused or deleted).
  [
    /failed to fetch|networkerror|network request failed|err_name_not_resolved/i,
    "Can't reach the server. Check your connection and try again.",
  ],
  [
    /not configured/i,
    "Sign-in isn't configured on this environment yet.",
  ],
];

/**
 * Convert any thrown value into a user-facing sentence.
 *
 * Accepts unknown (not Error) because Supabase and fetch both throw
 * non-Error values in some paths.
 */
export function mapAuthError(err: unknown): string {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "";

  if (!raw.trim()) return FALLBACK;

  for (const [pattern, message] of RULES) {
    if (pattern.test(raw)) return message;
  }

  return FALLBACK;
}
