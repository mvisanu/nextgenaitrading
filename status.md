# Status — 2026-07-09

## Password login (V10) — implemented, primary login method
- **Why:** magic-link + PIN flow was chronically unreliable on the live site (session/token races on /pin-setup, email dependency). User requested username+password login.
- **Register:** `/register` page now takes email + password + confirm → `POST /auth/register` (new `backend/app/api/password_auth.py`) → creates a **confirmed** Supabase user via the admin API (`email_confirm: true`) → **no confirmation email at all** → frontend immediately `signInWithPassword` → dashboard.
- **Login:** `/login` page default mode is now `password` (email + password → `supabase.auth.signInWithPassword`). Magic link, PIN, and access-code remain as secondary options behind the primary form. Honors `callbackUrl`.
- **Existing accounts** (created via magic link, no password yet): sign in once via PIN / access code / magic link → **Profile → Security → "Login Password"** → sets password via `supabase.auth.updateUser({ password })` (pure client-side; no backend change needed).
- Duplicate-email registration → 409 with a message pointing at sign-in + Profile password setup (prevents account takeover via re-register).

## Verified
- `backend/tests/test_password_auth.py` — 8 passed (validation, success, duplicate 409, weak-password 400, upstream 502, unconfigured 503).
- Frontend `npm run build` — clean, all pages compile.
- Endpoint behavior exercised against a mocked Supabase admin API (201/409/502 paths).

## Pending
- Deploy to Render + Vercel (push to main), then live smoke test: create a fresh account with a password and sign in with it.
- No new DB migration in this change — deploy risk is low.
- backend/.env is not readable by tooling (permission denied) — no env changes are needed for this feature anyway (uses existing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, already required by PIN login).
