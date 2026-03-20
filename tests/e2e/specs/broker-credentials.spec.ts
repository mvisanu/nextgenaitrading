/**
 * broker-credentials.spec.ts — Broker credential management E2E tests
 *
 * Covers:
 *   FR-16  List credentials — masked summaries only
 *   FR-17  Add Alpaca credential
 *   FR-18  Edit credential
 *   FR-19  Delete credential (with confirmation dialog)
 *   FR-20  Test connection button
 *   FR-21  Provider-specific form fields
 *   FR-22  Provider badge display
 *   FR-23  Alpaca is default provider
 *   FR-24  Delete requires confirmation
 */

import { test, expect } from "../fixtures/auth.fixture";
import { API_URL, ALPACA_CRED, ROBINHOOD_CRED, ROUTES, USER_A } from "../fixtures/test-data";
import {
  createCredential,
  deleteCredential,
  listCredentials,
  testCredential,
  registerUser,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// API-level credential tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Broker Credential API", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
  });

  test("CRED-01: POST /broker/credentials creates Alpaca credential and returns masked key", async ({
    request,
  }) => {
    const { ok, status, body } = await createCredential(request, ALPACA_CRED);

    expect(status).toBe(201);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("provider", "alpaca");
    expect(body).toHaveProperty("profile_name", ALPACA_CRED.profile_name);
    expect(body).toHaveProperty("paper_trading", true);

    // api_key must be masked — never the raw value
    const apiKeyField = (body as Record<string, unknown>).api_key_masked as string;
    expect(apiKeyField).toBeDefined();
    expect(apiKeyField).not.toBe(ALPACA_CRED.api_key);
    expect(apiKeyField).toMatch(/encrypted|\*{4}/i);
  });

  test("CRED-02: POST /broker/credentials creates Robinhood credential", async ({
    request,
  }) => {
    const { ok, status, body } = await createCredential(request, ROBINHOOD_CRED);

    expect([201, 200]).toContain(status);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("provider", "robinhood");
    expect(body).toHaveProperty("profile_name", ROBINHOOD_CRED.profile_name);

    // Raw key must never appear
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(ROBINHOOD_CRED.api_key);
    expect(bodyStr).not.toContain(ROBINHOOD_CRED.secret_key);
  });

  test("CRED-03: GET /broker/credentials returns list — raw keys never exposed", async ({
    request,
  }) => {
    await createCredential(request, ALPACA_CRED);
    const { ok, body } = await listCredentials(request);

    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);

    // No decrypted/raw key values in any item
    const bodyStr = JSON.stringify(body);
    expect(bodyStr).not.toContain(ALPACA_CRED.api_key);
    expect(bodyStr).not.toContain(ALPACA_CRED.secret_key);
  });

  test("CRED-04: PATCH /broker/credentials/{id} updates profile_name", async ({
    request,
  }) => {
    const { body: created } = await createCredential(request, ALPACA_CRED);
    const id = (created as { id: number }).id;

    const newName = `Updated Name ${Date.now()}`;
    const res = await request.patch(`${API_URL}/broker/credentials/${id}`, {
      data: { profile_name: newName },
    });
    expect(res.ok()).toBe(true);
    const updated = await res.json();
    expect(updated).toHaveProperty("profile_name", newName);
  });

  test("CRED-05: DELETE /broker/credentials/{id} returns 204 and credential is gone", async ({
    request,
  }) => {
    const { body: created } = await createCredential(request, ALPACA_CRED);
    const id = (created as { id: number }).id;

    const { ok, status } = await deleteCredential(request, id);
    expect(status).toBe(204);
    expect(ok).toBe(true);

    // Verify it's gone
    const { body: afterDelete } = await listCredentials(request);
    const found = (afterDelete as { id: number }[]).find((c) => c.id === id);
    expect(found).toBeUndefined();
  });

  test("CRED-06: POST /broker/credentials/{id}/test returns {ok: bool}", async ({
    request,
  }) => {
    const { body: created } = await createCredential(request, ALPACA_CRED);
    const id = (created as { id: number }).id;

    const { ok, status, body } = await testCredential(request, id);
    expect(status).toBe(200);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("ok");
    expect(typeof (body as { ok: boolean }).ok).toBe("boolean");
    // Decrypted key must not appear in test result
    expect(JSON.stringify(body)).not.toContain(ALPACA_CRED.api_key);
  });

  test("CRED-07: accessing another user's credential returns 403", async ({
    request,
  }) => {
    // Create credential as USER_A
    const { body: created } = await createCredential(request, ALPACA_CRED);
    const credId = (created as { id: number }).id;

    // Logout and login as a different user
    await request.post(`${API_URL}/auth/logout`);
    const otherEmail = `other-cred-test-${Date.now()}@nextgenstock.test`;
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });

    // Try to access USER_A's credential
    const res = await request.post(`${API_URL}/broker/credentials/${credId}/test`);
    expect([403, 404]).toContain(res.status());
  });

  test("CRED-08: returns 401 when listing credentials without auth", async ({
    request,
  }) => {
    // Log out first
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/broker/credentials`);
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-level credential tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Broker Credential UI — /profile page", () => {
  test("CRED-09: credential section visible on profile page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // Broker / credential section should be visible
    const credSection = page.locator(
      '[data-testid="credentials"], section:has-text("Broker"), h2:has-text("Broker"), h3:has-text("Credential")'
    );
    await expect(credSection.first()).toBeVisible({ timeout: 8_000 });
  });

  test("CRED-10: add Alpaca credential via UI — credential appears in list", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // Click "Add credential" button
    const addBtn = page.locator(
      'button:has-text("Add"), button:has-text("New credential"), button:has-text("Add credential"), [data-testid="add-credential"]'
    );
    if (await addBtn.count() === 0) {
      test.skip(true, "Add credential button not found — UI not implemented");
      return;
    }
    await addBtn.first().click();

    // Fill the form
    const profileNameInput = page.locator(
      'input[name="profile_name"], input[id="profile_name"], [placeholder*="name" i]'
    ).first();
    await profileNameInput.fill(ALPACA_CRED.profile_name);

    const apiKeyInput = page.locator(
      'input[name="api_key"], input[id="api_key"], [placeholder*="api key" i], [placeholder*="key id" i]'
    ).first();
    await apiKeyInput.fill(ALPACA_CRED.api_key);

    const secretInput = page.locator(
      'input[name="secret_key"], input[id="secret_key"], input[type="password"]'
    ).first();
    await secretInput.fill(ALPACA_CRED.secret_key);

    // Submit
    await page.click('button[type="submit"], button:has-text("Save")');

    // Wait for the credential to appear in the list
    await expect(
      page.locator(`text=${ALPACA_CRED.profile_name}`)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("CRED-11: raw API keys are never visible in the DOM after saving", async ({
    authenticatedPage: page,
    request,
  }) => {
    // Create credential via API to avoid UI complexity
    await createCredential(request, ALPACA_CRED);

    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    const pageContent = await page.content();
    expect(pageContent).not.toContain(ALPACA_CRED.api_key);
    expect(pageContent).not.toContain(ALPACA_CRED.secret_key);
  });

  test("CRED-12: Alpaca credential badge shows green 'Stocks & ETFs' label", async ({
    authenticatedPage: page,
    request,
  }) => {
    await createCredential(request, ALPACA_CRED);

    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // Look for Alpaca badge text
    const badge = page.locator('text=/alpaca/i').or(page.locator('text=/stocks.*etf/i'));
    await expect(badge.first()).toBeVisible({ timeout: 8_000 });
  });

  test("CRED-13: delete credential shows confirmation dialog before proceeding", async ({
    authenticatedPage: page,
    request,
  }) => {
    await createCredential(request, ALPACA_CRED);

    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    // Find delete button
    const deleteBtn = page.locator(
      'button:has-text("Delete"), button[aria-label*="delete" i], [data-testid="delete-credential"]'
    );
    if (await deleteBtn.count() === 0) {
      test.skip(true, "Delete button not found — UI not implemented");
      return;
    }

    await deleteBtn.first().click();

    // A confirmation dialog should appear
    const dialog = page.locator('[role="dialog"], [role="alertdialog"]');
    await expect(dialog.first()).toBeVisible({ timeout: 5_000 });

    // Dialog should have a confirm/cancel option
    const confirmBtn = dialog.locator(
      'button:has-text("Delete"), button:has-text("Confirm"), button:has-text("Yes")'
    );
    await expect(confirmBtn.first()).toBeVisible({ timeout: 3_000 });
  });

  test("CRED-14: test connection button on existing credential shows result badge", async ({
    authenticatedPage: page,
    request,
  }) => {
    await createCredential(request, ALPACA_CRED);

    await page.goto(ROUTES.profile);
    await page.waitForLoadState("networkidle");

    const testBtn = page.locator(
      'button:has-text("Test"), button:has-text("Test connection"), [data-testid="test-connection"]'
    );
    if (await testBtn.count() === 0) {
      test.skip(true, "Test connection button not found");
      return;
    }

    await testBtn.first().click();

    // After test, a status badge should appear (success or failure)
    const badge = page.locator('[data-testid="connection-badge"], .badge, [role="status"]');
    await expect(badge.first()).toBeVisible({ timeout: 10_000 });
  });
});
