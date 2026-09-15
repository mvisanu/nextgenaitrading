# Status — 2026-07-31

## Blocker B (Supabase) is RESOLVED. Blocker A (Render) is still open.

### Blocker B — RESOLVED 2026-07-31
`mhdeczgappgbazxjnyaf.supabase.co` now resolves (Cloudflare) and GoTrue answers.
Verified live against the project:

| Check | Result |
|---|---|
| `GET /auth/v1/health` | 401 (alive; needs apikey) |
| `GET /auth/v1/settings` | 200 · `disable_signup: false` · **`mailer_autoconfirm: false`** |
| `POST /auth/v1/signup` | **200** · `confirmation_sent_at` set · no session |
| Sign in before confirming | 400 `email_not_confirmed` |
| Sign in, wrong password | 400 `invalid_credentials` |
| Duplicate signup | 200 with `identities: []` (no error — enumeration guard) |

A throwaway user was created for this test and then deleted via the admin API.

**Open decision — email confirmation.** `mailer_autoconfirm: false` means every new
account must click an emailed link before it can sign in. Supabase's *built-in* SMTP only
delivers to project team members and is rate-limited to a couple of messages an hour, so
if custom SMTP is not configured, real users will never receive the confirmation and
registration will look broken again. Either:
1. turn **Confirm email** OFF in Auth → Providers → Email (signup then returns a session
   and the app goes straight to the dashboard — matches the old pre-confirmed behaviour), or
2. configure custom SMTP (Resend/SendGrid/Postmark).

The frontend already handles both cases with no code change.

### Blocker A — the Render service is SUSPENDED (still open, re-confirmed 2026-07-31)
Every path on `nextgenaitrading.onrender.com` returns **503**, including unknown paths
such as `/health` (which would be a 404 if our app were running). The response carries:

```
x-render-routing: suspend-by-user
Server: cloudflare
```

The request **never reaches FastAPI**. Resume the service in the Render dashboard
(Settings → Resume), or clear whatever billing/free-tier condition suspended it.

**The browser CORS errors are a symptom of this, not a separate bug.** Render's edge 503
is a bare HTML page with no `Access-Control-Allow-Origin` header, so the browser reports
the preflight as a CORS failure. `CORS_ORIGINS` is configured correctly — changing it
will do nothing. The CORS errors will disappear on their own once the service is running.

Local `main` == `origin/main` (`363754b`), so resuming redeploys the fixed backend below.

### Blocker B — original diagnosis (kept for history; now fixed, see above)
The Supabase project **`mhdeczgappgbazxjnyaf`** did not exist in DNS. Verified via
Google's resolver over DoH: **NXDOMAIN on A, AAAA and CNAME**, while `supabase.com`
resolves normally. A paused project still shows its Project URL in the dashboard, so
seeing the URL there does **not** mean it is running — the restore has not taken effect.

Until that project is genuinely restored (or replaced), **login and registration cannot
work**, because:
- password login goes **browser → Supabase directly** (the backend is not involved), and
- `POST /auth/register` calls the **Supabase admin API**.

### What was actually broken in *our* code (all fixed + verified in Docker)
The Supabase outage exposed four real defects that turned a dependency outage into a
total, undiagnosable blackout:

1. **`start.sh` crash-loop (the blackout).** `set -e` + a failing `alembic upgrade head`
   meant uvicorn never started, so Render returned **502 for every route** — including
   the DB-free `/healthz` and `/auth/register`, which would otherwise have kept working.
   → Migrations now retry, and the API **always boots**. A dead database degrades the
   service instead of blacking it out.

2. **`migrate_fix.py` could never bootstrap a fresh database.** On a DB with no
   `alembic_version` table it raised `UndefinedTableError` and exited non-zero — which,
   under the old `set -e`, crash-looped forever. **This was a landmine directly in the
   recovery path: a brand-new Supabase project would never have come up.**
   → Absent version table is now treated as "fresh DB; alembic will create it".

3. **`get_db()` yielded twice.** Its retry loop caught an `OSError` thrown *into* the
   generator at the `yield` point and then yielded again, producing
   `RuntimeError: generator didn't stop after athrow()` — masking every transient DB
   error behind a confusing 500.
   → Yields exactly once; connection failures become a clean **503** (pool disposed so
   the next request reconnects). Connection is still acquired lazily, so requests that
   never query don't burn a slot from the 2+3 pool.

4. **Unguarded Supabase HTTP calls → opaque 500s.** `password_auth.register` and
   `pin_auth._supabase_generate_token` did not catch `httpx.RequestError`, so a paused
   Supabase produced *"Internal server error"*. **This is exactly what a user clicking
   "Create account" on the live site got.**
   → Now a clear **503** ("temporarily unavailable"), with CORS headers intact.

Also added: `/readyz` readiness probe (503 while the DB is down; `/healthz` stays
liveness-only so Render keeps the service routable), background migration self-healing,
scheduler held back while degraded, and a `.gitattributes` pinning `*.sh` to LF so a
Windows CRLF save can't break the Linux container.

### Verified (Docker — the same image Render builds)
- **Degraded** (DB + Supabase unreachable): `/healthz` 200 · `/readyz` 503 ·
  `/auth/register` 503 · `/auth/pin-login` 503 (with CORS) · container stays **healthy** ·
  zero unhandled exceptions. Previously: container dead, everything 502.
- **Fresh-DB bootstrap**: 38 tables created, alembic head `v11_unforce_rls`.
- **Self-heal**: started with the DB down, brought the DB up → migrations applied and
  `/readyz` flipped to 200 in ~20s **with no redeploy or restart**; scheduler started.
- **Healthy**: `/healthz` ok · `/readyz` ready · DB queries fine · scheduler up.
- **Tests: 723 passing** (v2–v6, v9, auth, gold, password-auth).

## Still required — only you can do these
0. **Render**: resume the suspended service (Blocker A). Until this is done, *every*
   backend route is a 503 from Render's edge and every browser call looks like a CORS
   error. Verify with: `curl -i https://nextgenaitrading.onrender.com/healthz` — the
   `x-render-routing: suspend-by-user` header must be gone.
1. ~~**Supabase**: restore the project.~~ **Done** — verified live 2026-07-31.
2. **Decide on email confirmation** (see Blocker B above): either turn Confirm email OFF,
   or configure custom SMTP. Without one of these, confirmation emails will not reach
   real users and registration will appear broken even though the API returns 200.
3. **Deploy**: push these commits so Render rebuilds. After deploy, `/healthz` should
   return **200 `degraded`** instead of 502 even while the DB is down.
4. Then the full live smoke test (register → confirm → sign in → protected route) can run
   end to end in the browser.

## Frontend auth rebuild (branch `feat/auth-ui-rebuild`, 2026-07-31)
`/login` was rebuilt to one primary path (email+password) plus an in-place magic-link
swap; PIN and access-code UI deleted; `/forgot-password` and `/reset-password` added.
`/register` now calls `supabase.auth.signUp` directly instead of the backend, so account
creation no longer depends on Render being up. See
`docs/superpowers/plans/2026-07-31-auth-ui-rebuild.md`. Six commits, not yet pushed.

## Notes
- `CLAUDE.md` documents `backend/tests/v7/` (wheel bot), but that directory does not
  exist in the repo — docs/test gap, not a runtime bug.
