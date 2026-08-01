# Auth UI Rebuild Implementation Plan

**Goal:** Replace the five-path debug-looking `/login` with one primary path (email+password), one secondary path (magic link, swapped in place), and delete PIN / access-code UI entirely.

**Architecture:** A shared `AuthCard` shell plus small field primitives give `/login`, `/register`, `/forgot-password` and `/reset-password` identical chrome. All Supabase calls stay in client components using `@supabase/ssr`'s `createBrowserClient` (the anon key is public by design; no secrets move client-side). A single `mapAuthError` translates Supabase messages to plain language.

**Tech Stack:** Next.js 15 App Router, React 19, `@supabase/ssr` 0.9, react-hook-form + zod, Tailwind (existing tokens), lucide-react, sonner.

## Global Constraints

- Do not modify database schema or RLS policies.
- Do not touch trading/portfolio code.
- No new design system — reuse existing tokens: `bg-background`, `bg-surface-low`, `bg-surface-lowest`, `border-border/10`, `text-foreground`, `text-muted-foreground`, `text-primary`, `text-3xs`, `text-2xs`, `rounded-sm`, `text-destructive`.
- Dev login renders only when `process.env.NEXT_PUBLIC_ENV === "development"`.
- `@supabase/ssr` only — no deprecated `auth-helpers` packages.
- Never render a raw Supabase error object.

---

## Audit findings (Step 1 of login.md)

**Auth entry points found**
| File | Role |
|---|---|
| `app/(auth)/login/page.tsx` | 5 paths: password, magic link, PIN, access code, dev login |
| `app/(auth)/register/page.tsx` | backend `/auth/register` then `signInWithPassword` |
| `app/(auth)/pin-setup/page.tsx` | PIN capture after magic-link callback |
| `app/auth/callback/route.ts` | `exchangeCodeForSession` → redirects to `/pin-setup` |
| `proxy.ts` | Next 15 middleware: `getUser()` session refresh + route guards |
| `lib/supabase.ts` | `createBrowserClient` singleton, null when unconfigured |
| `lib/pin-auth-api.ts` | `register`, `login` (PIN), `codeLogin`, `setPin`, `hasPin` |
| `lib/api.ts`, `lib/options-api.ts`, `lib/market-stream.ts` | read session / `dev_token` cookie |
| `app/profile/page.tsx:909` | `updateUser({ password })` — unrelated, leave alone |

**Supabase calls:** `signInWithPassword` (login, register), `signInWithOtp` (login), `verifyOtp` (PIN + code login), `exchangeCodeForSession` (callback), `getUser`/`getSession` (proxy, api, pin-setup), `signOut` (api), `updateUser` (profile).

**Nothing outside the auth pages depends on PIN or access code.** `dev_token` IS depended on by `lib/api.ts` and `lib/options-api.ts`, so dev login stays (gated).

**Missing:** no `/forgot-password`, no `/reset-password`.

---

## Task 1: Error mapping + shared auth chrome

**Files:**
- Create: `lib/auth-errors.ts`, `components/auth/AuthCard.tsx`, `components/auth/AuthError.tsx`, `components/auth/AuthField.tsx`, `components/auth/SubmitButton.tsx`
- Test: `__tests__/lib/auth-errors.test.ts`

**Produces:** `mapAuthError(err: unknown): string`, `<AuthCard title children footer>`, `<AuthError message>`, `<AuthField id label type ...>`, `<PasswordField>` (show/hide), `<SubmitButton pending label>`.

- [ ] Write `__tests__/lib/auth-errors.test.ts` asserting `"Invalid login credentials"` → `"That email or password isn't right."`
- [ ] Run it, watch it fail
- [ ] Implement `mapAuthError` + components
- [ ] Run tests, green
- [ ] Commit

## Task 2: Rebuild /login

**Files:** Modify `app/(auth)/login/page.tsx`; Test `__tests__/app/(auth)/login.test.tsx`

Password form + "Email me a sign-in link instead" (swaps form in place, with "Back to password sign-in") + "Forgot password?" + footer to `/register`. Dev button only under `NEXT_PUBLIC_ENV === "development"`. Delete `PinPad`, PIN mode, code mode.

- [ ] Rewrite test to match new UI
- [ ] Run, fail
- [ ] Rewrite page
- [ ] Run, pass
- [ ] Commit

## Task 3: Rebuild /register

**Files:** Modify `app/(auth)/register/page.tsx`; Test `__tests__/app/(auth)/register.test.tsx`

Switch from backend `/auth/register` to `supabase.auth.signUp` — removes the Render backend dependency that currently 503s. If `data.session` returned (confirmation disabled) → `/dashboard`; else show inline "check your email" state on the same page. Live password-rule checklist.

- [ ] Rewrite test; run; fail; implement; pass; commit

## Task 4: /forgot-password + /reset-password

**Files:** Create `app/(auth)/forgot-password/page.tsx`, `app/(auth)/reset-password/page.tsx`

`resetPasswordForEmail(email, { redirectTo: origin + "/auth/callback?next=/reset-password" })`; reset page uses `updateUser({ password })`.

- [ ] Implement both; commit

## Task 5: Callback + middleware + PIN removal

**Files:** Modify `app/auth/callback/route.ts`, `proxy.ts`; Delete `app/(auth)/pin-setup/page.tsx`; Modify `lib/pin-auth-api.ts`

Callback honours `next` instead of hard-coding `/pin-setup`. `proxy.ts`: drop `/pin-setup`, add `/forgot-password` to auth routes; `/reset-password` must NOT be in AUTH_ROUTES (a recovery session is authenticated and must reach it). Strip `login`/`codeLogin`/`setPin`/`hasPin` from the client API module; backend endpoints untouched.

- [ ] Implement; run full suite; commit

## Task 6: Verify

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npx jest`
- [ ] Confirm no dev button when `NEXT_PUBLIC_ENV` unset
