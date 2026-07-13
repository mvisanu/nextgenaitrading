# Status — 2026-07-13

## Production (Render) — backend bugs fixed; still blocked on Supabase

### Root cause of the outage (external, NOT a code bug)
The Supabase project **`mhdeczgappgbazxjnyaf`** does not exist in DNS. Verified via
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
1. **Supabase**: the project is not reachable. In the dashboard confirm its *status badge*
   (Paused / Restoring / Active), not just its URL. If it will not restore, create a new
   project and update `SUPABASE_URL` / keys on Render + Vercel (`NEXT_PUBLIC_*`) and
   `DATABASE_URL` on Render. Fresh-DB bootstrap now works, so a new project will come up
   clean.
2. **Deploy**: push these commits so Render rebuilds. After deploy, `/healthz` should
   return **200 `degraded`** instead of 502 even while Supabase is down.
3. Then the live smoke test (register + password login) can finally run.

## Notes
- `CLAUDE.md` documents `backend/tests/v7/` (wheel bot), but that directory does not
  exist in the repo — docs/test gap, not a runtime bug.
