/**
 * lib/navigate.ts
 *
 * Full-page navigation helper for post-auth redirects.
 *
 * Auth transitions deliberately use a hard navigation rather than the
 * Next router: Supabase has just written new session cookies, and a full
 * request is what makes the middleware (proxy.ts) re-read them and treat
 * the user as signed in. A client-side router.push() can render the
 * destination before the middleware has ever seen the new cookies.
 *
 * It also gives tests a seam — jsdom does not allow window.location to be
 * redefined, so this module is mocked instead.
 */

export function hardNavigate(url: string): void {
  window.location.href = url;
}

/**
 * Resolve a post-login destination, rejecting anything that could be an
 * open redirect (absolute URLs, protocol-relative "//evil.com").
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return fallback;
  }
  return raw;
}
