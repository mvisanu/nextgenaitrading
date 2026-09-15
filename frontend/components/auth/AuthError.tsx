/**
 * The single error presentation used by every auth screen.
 *
 * Always fed by mapAuthError() — never a raw Supabase error object.
 */

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="text-xs text-destructive bg-destructive/5 border border-destructive/20 p-2 rounded-sm"
    >
      {message}
    </p>
  );
}

/** Positive counterpart, e.g. "Check your email". */
export function AuthNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="text-xs text-primary bg-primary/5 border border-primary/20 p-2 rounded-sm"
    >
      {message}
    </p>
  );
}
