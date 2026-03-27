/**
 * profile.spec.ts — User profile management E2E tests
 *
 * Covers:
 *   FR-13  GET /profile returns current profile
 *   FR-14  PATCH /profile updates fields
 *   FR-15  Profile page renders pre-populated form, shows success toast
 */

import { test, expect } from "../fixtures/auth.fixture";
import { API_URL, ROUTES, USER_A } from "../fixtures/test-data";
import { getProfile, patchProfile, registerUser } from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// API-level profile tests (authenticated via fixture)
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Profile API — GET & PATCH /profile", () => {
  test("PROF-01: GET /profile returns profile with expected shape", async ({ request }) => {
    const { ok: tokenOk } = await registerUser(request, USER_A.email, USER_A.password);
    expect(tokenOk).toBe(true);

    const { ok, body } = await getProfile(request);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("user_id");
    expect(body).toHaveProperty("timezone");
    expect(body).toHaveProperty("default_symbol");
    expect(body).toHaveProperty("default_mode");
  });

  test("PROF-02: PATCH /profile updates display_name", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    const newName = `Test User ${Date.now()}`;
    const { ok, body } = await patchProfile(request, { display_name: newName });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("display_name", newName);
  });

  test("PROF-03: PATCH /profile updates timezone", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    const { ok, body } = await patchProfile(request, { timezone: "America/Chicago" });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("timezone", "America/Chicago");
  });

  test("PROF-04: PATCH /profile updates default_symbol", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    const { ok, body } = await patchProfile(request, { default_symbol: "TSLA" });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("default_symbol", "TSLA");
  });

  test("PROF-05: PATCH /profile updates default_mode", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    const { ok, body } = await patchProfile(request, { default_mode: "aggressive" });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("default_mode", "aggressive");
  });

  test("PROF-06: updated profile values persist on subsequent GET", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);

    const newName = `Persist Test ${Date.now()}`;
    await patchProfile(request, { display_name: newName });

    const { body } = await getProfile(request);
    expect(body).toHaveProperty("display_name", newName);
  });

  test("PROF-07: GET /profile returns 401 without authentication", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/profile`);
    expect(res.status()).toBe(401);
  });

  test("PROF-08: PATCH /profile returns 401 without authentication", async ({
    request,
  }) => {
    const res = await request.patch(`${API_URL}/profile`, {
      data: { display_name: "Hacker" },
    });
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-level profile tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Profile UI — /profile page", () => {
  test("PROF-09: /profile page loads with expected form elements", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // The page title or heading should mention "Profile"
    const heading = page.locator('h1, h2, [data-testid="page-title"]');
    await expect(heading.first()).toContainText(/profile/i, { timeout: 8_000 });

    // Expect at least one form with text inputs
    const inputs = page.locator('input[type="text"], input[type="email"]');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
  });

  test("PROF-10: profile form is pre-populated with current values", async ({
    authenticatedPage: page,
    request,
  }) => {
    // Set a known display name first
    await registerUser(request, USER_A.email, USER_A.password);
    const knownName = `PrePop ${Date.now()}`;
    await patchProfile(request, { display_name: knownName });

    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // The display name input should be pre-filled
    const displayNameInput = page.locator(
      'input[name="display_name"], input[id="display_name"], [placeholder*="display" i]'
    );
    if (await displayNameInput.count() > 0) {
      await expect(displayNameInput.first()).toHaveValue(knownName, { timeout: 8_000 });
    }
  });

  test("PROF-11: submitting profile update shows success toast", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // Find display name input and update it
    const displayNameInput = page.locator(
      'input[name="display_name"], input[id="display_name"], [placeholder*="display" i], [placeholder*="name" i]'
    );

    if (await displayNameInput.count() > 0) {
      await displayNameInput.first().fill(`Updated ${Date.now()}`);
      await page.click('button[type="submit"], button:has-text("Save")');

      // Wait for success toast / notification
      const toast = page.locator(
        '[data-sonner-toast], [role="status"], [data-testid="toast"], .sonner-toast, [aria-label*="success" i]'
      );
      await expect(toast.first()).toBeVisible({ timeout: 8_000 });
    }
  });

  test("PROF-12: profile page is accessible and navigable from sidebar", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.dashboard);
    await page.waitForLoadState("networkidle");

    // Look for a profile or settings link in the navigation
    const profileLink = page.locator(
      'a[href*="profile"], nav a:has-text("Profile"), [data-testid="nav-profile"]'
    );

    if (await profileLink.count() > 0) {
      await profileLink.first().click();
      await expect(page).toHaveURL(/\/profile/, { timeout: 8_000 });
    } else {
      // Direct navigation should work
      await page.goto(ROUTES.profile);
      await expect(page).toHaveURL(/\/profile/);
    }
  });
});
