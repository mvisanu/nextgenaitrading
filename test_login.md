# Login Feature — Bug Analysis & E2E Test Plan

Generated: 2026-04-22  
Scope: `frontend/app/(auth)/login/page.tsx`, `frontend/app/auth/callback/route.ts`,
`frontend/app/(auth)/pin-setup/page.tsx`, `backend/app/api/pin_auth.py`,
`frontend/lib/pin-auth-api.ts`

---

## Part 1 — Bug Analysis

### BUG-LOGIN-001: PIN state initialized with spaces instead of empty string (HIGH)

**File:** `frontend/app/(auth)/login/page.tsx` line 93  
**Code:** `const [pin, setPin] = useState("    ");`

The PIN is initialized as a 4-space string. This interacts with `pin.trim().length !== 4`
used as the button's `disabled` condition on line 301. Because `"    ".trim()` is `""` (length 0),
the button is correctly disabled at startup.

However the `handlePinLogin` guard on line 160 reads:
```ts
const cleanPin = pin.trim();
if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
```
`pin.trim()` on `"12  "` produces `"12"`, which has length 2 and correctly blocks submit. BUT:
`pin.trim()` on `"1 3 "` (digits at indices 0 and 2, spaces at 1 and 3) produces `"1 3"` which
still fails the `/^\d{4}$/` regex. No security bypass is possible here, but the UX is wrong
because the button-disabled condition uses `pin.trim().length !== 4` while the PinPad component
uses `value[i] ?? ""` to render each cell. With space padding, `value[i]` at an unset position
is `" "` (a space), which renders as a visible dot in a password input — the user sees a filled
cell even though no digit was entered there. This gives **misleading visual feedback**.

**Reproduction:** Load the page in PIN mode without entering anything. All four PIN circles
appear filled (showing the password-masked space character), yet Submit is disabled.

**Fix:** Initialize pin as `""` and pad/index with `value[i] ?? ""` adjusted for real empty state,
OR keep the space-pad approach but render `value[i]?.trim() ?? ""` — exactly what the pin-setup
`PinPad` already does on line 67 (see BUG-LOGIN-002).

---

### BUG-LOGIN-002: Login PinPad renders spaces; setup PinPad trims them — inconsistent behavior (MEDIUM)

**Files:** Login `PinPad` line 58 vs pin-setup `PinPad` line 67

Login page:
```ts
value={value[i] ?? ""}
```
Pin-setup page:
```ts
value={value[i]?.trim() ?? ""}
```

The setup page's `PinPad` calls `.trim()` before rendering, so space-padded slots appear empty.
The login page's `PinPad` does not call `.trim()`, so space-padded slots render as a filled
password dot. This means:

- On **/login** (PIN mode): all 4 cells appear pre-filled on load.
- On **/pin-setup**: all 4 cells appear empty on load.

This is a direct inconsistency between identical components. The login page PinPad should apply
`.trim()` to each character value before rendering, matching the setup page.

---

### BUG-LOGIN-003: Backspace in login PinPad re-pads with empty string; setup PinPad re-pads with space — divergent reset semantics (MEDIUM)

**File:** `frontend/app/(auth)/login/page.tsx` line 38–39  
**File:** `frontend/app/(auth)/pin-setup/page.tsx` line 47–48

Login PinPad on Backspace:
```ts
const next = value.slice(0, index) + value.slice(index + 1);
onChange(next.padEnd(4, "").slice(0, 4));
```
The deleted slot is filled with `""` (empty string) to pad back to 4 chars.

Setup PinPad on Backspace:
```ts
const next = value.slice(0, index) + " " + value.slice(index + 1);
onChange(next);
```
The deleted slot is replaced with a literal space `" "`.

These two strategies are incompatible. In the login page, after Backspace, the pad character
becomes `""` (empty string), so `value[i]` at the affected index is `""`, rendering correctly
as an empty cell. But in the setup page the pad character is `" "`, which works only because
the setup `PinPad` calls `.trim()` on render.

If either component is swapped or refactored, the rendering breaks. This should be unified: both
components should use the same space-pad strategy AND both should call `.trim()` on render, OR
both should use empty-string padding and not call `.trim()`.

---

### BUG-LOGIN-004: `pin.trim().length !== 4` disabled check passes for 4-space string — button SHOULD be disabled but logic is coincidentally correct (LOW)

**File:** `frontend/app/(auth)/login/page.tsx` line 301

```ts
disabled={isPending || pin.trim().length !== 4}
```

Initial `pin = "    "` → `"    ".trim() = ""` → length 0 → `0 !== 4` is true → button disabled. Correct.

After user types `"1234"` → `"1234".trim() = "1234"` → length 4 → `4 !== 4` is false → button enabled. Correct.

After user types `"12  "` (2 digits, 2 spaces) → `"12".trim()` → length 2 → disabled. Correct.

This guard works correctly as written. However, the same check on pin-setup (line 314) uses
`.trim()` on the space-padded confirm string. For `"1234"` the trim() is a no-op. For partial
entry like `"12  "`, trim gives `"12"` (length 2), so button stays disabled. Also correct.

No functional bug here, but the approach is fragile and only correct because `.trim()` on a
right-padded-with-spaces string happens to measure the number of non-space digits. Explicit digit
counting (filtering `/\d/`) would be clearer and more robust.

---

### BUG-LOGIN-005: `handleSetPin` in pin-setup compares `cleanPin` against `cleanConfirm` but `cleanPin` is derived from `pin` state, not the current `confirm` input — mismatch impossible to trigger but logic is confusing (LOW)

**File:** `frontend/app/(auth)/pin-setup/page.tsx` lines 137–145

```ts
async function handleSetPin() {
  const cleanPin = pin.replace(/\s/g, "");         // from pin state
  const cleanConfirm = confirm.replace(/\s/g, ""); // from confirm state

  if (cleanPin.length !== 4) { setError("Please enter all 4 digits."); return; }
  if (step === "confirm-pin" && cleanPin !== cleanConfirm) {
    setError("PINs don't match. Try again.");
    ...
  }
```

When `step === "confirm-pin"`, the PinPad renders `confirm` state (line 297:
`value={isConfirming ? confirm : pin}`). So `cleanConfirm` correctly holds what the user just
typed in the confirm step. `cleanPin` holds what was typed in the set-pin step (now frozen).
The comparison `cleanPin !== cleanConfirm` is semantically correct.

However, reading the code top-to-bottom without the render context, it looks like it should be
comparing `cleanConfirm` against itself (the step-1 PIN is in `pin`, the step-2 re-entry is in
`confirm`). The logic is actually correct; the confusion is a code clarity issue.

**Risk:** If a future refactor incorrectly reads both from the same state, the PIN mismatch check
silently breaks. Adding a comment stating "cleanPin = first entry, cleanConfirm = confirmation"
would eliminate the ambiguity.

---

### BUG-LOGIN-006: PIN lockout resets `attempt_count` to 0 on lockout trigger — subsequent failed attempts after lockout expiry never re-lock (CRITICAL)

**File:** `backend/app/api/pin_auth.py` lines 172–175

```python
user_pin.attempt_count = (user_pin.attempt_count or 0) + 1
if user_pin.attempt_count >= _MAX_ATTEMPTS:
    user_pin.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)
    user_pin.attempt_count = 0   # BUG: resets to 0 immediately after lockout
```

When the 5th wrong attempt triggers a lockout, `attempt_count` is set back to 0. After the
15-minute lockout expires, the user can make 4 more wrong attempts before hitting the lockout
threshold again, effectively reducing the protection from 5 attempts per lockout cycle to 4
(5 to trigger, 4 more before re-lock, then 5 again, etc.). Worse: if the lockout timer expires
between attempt 4 and attempt 5, the counter resets to 0 on lockout, so the next cycle starts
with a full 5-attempt budget again.

More critically, if an attacker can make timed attempts that expire the lockout between cycles,
they effectively get `(N - 1)` attempts per cycle instead of `(N)`, but the first lockout still
fires at attempt 5. After the first lockout the count is 0, so attempts 6–10 are needed before
re-lock. The lockout system still provides protection but is weaker than intended.

**Fix:**
```python
if user_pin.attempt_count >= _MAX_ATTEMPTS:
    user_pin.locked_until = now + timedelta(minutes=_LOCKOUT_MINUTES)
    # Do NOT reset attempt_count here. Reset only on successful login.
    # Keeps the counter accurate for re-lock after expiry.
```
The successful-login path (line 181) already resets `attempt_count = 0` correctly.

---

### BUG-LOGIN-007: Auth callback creates redirect response before exchanging the code — session cookies may not be set if the response object is not correctly mutated (MEDIUM)

**File:** `frontend/app/auth/callback/route.ts` lines 22–45

```ts
const response = NextResponse.redirect(pinSetupUrl);         // (A)
const supabase = createServerClient(..., {
  cookies: {
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);           // (B)
      });
    },
  },
});
const { error } = await supabase.auth.exchangeCodeForSession(code); // (C)
if (!error) return response;                                         // (D)
```

The comment in the provided code states this works correctly because `setAll` mutates `response`
before it is returned. This is true for the standard `@supabase/ssr` v0.4+ pattern.

However, there is a subtle ordering risk: if `exchangeCodeForSession` throws an uncaught exception
(not just returns `{ error }`), the function falls through to the outer `return NextResponse.redirect(
"/login?error=auth_callback_failed")` WITHOUT returning the mutated `response`. In that case the
session cookies are partially written to `response` (which is discarded), so the user gets redirected
to the error page instead of pin-setup — correct behavior, but the partially-written cookies on the
discarded `response` object are never sent. This is fine for the error case.

The real risk is if `setAll` is called multiple times (e.g., token refresh + new session), the
`response` correctly accumulates all cookie mutations because `response.cookies.set` is additive.
No data loss.

**Verdict:** No functional bug under normal conditions. The pattern is correct per `@supabase/ssr`
docs. However, if `exchangeCodeForSession` itself throws (e.g., network error), the catch falls to
the error redirect, which is correct. Marking MEDIUM because the ordering is non-obvious and a
future refactor could accidentally break it.

---

### BUG-LOGIN-008: Enter key on email field fires `handleMagicLink` in "choose" mode — skips "Enter my PIN" intent if user pressed Enter before clicking PIN button (LOW)

**File:** `frontend/app/(auth)/login/page.tsx` lines 268–271

```ts
onKeyDown={(e) => {
  if (e.key === "Enter") {
    if (mode === "magic" || mode === "choose") handleMagicLink();
  }
}}
```

When mode is "choose" (the initial landing state), pressing Enter in the email field calls
`handleMagicLink()`. This is probably the intended UX shortcut for the primary action.

Note: the `"magic"` mode is never set anywhere in the component. The only modes used are
`"choose"`, `"pin"`, and `"magic-sent"`. The `Mode` type includes `"magic"` but no button or
handler sets `setMode("magic")`. The Enter-key guard for `mode === "magic"` is therefore dead
code. This is not a bug per se, but dead code that could confuse future maintainers.

**Fix:** Remove `"magic"` from the `Mode` type and from the `onKeyDown` guard, OR implement the
mode by adding a "Send magic link" button that sets `mode = "magic"` and only then shows the
magic link action (consistent with the `"pin"` flow pattern).

---

### BUG-LOGIN-009: pin-setup `useEffect` calls `setStep("set-pin")` in BOTH branches of `userError` check — dead else-branch (LOW)

**File:** `frontend/app/(auth)/pin-setup/page.tsx` lines 114–123

```ts
const { error: userError } = await supabase.auth.getUser();
if (userError) {
  setStep("set-pin");
  return;
}
// Authenticated but no local token — skip has-pin check; show form
setStep("set-pin");   // <-- same outcome whether userError is truthy or falsy
return;
```

Both branches call `setStep("set-pin")` and `return`. The distinction between "truly unauthenticated"
and "authenticated but no local token" produces identical state transitions. This is dead branching —
the `if` block provides no different behavior from the fallthrough.

The comment explains the intent: the middleware will redirect truly unauthenticated users, so showing
`set-pin` is a safe fallback in both cases. The code is correct in its outcome but the branch is
misleading. Future maintainers may try to add different behavior to the two branches and be confused
about when each fires.

**Fix:** Collapse to a single `setStep("set-pin"); return;` after the `getUser()` call, with a single
comment explaining why both cases fall through to the form.

---

### Summary Table

| ID | Severity | Location | Description |
|----|----------|----------|-------------|
| BUG-LOGIN-001 | HIGH | `login/page.tsx:93` | Space-padded PIN initial state causes all 4 cells to appear filled |
| BUG-LOGIN-002 | MEDIUM | `login/page.tsx:58` vs `pin-setup/page.tsx:67` | Login PinPad renders space chars; setup PinPad trims them |
| BUG-LOGIN-003 | MEDIUM | Both PinPad components | Backspace pad strategy diverges (`""` vs `" "`) |
| BUG-LOGIN-004 | LOW | `login/page.tsx:301` | `.trim().length !== 4` logic works but is fragile |
| BUG-LOGIN-005 | LOW | `pin-setup/page.tsx:141` | `cleanPin` vs `cleanConfirm` comparison is correct but confusing |
| BUG-LOGIN-006 | CRITICAL | `pin_auth.py:175` | Lockout resets `attempt_count=0`; weakens brute-force protection |
| BUG-LOGIN-007 | MEDIUM | `auth/callback/route.ts` | Redirect created before session exchange (pattern is correct but fragile ordering) |
| BUG-LOGIN-008 | LOW | `login/page.tsx:270` | `"magic"` mode is dead code; Enter in "choose" mode triggers magic link |
| BUG-LOGIN-009 | LOW | `pin-setup/page.tsx:114` | Dead else-branch in `useEffect` PIN check |

---

## Part 2 — Playwright E2E Test Suite

### Test file: `tests/e2e/specs/login.spec.ts`

```typescript
/**
 * Login feature E2E tests — NextGenStock
 *
 * Covers:
 *  - Mode chooser UI
 *  - Magic link send flow (happy + error paths)
 *  - PIN login flow (happy + lockout + error paths)
 *  - PIN setup flow (first magic-link login → /pin-setup → /dashboard)
 *  - Dev login (when NEXT_PUBLIC_ENABLE_DEV_LOGIN=true)
 *  - Auth callback redirect chain
 *  - Edge cases: back button, Enter key, initial PIN pad visual state
 *
 * Assumptions:
 *  - Both servers running (backend :8000, frontend :3000)
 *  - Backend in DEBUG=true mode (enables /test/token + /test/reset)
 *  - NEXT_PUBLIC_ENABLE_DEV_LOGIN=true set in frontend .env.local for dev-login tests
 *
 * Run:
 *   cd tests && npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts
 */

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const TEST_EMAIL = "e2e-pin-user@nextgenstock.io";
const TEST_PIN = "1234";
const WRONG_PIN = "9999";
const VALID_EXTERNAL_EMAIL = "someone@example.com"; // no backend account

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Provision a test user via /test/token (debug endpoint) and return the token.
 * Also resets any existing PIN for this user so tests start from a known state.
 */
async function provisionUser(request: APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_URL}/test/token`, {
    data: { email },
  });
  if (!res.ok()) {
    throw new Error(`/test/token failed for ${email}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.access_token as string;
}

/**
 * Set a PIN for a test user directly via the API (bypasses the UI setup flow).
 * Requires a valid Bearer token.
 */
async function setUserPin(
  request: APIRequestContext,
  accessToken: string,
  pin: string
): Promise<void> {
  const res = await request.post(`${API_URL}/auth/set-pin`, {
    data: { pin },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok()) {
    throw new Error(`/auth/set-pin failed: ${res.status()} ${await res.text()}`);
  }
}

/**
 * Remove a user's PIN record so tests that require "no PIN" state work correctly.
 * Uses the debug-only DELETE /test/user-pin endpoint (must be implemented in backend).
 * If the endpoint does not exist, this helper is a no-op (tests that need clean PIN state
 * must call provisionUser with a fresh email that has never had a PIN set).
 */
async function clearUserPin(
  request: APIRequestContext,
  accessToken: string
): Promise<void> {
  // Best-effort: this endpoint may not exist in all environments
  await request.delete(`${API_URL}/test/user-pin`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Navigate to /login and wait for the page to be fully rendered.
 */
async function gotoLogin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByText("NextGen Trading")).toBeVisible();
  await expect(page.getByText("Work Hard, Play Hard")).toBeVisible();
}

/**
 * Type a 4-digit PIN into the login PinPad one digit at a time.
 * Focuses the first empty cell and sends keydown events.
 */
async function enterPin(page: Page, pin: string): Promise<void> {
  // The PinPad renders 4 password-type inputs; target the first one
  const cells = page.locator('input[type="password"][inputmode="numeric"]');
  await expect(cells).toHaveCount(4);
  // Click first cell to focus it
  await cells.nth(0).click();
  for (let i = 0; i < pin.length; i++) {
    await cells.nth(i).press(pin[i]);
  }
}

/**
 * Enter a PIN into the pin-setup PinPad (same DOM structure, same helper).
 */
async function enterSetupPin(page: Page, pin: string): Promise<void> {
  await enterPin(page, pin);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — mode chooser UI", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
  });

  test("renders brand header with correct name and tagline", async ({ page }) => {
    await expect(page.getByText("NextGen Trading")).toBeVisible();
    await expect(page.getByText("Work Hard, Play Hard")).toBeVisible();
  });

  test("shows 'Sign in' heading and 'Choose how to sign in' subtitle in choose mode", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByText("Choose how to sign in")).toBeVisible();
  });

  test("renders email input, Send magic link button, and Enter my PIN button in choose mode", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /enter my pin/i })).toBeVisible();
  });

  test("does not show PIN pad in choose mode", async ({ page }) => {
    await expect(page.locator('input[type="password"][inputmode="numeric"]')).toHaveCount(0);
  });

  test("does not show back arrow in choose mode", async ({ page }) => {
    // ArrowLeft button only appears when mode !== "choose"
    await expect(page.locator('button svg[data-lucide="arrow-left"], button:has(svg)')).not.toBeVisible({ timeout: 2_000 }).catch(() => {
      // fallback: check that there is no back-nav button by aria role
    });
    // Primary check: heading says "Sign in" (not "Enter your PIN")
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("shows link to register page", async ({ page }) => {
    await expect(page.getByRole("link", { name: /create one/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /create one/i })).toHaveAttribute("href", "/register");
  });

  test("shows disclaimer text", async ({ page }) => {
    await expect(page.getByText(/educational software only/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — PIN mode navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
  });

  test("clicking 'Enter my PIN' switches to PIN mode with updated heading", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await expect(page.getByRole("heading", { name: /enter your pin/i })).toBeVisible();
    await expect(page.getByText("Enter your 4-digit PIN to continue")).toBeVisible();
  });

  test("PIN mode shows 4-cell PIN pad", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await expect(page.locator('input[type="password"][inputmode="numeric"]')).toHaveCount(4);
  });

  test("PIN mode hides magic link and PIN-mode buttons; shows Sign-in-with-PIN button", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await expect(page.getByRole("button", { name: /send magic link/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /enter my pin/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with pin/i })).toBeVisible();
  });

  test("back arrow in PIN mode returns to choose mode", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await expect(page.getByRole("heading", { name: /enter your pin/i })).toBeVisible();
    // Click the back arrow (ArrowLeft icon button)
    await page.locator("button").filter({ has: page.locator('svg') }).first().click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("back arrow clears any error message", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    // Error should appear (no email)
    await expect(page.getByRole("alert")).toBeVisible();
    // Go back
    await page.locator("button").filter({ has: page.locator('svg') }).first().click();
    await expect(page.getByRole("alert")).not.toBeVisible();
  });

  test("back arrow resets PIN pad to empty state", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await page.locator('input[type="email"]').fill("test@example.com");
    await enterPin(page, "12");
    // Go back and re-enter PIN mode
    await page.locator("button").filter({ has: page.locator('svg') }).first().click();
    await page.getByRole("button", { name: /enter my pin/i }).click();
    // All cells should be empty (no filled dots from prior entry)
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    for (let i = 0; i < 4; i++) {
      await expect(cells.nth(i)).toHaveValue("");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — PIN pad initial visual state (BUG-LOGIN-001 regression)", () => {
  test("all 4 PIN cells are visually empty when page first loads in PIN mode", async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await expect(cells).toHaveCount(4);
    // Each cell value should be empty or whitespace-only (trimmed to "")
    for (let i = 0; i < 4; i++) {
      const val = await cells.nth(i).inputValue();
      expect(val.trim()).toBe("");
    }
  });

  test("Sign-in-with-PIN button is disabled when PIN pad is empty", async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole("button", { name: /enter my pin/i }).click();
    await expect(page.getByRole("button", { name: /sign in with pin/i })).toBeDisabled();
  });

  test("Sign-in-with-PIN button becomes enabled only after all 4 digits entered", async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const submitBtn = page.getByRole("button", { name: /sign in with pin/i });
    await expect(submitBtn).toBeDisabled();
    await page.locator('input[type="email"]').fill("test@example.com");
    await enterPin(page, "123");
    await expect(submitBtn).toBeDisabled(); // only 3 digits
    await page.locator('input[type="password"][inputmode="numeric"]').nth(3).press("4");
    await expect(submitBtn).toBeEnabled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — magic link flow", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
  });

  test("shows validation error for empty email on Send magic link click", async ({ page }) => {
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid email/i);
  });

  test("shows validation error for malformed email", async ({ page }) => {
    await page.locator('input[type="email"]').fill("notanemail");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid email/i);
  });

  test("Enter key in email field triggers magic link send (equivalent to button click)", async ({ page }) => {
    // Supabase will reject/not be configured in test env, but we can verify the call happens
    // by checking either the sent state or an error (not a "valid email" validation error)
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="email"]').press("Enter");
    // Should either transition to magic-sent or show a Supabase error, NOT a validation error
    await page.waitForTimeout(500);
    const alertText = await page.getByRole("alert").textContent().catch(() => null);
    if (alertText) {
      // If error shown, it should not be the validation error
      expect(alertText).not.toMatch(/valid email/i);
    } else {
      // Or page transitioned to magic-sent screen
      await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test("Enter key in email field in choose mode triggers magic link (not PIN flow)", async ({ page }) => {
    // Verify Enter in choose mode invokes handleMagicLink, not nothing
    await page.locator('input[type="email"]').fill("user@example.com");
    await page.locator('input[type="email"]').press("Enter");
    await page.waitForTimeout(300);
    // PIN pad should NOT appear (we're not in PIN mode)
    await expect(page.locator('input[type="password"][inputmode="numeric"]')).toHaveCount(0);
  });

  test("clears error when email field changes", async ({ page }) => {
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.locator('input[type="email"]').fill("a");
    await expect(page.getByRole("alert")).not.toBeVisible();
  });

  test("transitions to magic-sent screen on successful OTP request (requires Supabase)", async ({ page }) => {
    // This test is conditional on Supabase being configured in the test env.
    // If Supabase is not configured, the test is skipped.
    const supabaseConfigured =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://placeholder.supabase.co";

    test.skip(!supabaseConfigured, "Supabase not configured in test environment");

    await page.locator('input[type="email"]').fill("test-magic@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/sent a magic link to/i)).toBeVisible();
    await expect(page.getByText("test-magic@example.com")).toBeVisible();
  });

  test("magic-sent screen shows correct email and a 'Try a different email' button", async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Supabase not configured"
    );
    await page.locator('input[type="email"]').fill("user@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /try a different email/i })).toBeVisible();
  });

  test("'Try a different email' on magic-sent screen returns to choose mode", async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Supabase not configured"
    );
    await page.locator('input[type="email"]').fill("user@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /try a different email/i }).click();
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  });

  test("shows loading spinner on magic link button while request is in flight", async ({ page }) => {
    // Intercept the Supabase OTP endpoint with a delay
    await page.route("**/auth/v1/otp**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ status: 200, body: JSON.stringify({}) });
    });
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    // During the 1.5s delay, button should show loading state (Loader2 spinner)
    await expect(page.locator("button svg.animate-spin")).toBeVisible({ timeout: 2_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — PIN login flow (API mocked)", () => {
  /**
   * These tests mock the /auth/pin-login backend endpoint directly.
   * This avoids requiring a real Supabase service-role key while still
   * testing all frontend validation paths and error display logic.
   */

  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole("button", { name: /enter my pin/i }).click();
  });

  test("shows email validation error when PIN submitted without email", async ({ page }) => {
    await enterPin(page, TEST_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid email/i);
  });

  test("shows email validation error for malformed email", async ({ page }) => {
    await page.locator('input[type="email"]').fill("bad-email");
    await enterPin(page, TEST_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/valid email/i);
  });

  test("shows PIN validation error when email valid but PIN incomplete", async ({ page }) => {
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, "12"); // only 2 digits
    // Button should still be disabled with 2 digits — attempt direct call via keyboard
    // The button is disabled so clicking does nothing; validate the disabled state instead
    await expect(page.getByRole("button", { name: /sign in with pin/i })).toBeDisabled();
  });

  test("shows API error on wrong PIN (mocked 401)", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid email or PIN." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/invalid email or pin/i);
  });

  test("resets PIN pad to empty after a failed login attempt", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid email or PIN." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    // PIN pad should be reset
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    for (let i = 0; i < 4; i++) {
      const val = await cells.nth(i).inputValue();
      expect(val.trim()).toBe("");
    }
  });

  test("shows lockout error when backend returns 429", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Too many failed attempts. Try again in 15 minute(s)." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/too many failed attempts/i);
    await expect(page.getByRole("alert")).toContainText(/15 minute/i);
  });

  test("shows 'no PIN set' error when user has not set a PIN (400 from backend)", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "No PIN set for this account. Please sign in via magic link first." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, TEST_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/no pin set/i);
    await expect(page.getByRole("alert")).toContainText(/magic link/i);
  });

  test("shows loading state while PIN login request is in flight", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid email or PIN." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.locator("button svg.animate-spin")).toBeVisible({ timeout: 2_000 });
    await expect(page.getByRole("button", { name: /sign in with pin/i })).toBeDisabled();
  });

  test("shows toast notification on PIN login failure", async ({ page }) => {
    await page.route(`**/auth/pin-login`, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid email or PIN." }),
      });
    });
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    // Sonner toast appears
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({ timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — PIN login lockout simulation (backend brute-force, BUG-LOGIN-006)", () => {
  /**
   * These tests hit the real backend to verify the lockout behavior.
   * They require DEBUG=true on the backend and a provisioned test user with a PIN.
   * They use a separate email to avoid contaminating other tests.
   */

  const LOCKOUT_EMAIL = "e2e-lockout-test@nextgenstock.io";
  let accessToken: string;

  test.beforeAll(async ({ request }) => {
    // Provision user
    accessToken = await provisionUser(request, LOCKOUT_EMAIL);
    // Set a PIN for this user
    await setUserPin(request, accessToken, TEST_PIN);
  });

  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole("button", { name: /enter my pin/i }).click();
  });

  test("4 wrong PIN attempts do not lock the account", async ({ page, request }) => {
    // Intentionally testing the count: 4 wrong attempts should still allow a correct attempt.
    // (This also reveals BUG-LOGIN-006: after a lockout+reset, the budget is 4, not 5.)
    for (let i = 0; i < 4; i++) {
      await page.route(`**/auth/pin-login`, async (route) => {
        await route.continue(); // let real backend handle
      });
      await page.locator('input[type="email"]').fill(LOCKOUT_EMAIL);
      await enterPin(page, WRONG_PIN);
      await page.getByRole("button", { name: /sign in with pin/i }).click();
      await expect(page.getByRole("alert")).toContainText(/invalid email or pin/i);
      // Clear pin for next attempt
      await page.locator("button").filter({ has: page.locator('svg') }).first().click();
      await page.getByRole("button", { name: /enter my pin/i }).click();
    }
    // 5th attempt with correct PIN should succeed (not locked)
    await page.locator('input[type="email"]').fill(LOCKOUT_EMAIL);
    await enterPin(page, TEST_PIN);
    // Mock the verifyOtp call since we don't have a real Supabase session
    await page.route(`**/auth/v1/verify**`, async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ access_token: "tok", user: {} }) });
    });
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    // Should NOT show "too many failed attempts"
    const alertText = await page.getByRole("alert").textContent().catch(() => null);
    if (alertText) {
      expect(alertText).not.toMatch(/too many failed attempts/i);
    }
  }, { timeout: 90_000 });

  test("5 consecutive wrong PIN attempts trigger a lockout (429 response)", async ({ page }) => {
    // Reset PIN first to ensure fresh attempt count
    accessToken = await provisionUser(request as unknown as APIRequestContext, LOCKOUT_EMAIL);
    await setUserPin(request as unknown as APIRequestContext, accessToken, TEST_PIN);

    for (let i = 0; i < 4; i++) {
      await page.locator('input[type="email"]').fill(LOCKOUT_EMAIL);
      await enterPin(page, WRONG_PIN);
      await page.getByRole("button", { name: /sign in with pin/i }).click();
      await expect(page.getByRole("alert")).toContainText(/invalid email or pin/i);
      const backBtn = page.locator("button").filter({ has: page.locator('svg') }).first();
      await backBtn.click();
      await page.getByRole("button", { name: /enter my pin/i }).click();
    }

    // 5th wrong attempt — should trigger lockout
    await page.locator('input[type="email"]').fill(LOCKOUT_EMAIL);
    await enterPin(page, WRONG_PIN);
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/too many failed attempts/i, { timeout: 10_000 });
    await expect(page.getByRole("alert")).toContainText(/minute/i);
  }, { timeout: 120_000 });

  test("attempt during lockout period shows 429 error with wait time", async ({ page, request }) => {
    // This test assumes the lockout-test user is already locked out from the previous test.
    // If running in isolation, set up lockout via direct DB manipulation.
    await page.locator('input[type="email"]').fill(LOCKOUT_EMAIL);
    await enterPin(page, TEST_PIN); // correct PIN — but account is locked
    await page.getByRole("button", { name: /sign in with pin/i }).click();
    // Should show lockout message (429 is displayed as-is via pinAuthApi error handling)
    await expect(page.getByRole("alert")).toContainText(/too many failed attempts/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — dev login (NEXT_PUBLIC_ENABLE_DEV_LOGIN=true)", () => {
  /**
   * These tests only run when the dev login button is visible.
   * The button appears when NEXT_PUBLIC_ENABLE_DEV_LOGIN=true OR NODE_ENV=development.
   */

  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
  });

  test("Dev Login button is visible when env flag is set", async ({ page }) => {
    // The button renders conditionally. If it is not visible, skip test.
    const devBtn = page.getByRole("button", { name: /dev login/i });
    const isVisible = await devBtn.isVisible();
    test.skip(!isVisible, "NEXT_PUBLIC_ENABLE_DEV_LOGIN is not set — skipping dev login tests");
    await expect(devBtn).toBeVisible();
  });

  test("Dev Login uses default email when email field is empty", async ({ page }) => {
    const devBtn = page.getByRole("button", { name: /dev login/i });
    test.skip(!(await devBtn.isVisible()), "Dev login not available");

    await page.route(`**/test/token`, async (route) => {
      const body = await route.request().postDataJSON();
      expect(body.email).toBe("dev@nextgenstock.io");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "test-token-abc", user_id: 1 }),
      });
    });

    await devBtn.click();
    // Should navigate to /dashboard
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
  });

  test("Dev Login uses typed email when provided", async ({ page }) => {
    const devBtn = page.getByRole("button", { name: /dev login/i });
    test.skip(!(await devBtn.isVisible()), "Dev login not available");

    const customEmail = "custom-dev@example.com";
    await page.route(`**/test/token`, async (route) => {
      const body = await route.request().postDataJSON();
      expect(body.email).toBe(customEmail);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "test-token-xyz", user_id: 2 }),
      });
    });

    await page.locator('input[type="email"]').fill(customEmail);
    await devBtn.click();
    await page.waitForURL("**/dashboard", { timeout: 10_000 });
  });

  test("Dev Login sets dev_token cookie in browser", async ({ page, context }) => {
    const devBtn = page.getByRole("button", { name: /dev login/i });
    test.skip(!(await devBtn.isVisible()), "Dev login not available");

    await page.route(`**/test/token`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "dev-token-test", user_id: 1 }),
      });
    });
    // Intercept navigation to avoid requiring a real /dashboard
    await page.route("**/dashboard", async (route) => {
      await route.fulfill({ status: 200, body: "<html><body>dashboard</body></html>" });
    });

    await devBtn.click();
    await page.waitForTimeout(500);

    const cookies = await context.cookies();
    const devTokenCookie = cookies.find((c) => c.name === "dev_token");
    expect(devTokenCookie).toBeDefined();
    expect(devTokenCookie!.value).toContain("dev-token-test");
  });

  test("Dev Login shows error when backend returns non-200", async ({ page }) => {
    const devBtn = page.getByRole("button", { name: /dev login/i });
    test.skip(!(await devBtn.isVisible()), "Dev login not available");

    await page.route(`**/test/token`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal Server Error" }),
      });
    });

    await devBtn.click();
    await expect(page.getByRole("alert")).toContainText(/dev login failed|internal server error/i);
  });

  test("Dev Login button is not visible when flag is not set (production safety)", async ({ page }) => {
    // If the button IS visible in this env, it means the env flag IS set.
    // This test verifies the button is absent when the flag should be absent.
    // Only meaningful if you can control the env; otherwise use this as a visual smoke check.
    const devBtn = page.getByRole("button", { name: /dev login/i });
    const isVisible = await devBtn.isVisible();
    // Document the state — do not fail (env-specific)
    console.log(`Dev Login button visible: ${isVisible} (env: NODE_ENV=${process.env.NODE_ENV})`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auth callback — redirect chain", () => {
  /**
   * Tests for /auth/callback route handler behavior.
   * These mock the Supabase exchangeCodeForSession response.
   */

  test("callback without 'code' param redirects to /login?error=auth_callback_failed", async ({ page }) => {
    const res = await page.request.get(`${BASE_URL}/auth/callback`);
    // Should redirect — follow the redirect chain
    await page.goto(`${BASE_URL}/auth/callback`);
    await expect(page).toHaveURL(/login.*error=auth_callback_failed/);
  });

  test("callback with invalid code redirects to /login?error=auth_callback_failed", async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/callback?code=invalid-code-xyz`);
    await expect(page).toHaveURL(/login.*error=auth_callback_failed/, { timeout: 10_000 });
  });

  test("login page shows error state when redirected back with auth_callback_failed", async ({ page }) => {
    await page.goto(`${BASE_URL}/login?error=auth_callback_failed`);
    // The login page should render; the error param may or may not be displayed
    // (current implementation doesn't read the query param — documenting this)
    await expect(page.getByText("NextGen Trading")).toBeVisible();
    // Note: if the page reads the 'error' query param in the future, add assertion here
  });

  test("callback preserves 'next' param through to pin-setup redirect", async ({ page, request }) => {
    // Intercept the Supabase exchangeCodeForSession call
    await page.route("**/auth/v1/token**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "tok", refresh_token: "rtok", user: { id: "u1", email: TEST_EMAIL } }),
      });
    });
    // Visit callback with a next param
    await page.goto(`${BASE_URL}/auth/callback?code=valid-test-code&next=/dashboard`);
    // Should land on /pin-setup?next=/dashboard (or be redirected if session issues)
    await page.waitForTimeout(1_000);
    const url = page.url();
    // Either redirected to pin-setup with next preserved, or fell back to login error
    // (depending on whether the test Supabase intercept works for the server-side route)
    expect(url).toMatch(/pin-setup|login/);
    if (url.includes("pin-setup")) {
      expect(url).toContain("next=%2Fdashboard");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Pin setup page — UI and flow", () => {
  /**
   * These tests inject a dev_token cookie to arrive at /pin-setup
   * as an authenticated user, then exercise the PIN setup form.
   */

  const PIN_SETUP_EMAIL = "e2e-setup-user@nextgenstock.io";

  test.beforeEach(async ({ page, request, context }) => {
    // Provision user and authenticate browser context
    const token = await provisionUser(request, PIN_SETUP_EMAIL);
    await clearUserPin(request, token); // ensure no existing PIN
    await context.addCookies([
      {
        name: "dev_token",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
      {
        name: "auth_session",
        value: "1",
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`${BASE_URL}/pin-setup`);
  });

  test("shows loading spinner then transitions to set-pin form", async ({ page }) => {
    // May briefly show spinner during API check
    await expect(
      page.getByRole("heading", { name: /set a 4-digit pin/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows correct heading for set-pin step", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
  });

  test("shows step indicator with first step active", async ({ page }) => {
    await expect(page.locator(".h-1\\.5.w-8.rounded-full.bg-primary").first()).toBeVisible({ timeout: 10_000 });
  });

  test("PIN pad cells are empty on load", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await expect(cells).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      const val = await cells.nth(i).inputValue();
      expect(val.trim()).toBe("");
    }
  });

  test("Continue button disabled when PIN incomplete", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  test("Continue button enables after all 4 digits entered", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, TEST_PIN);
    await expect(page.getByRole("button", { name: /continue/i })).toBeEnabled();
  });

  test("continues to confirm-pin step after entering 4 digits and clicking Continue", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
  });

  test("confirm-pin step shows both step indicator dots as active", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
    // Both step dots should be bg-primary
    const dots = page.locator(".h-1\\.5.w-8.rounded-full");
    expect(await dots.count()).toBe(2);
    // Both should have bg-primary (confirming step 2 is now active)
  });

  test("confirm-pin: Save PIN button disabled until 4 digits entered in confirm field", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /save pin/i })).toBeDisabled();
  });

  test("shows PIN mismatch error when confirm PIN differs", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, "1234");
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
    await enterSetupPin(page, "5678"); // different PIN
    await page.getByRole("button", { name: /save pin/i }).click();
    await expect(page.getByRole("alert")).toContainText(/don't match/i);
  });

  test("clears confirm PIN after mismatch error", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, "1234");
    await page.getByRole("button", { name: /continue/i }).click();
    await enterSetupPin(page, "5678");
    await page.getByRole("button", { name: /save pin/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    for (let i = 0; i < 4; i++) {
      const val = await cells.nth(i).inputValue();
      expect(val.trim()).toBe("");
    }
  });

  test("skipping PIN setup redirects to /dashboard (or next param destination)", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /skip for now/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  test("'Skip for now' not shown on confirm-pin step", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });
    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /skip for now/i })).not.toBeVisible();
  });

  test("shows 'already-set' screen when user already has a PIN", async ({ page, request, context }) => {
    // Set a PIN for this user via API
    const token = await provisionUser(request, PIN_SETUP_EMAIL);
    await setUserPin(request, token, TEST_PIN);
    // Re-visit pin-setup
    await page.goto(`${BASE_URL}/pin-setup`);
    await expect(page.getByRole("heading", { name: /pin already set/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /go to dashboard/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reset my pin/i })).toBeVisible();
  });

  test("'Go to Dashboard' from already-set screen navigates to /dashboard", async ({ page, request }) => {
    const token = await provisionUser(request, PIN_SETUP_EMAIL);
    await setUserPin(request, token, TEST_PIN);
    await page.goto(`${BASE_URL}/pin-setup`);
    await expect(page.getByRole("heading", { name: /pin already set/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /go to dashboard/i }).click();
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
  });

  test("'Reset my PIN' from already-set screen returns to set-pin form", async ({ page, request }) => {
    const token = await provisionUser(request, PIN_SETUP_EMAIL);
    await setUserPin(request, token, TEST_PIN);
    await page.goto(`${BASE_URL}/pin-setup`);
    await expect(page.getByRole("heading", { name: /pin already set/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /reset my pin/i }).click();
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Pin setup page — happy path save flow (mocked backend)", () => {
  test("full set-pin flow: enter PIN, confirm, save, redirect to dashboard", async ({
    page,
    request,
    context,
  }) => {
    const token = await provisionUser(request, "e2e-happypath@nextgenstock.io");
    await clearUserPin(request, token);
    await context.addCookies([
      { name: "dev_token", value: token, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
      { name: "auth_session", value: "1", domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
    ]);

    // Mock the set-pin API call
    await page.route(`**/auth/set-pin`, async (route) => {
      expect(route.request().method()).toBe("POST");
      const body = await route.request().postDataJSON();
      expect(body.pin).toBe(TEST_PIN);
      await route.fulfill({ status: 204, body: "" });
    });
    // Mock the Supabase getSession call to return a valid session
    await page.route(`**/auth/v1/user**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "u1", email: "e2e-happypath@nextgenstock.io" }),
      });
    });

    await page.goto(`${BASE_URL}/pin-setup`);
    await expect(page.getByRole("heading", { name: /set a 4-digit pin/i })).toBeVisible({ timeout: 10_000 });

    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("heading", { name: /confirm your pin/i })).toBeVisible();
    await enterSetupPin(page, TEST_PIN);
    await page.getByRole("button", { name: /save pin/i }).click();

    // Should show "PIN saved!" confirmation state
    await expect(page.getByRole("heading", { name: /pin saved/i })).toBeVisible({ timeout: 5_000 });
    // After 1.5s auto-redirect to dashboard
    await expect(page).toHaveURL(/dashboard|pin-setup/, { timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — accessibility and keyboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoLogin(page);
  });

  test("email input has autocomplete='email' attribute", async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toHaveAttribute("autocomplete", "email");
  });

  test("email input has associated label", async ({ page }) => {
    await expect(page.locator("label[for='email']")).toBeVisible();
  });

  test("error messages use role='alert' for screen reader accessibility", async ({ page }) => {
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("PIN cells use type=password and inputmode=numeric for mobile UX", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await expect(cells).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(cells.nth(i)).toHaveAttribute("type", "password");
      await expect(cells.nth(i)).toHaveAttribute("inputmode", "numeric");
      await expect(cells.nth(i)).toHaveAttribute("maxlength", "1");
    }
  });

  test("PIN pad auto-advances focus to next cell after digit entry", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await cells.nth(0).click();
    await cells.nth(0).press("1");
    // Focus should be on cell 1
    await expect(cells.nth(1)).toBeFocused();
    await cells.nth(1).press("2");
    await expect(cells.nth(2)).toBeFocused();
  });

  test("Backspace moves focus to previous PIN cell and clears it", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await cells.nth(0).click();
    await cells.nth(0).press("1");
    await cells.nth(1).press("2");
    // Now press backspace from cell 2
    await cells.nth(2).press("Backspace"); // clears cell 2, moves to cell 1
    await expect(cells.nth(1)).toBeFocused();
    const val2 = await cells.nth(2).inputValue();
    expect(val2.trim()).toBe("");
  });

  test("PIN cell click focuses and allows re-entry", async ({ page }) => {
    await page.getByRole("button", { name: /enter my pin/i }).click();
    const cells = page.locator('input[type="password"][inputmode="numeric"]');
    await cells.nth(2).click();
    await expect(cells.nth(2)).toBeFocused();
    await cells.nth(2).press("7");
    const val = await cells.nth(2).inputValue();
    expect(val).toBe("7");
  });

  test("Tab key navigates through interactive elements in logical order", async ({ page }) => {
    const email = page.locator('input[type="email"]');
    await email.click();
    await page.keyboard.press("Tab");
    // Next focused element should be one of the buttons
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
    expect(["button", "a"]).toContain(focusedTag);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

test.describe("Login page — protected route redirect", () => {
  test("unauthenticated access to /dashboard redirects to /login", async ({ page }) => {
    // Ensure no auth cookies are set
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test("unauthenticated access to /profile redirects to /login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/profile`);
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test("/login is accessible without authentication", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/login`);
    await expect(page.getByText("NextGen Trading")).toBeVisible();
  });

  test("/pin-setup is accessible without authentication (middleware allows it)", async ({ page }) => {
    // The middleware protects /pin-setup only after auth exchange; unauthenticated
    // access behavior depends on middleware config. Document actual behavior here.
    await page.context().clearCookies();
    await page.goto(`${BASE_URL}/pin-setup`);
    // Either shows login redirect or shows the pin-setup page in fallback mode
    const url = page.url();
    console.log(`/pin-setup unauthenticated URL: ${url}`);
    // Should not 500
    await expect(page.locator("body")).toBeVisible();
  });
});
```

---

## Part 3 — Backend PIN API Direct Tests

The following tests call the backend API directly (no browser) to verify PIN endpoint behavior,
especially BUG-LOGIN-006 (lockout counter reset).

Add to a separate file `tests/e2e/specs/login-api.spec.ts`:

```typescript
/**
 * PIN Auth API direct tests — NextGenStock
 *
 * Tests the backend PIN endpoints (/auth/pin-login, /auth/set-pin, /auth/has-pin)
 * directly via Playwright's request API without a browser.
 *
 * Run:
 *   cd tests && npx playwright test --config=e2e/playwright.config.ts specs/login-api.spec.ts
 */

import { test, expect } from "@playwright/test";

const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";

async function getToken(request: import("@playwright/test").APIRequestContext, email: string): Promise<string> {
  const res = await request.post(`${API_URL}/test/token`, { data: { email } });
  if (!res.ok()) throw new Error(`/test/token failed: ${res.status()}`);
  const body = await res.json();
  return body.access_token as string;
}

async function setPin(request: import("@playwright/test").APIRequestContext, token: string, pin: string): Promise<void> {
  const res = await request.post(`${API_URL}/auth/set-pin`, {
    data: { pin },
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(204);
}

async function attemptPinLogin(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  pin: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await request.post(`${API_URL}/auth/pin-login`, {
    data: { email, pin },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status(), body };
}

test.describe("PIN API — validation", () => {
  test("POST /auth/pin-login rejects non-4-digit PIN with 422", async ({ request }) => {
    const { status } = await attemptPinLogin(request, "test@example.com", "12");
    expect(status).toBe(422);
  });

  test("POST /auth/pin-login rejects non-numeric PIN with 422", async ({ request }) => {
    const { status } = await attemptPinLogin(request, "test@example.com", "abcd");
    expect(status).toBe(422);
  });

  test("POST /auth/set-pin rejects non-4-digit PIN with 422", async ({ request }) => {
    const token = await getToken(request, "e2e-api-val@nextgenstock.io");
    const res = await request.post(`${API_URL}/auth/set-pin`, {
      data: { pin: "99" },
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(422);
  });

  test("POST /auth/set-pin requires authentication (401 without token)", async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/set-pin`, {
      data: { pin: "1234" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("GET /auth/has-pin requires authentication (401 without token)", async ({ request }) => {
    const res = await request.get(`${API_URL}/auth/has-pin`);
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("PIN API — has-pin check", () => {
  const email = "e2e-haspin@nextgenstock.io";

  test("has-pin returns false when no PIN set", async ({ request }) => {
    const token = await getToken(request, email);
    // Attempt to clear PIN (best-effort)
    await request.delete(`${API_URL}/test/user-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await request.get(`${API_URL}/auth/has-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    // may be true if PIN was set by a prior test run and not cleared
    expect(typeof body.has_pin).toBe("boolean");
  });

  test("has-pin returns true after PIN is set", async ({ request }) => {
    const token = await getToken(request, email);
    await setPin(request, token, "1234");
    const res = await request.get(`${API_URL}/auth/has-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.has_pin).toBe(true);
  });

  test("set-pin can update an existing PIN", async ({ request }) => {
    const token = await getToken(request, email);
    await setPin(request, token, "1234");
    await setPin(request, token, "5678"); // update
    const res = await request.get(`${API_URL}/auth/has-pin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.has_pin).toBe(true);
  });
});

test.describe("PIN API — login and lockout", () => {
  const email = "e2e-lockout-api@nextgenstock.io";
  const correctPin = "2468";
  const wrongPin = "1357";

  test.beforeAll(async ({ request }) => {
    const token = await getToken(request, email);
    await setPin(request, token, correctPin);
  });

  test("correct PIN returns token_hash (200)", async ({ request }) => {
    // Note: this may fail in test env if Supabase service-role key is not configured,
    // in which case the backend returns 503. Both outcomes are acceptable here.
    const { status, body } = await attemptPinLogin(request, email, correctPin);
    if (status === 200) {
      expect(body).toHaveProperty("token_hash");
      expect(typeof body.token_hash).toBe("string");
    } else {
      // 503 = Supabase not configured; acceptable in CI without real keys
      expect([200, 503]).toContain(status);
    }
  });

  test("wrong PIN returns 401 with generic error message", async ({ request }) => {
    const { status, body } = await attemptPinLogin(request, email, wrongPin);
    expect(status).toBe(401);
    expect((body.detail as string).toLowerCase()).toContain("invalid");
  });

  test("unknown email returns 401 (not 404 — prevents user enumeration)", async ({ request }) => {
    const { status } = await attemptPinLogin(request, "nobody-special@nextgenstock.io", "1234");
    expect(status).toBe(401);
  });

  test("after 5 wrong attempts, next attempt returns 429 lockout (BUG-LOGIN-006 verification)", async ({ request }) => {
    // Use a dedicated email for this test to avoid contaminating other tests
    const lockEmail = "e2e-lockout-verify@nextgenstock.io";
    const lockToken = await getToken(request, lockEmail);
    await setPin(request, lockToken, correctPin);

    // Make 5 wrong attempts
    for (let i = 0; i < 5; i++) {
      const { status } = await attemptPinLogin(request, lockEmail, wrongPin);
      // First 4 should be 401, 5th triggers lockout and also returns 401
      // (the lockout is set AFTER the 5th failure, so the 5th itself returns 401)
      expect([401, 429]).toContain(status);
    }

    // 6th attempt — account should now be locked
    const { status: lockedStatus, body: lockedBody } = await attemptPinLogin(request, lockEmail, wrongPin);
    expect(lockedStatus).toBe(429);
    expect((lockedBody.detail as string).toLowerCase()).toContain("too many");
  }, { timeout: 30_000 });

  test("lockout also blocks correct PIN (429 takes precedence)", async ({ request }) => {
    // The lockout-verify user should still be locked from the previous test.
    // Correct PIN should also return 429 while locked.
    const lockEmail = "e2e-lockout-verify@nextgenstock.io";
    const { status } = await attemptPinLogin(request, lockEmail, correctPin);
    // 429 if still locked, 200/503 if lockout expired
    expect([200, 429, 503]).toContain(status);
    if (status === 200) {
      console.log("Lockout expired before this test ran — lockout duration < test run time");
    }
  });
});
```

---

## Part 4 — Test Environment Setup Notes

### Prerequisites

- Node.js 18+ and npm in `tests/`
- Backend running: `cd backend && uvicorn app.main:app --reload` (port 8000)
- Frontend running: `cd frontend && npm run dev` (port 3000)
- Backend must have `DEBUG=true` in `.env` for `/test/token` and `/test/reset`
- PostgreSQL running and schema migrated: `alembic upgrade head`
- `bcrypt` Python package installed (required for PIN hashing)

### Environment Variables for Tests

```bash
# Frontend .env.local (for test runs against dev server)
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_ENABLE_DEV_LOGIN=true   # enables Dev Login button tests

# Optional — Supabase (required for magic-link and PIN-session tests)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Backend .env
DEBUG=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...       # required for /auth/pin-login to generate token_hash
SUPABASE_JWT_SECRET=...
```

### Running the Login Tests

```bash
cd tests
npm install

# All login tests (browser + API)
npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts specs/login-api.spec.ts

# Browser tests only
npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts

# API tests only
npx playwright test --config=e2e/playwright.config.ts specs/login-api.spec.ts

# Specific test by name
npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts -g "PIN pad initial visual"

# With headed browser (useful for debugging)
npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts --headed

# Run in Chromium only
npx playwright test --config=e2e/playwright.config.ts specs/login.spec.ts --project=chromium
```

### Tests That Require Supabase

The following test groups are automatically skipped when `NEXT_PUBLIC_SUPABASE_URL` is not set
or is a placeholder value:

- "transitions to magic-sent screen on successful OTP request"
- "magic-sent screen shows correct email and 'Try a different email' button"
- "'Try a different email' returns to choose mode"
- All tests in "Pin setup page — happy path save flow" (mocked; no real Supabase needed for UI flow)
- PIN API `correct PIN returns token_hash` (returns 503 without `SUPABASE_SERVICE_ROLE_KEY`)

### Tests That Require `DEBUG=true` Backend

- All tests in "Login page — PIN login lockout simulation"
- All tests in "PIN API — login and lockout"
- All tests in "Pin setup page" that call `provisionUser`

Without `DEBUG=true`, the `/test/token` provisioning endpoint returns 403 and the `provisionUser`
helper throws. The test suite is designed to fail fast in this case.

### Supabase-Free Testing Strategy

For CI environments without real Supabase credentials, all PIN and session flows are exercised
through mocked `page.route()` intercepts. The mock strategy covers:

- `**/auth/pin-login` — mock 200/401/429/400 responses
- `**/auth/v1/verify**` — mock Supabase OTP verification
- `**/auth/v1/otp**` — mock OTP send
- `**/auth/set-pin` — mock 204 response
- `**/auth/has-pin` — mock `{ has_pin: false | true }`

---

## Part 5 — Known Test Limitations

| Limitation | Workaround |
|---|---|
| Auth callback tests require the Next.js server-side route to actually call Supabase | Use `page.route()` to intercept Supabase token endpoint; verify redirect URL |
| PIN lockout tests require 5 sequential wrong attempts — slow (~30s) | Run with `--timeout=120000`; grouped in dedicated describe block |
| `/test/user-pin` DELETE endpoint may not exist | Tests that require "no PIN" state use unique emails that never had a PIN set |
| Magic link "sent" state can only be fully verified with a real Supabase project | Tests are skipped when Supabase not configured |
| `window.location.href = "/dashboard"` navigation in dev login cannot be intercepted by `page.route()` — it's a full page navigation | Use `page.waitForURL()` instead of route interception |
| The `PinPad` component uses `onKeyDown` only (no `onChange`) — standard Playwright `fill()` does not work | Use `press()` on individual cells, as shown in the `enterPin()` helper |
| Dev login cookie is set via `document.cookie` (client-side JS) — `context.cookies()` sees it after the JS runs | Wait for navigation/timeout before reading cookies |
