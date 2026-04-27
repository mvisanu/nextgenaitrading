# Authentication Architecture

## Overview

NextGenStock uses **Supabase Auth** with **magic links** (passwordless, email-only).
No passwords are stored or transmitted. JWT tokens are managed by Supabase.

## Login Flow

1. User enters their email on `/login` or `/register`
2. Frontend calls `supabase.auth.signInWithOtp({ email })` with a redirect URL
3. Supabase sends a magic link to the user's email
4. User clicks the link, which redirects to `/auth/callback?code=...`
5. The callback route handler exchanges the code for a Supabase session
6. User is redirected to `/dashboard`

## Session Management

- **Supabase manages tokens** — access token + refresh token handled by `@supabase/ssr`
- **No cookies for auth** — middleware uses `@supabase/ssr` server client to check session
- **Auto token refresh** — Supabase SDK automatically refreshes expired access tokens
- **Backend auth** — API calls include `Authorization: Bearer <supabase_access_token>` header

## Backend JWT Verification

The FastAPI backend verifies Supabase-issued JWTs on every protected route:

1. Reads `Authorization: Bearer <token>` header
2. Decodes JWT using `SUPABASE_JWT_SECRET` (HS256)
3. Extracts `email` from token payload
4. Looks up user in local DB by email
5. **Auto-provisions** new users on first API call (no separate registration needed)

## Route Protection

- **Frontend middleware** (`proxy.ts`): Uses Supabase server client to check session on every request
- **Protected routes**: `/dashboard`, `/strategies`, `/backtests`, `/live-trading`, `/artifacts`, `/profile`, `/opportunities`, `/ideas`, `/alerts`, `/auto-buy`, `/screener`, `/trade-log`
- **Auth routes**: `/login`, `/register` redirect to `/dashboard` if already authenticated

## Environment Variables

### Frontend (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Backend (`.env`)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Manual Setup Steps

1. **Enable magic links** in Supabase Dashboard:
   - Go to Authentication > Providers > Email
   - Enable "Magic Link" sign-in method
   - Optionally disable "Email/Password" if you want magic-link only

2. **Configure redirect URLs** in Supabase Dashboard:
   - Go to Authentication > URL Configuration
   - Add `http://localhost:3000/auth/callback` to Redirect URLs (dev)
   - Add your production URL (e.g., `https://your-app.vercel.app/auth/callback`)

3. **Get your JWT secret**:
   - Go to Project Settings > API
   - Copy the JWT Secret and set it as `SUPABASE_JWT_SECRET` in your backend `.env`

4. **Set environment variables** in your frontend `.env.local` and backend `.env`

## Files Changed

| File | Change |
|------|--------|
| `frontend/lib/supabase.ts` | NEW: Supabase browser client singleton |
| `frontend/app/(auth)/login/page.tsx` | Replaced password login with magic link (signInWithOtp) |
| `frontend/app/(auth)/register/page.tsx` | Replaced password registration with magic link |
| `frontend/app/auth/callback/route.ts` | NEW: Auth callback to exchange code for session |
| `frontend/proxy.ts` | Updated middleware to use Supabase SSR session detection |
| `frontend/lib/auth.ts` | Replaced backend /auth/me call with Supabase getUser() |
| `frontend/lib/api.ts` | Replaced cookie-based auth with Bearer token from Supabase |
| `frontend/types/index.ts` | Updated UserResponse.id to `number | string` (Supabase UUIDs) |
| `frontend/components/layout/AppShell.tsx` | Updated logout to use Supabase signOut() |
| `backend/app/auth/dependencies.py` | Replaced cookie-based JWT with Bearer token + Supabase JWT verification |
| `backend/app/core/config.py` | Added Supabase env vars (URL, anon key, JWT secret, service role key) |
| `backend/.env` | Added Supabase environment variable placeholders |
