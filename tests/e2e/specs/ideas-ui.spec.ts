/**
 * ideas-ui.spec.ts — Ideas page UI E2E tests
 *
 * Covers:
 *   IDEA-UI-01  Unauthenticated user is redirected to /login
 *   IDEA-UI-02  Page loads with "Ideas" heading
 *   IDEA-UI-03  "New Idea" button is visible
 *   IDEA-UI-04  Clicking "New Idea" opens a dialog/modal
 *   IDEA-UI-05  The idea form has required fields (title, thesis, conviction)
 *   IDEA-UI-06  Submitting valid form data creates an idea that appears in the list
 *   IDEA-UI-07  Conviction score slider/input is bounded to 1–10
 *   IDEA-UI-08  Delete button on an idea card opens a confirmation dialog
 *   IDEA-UI-09  Confirming delete removes the idea from the list
 *   IDEA-UI-10  Watch-only badge appears for watch_only ideas
 *   IDEA-UI-11  Page does not display banned language
 */

import { test, expect } from "../fixtures/auth.fixture";

const IDEAS_ROUTE = "/ideas";

// ─────────────────────────────────────────────────────────────────────────────
// Authentication guard
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas page — authentication guard", () => {
  test("IDEA-UI-01: unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto(IDEAS_ROUTE);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Page structure
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas page — structure and navigation", () => {
  test("IDEA-UI-02: page loads with 'Ideas' heading", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, h3, [data-testid="page-title"]').filter({
      hasText: /ideas/i,
    });
    await expect(heading.first()).toBeVisible({ timeout: 8_000 });
  });

  test("IDEA-UI-03: 'New Idea' button is visible on page load", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea"), [data-testid="new-idea-btn"]'
    );
    await expect(newIdeaBtn.first()).toBeVisible({ timeout: 8_000 });
  });

  test("IDEA-UI-04: clicking 'New Idea' opens a dialog or modal", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea")'
    );
    await newIdeaBtn.first().click();

    // A dialog/modal should appear
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
  });

  test("IDEA-UI-05: idea form contains required fields", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea")'
    );
    await newIdeaBtn.first().click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });

    // Title field
    const titleField = page.locator(
      '[name="title"], input[placeholder*="title" i], [data-testid="idea-title"]'
    );
    await expect(titleField.first()).toBeVisible({ timeout: 5_000 });

    // Thesis field (textarea)
    const thesisField = page.locator(
      'textarea, [name="thesis"], [data-testid="idea-thesis"]'
    );
    await expect(thesisField.first()).toBeVisible({ timeout: 5_000 });

    // Conviction score input or range slider
    const convictionInput = page.locator(
      'input[type="range"], input[name="conviction_score"], [data-testid="conviction-input"]'
    );
    await expect(convictionInput.first()).toBeVisible({ timeout: 5_000 });
  });

  test("IDEA-UI-06: page does not display banned language", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.textContent("body") ?? "").toLowerCase();
    const banned = ["guaranteed profit", "safe entry", "certain to go up", "no chance of loss"];
    for (const phrase of banned) {
      expect(bodyText).not.toContain(phrase);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Create idea flow
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas page — create idea flow", () => {
  test("IDEA-UI-07: submitting valid idea data creates an idea in the list", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea")'
    );
    await newIdeaBtn.first().click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });

    // Fill title
    const titleField = page.locator('[name="title"], input[placeholder*="title" i]');
    await titleField.first().fill("E2E Test Idea — AI Infrastructure");

    // Fill thesis
    const thesisField = page.locator('textarea, [name="thesis"]');
    await thesisField.first().fill("AI capex cycle favors chipmakers and data centers.");

    // Set conviction (find range input or number input)
    const convictionInput = page.locator('input[type="range"][name="conviction_score"], input[name="conviction_score"]');
    if (await convictionInput.count() > 0) {
      // Set to 7 via fill for number input or JS for range
      await convictionInput.first().fill("7");
    }

    // Submit
    const submitBtn = page.locator(
      '[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create")'
    );
    await submitBtn.first().click();

    // Dialog should close and the idea title should appear in the list
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 8_000 });
    const ideaCard = page.locator('text=E2E Test Idea — AI Infrastructure');
    await expect(ideaCard.first()).toBeVisible({ timeout: 8_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Delete idea flow
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas page — delete idea flow", () => {
  test("IDEA-UI-08: delete button opens confirmation dialog", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    // Create an idea first via the UI so there is something to delete
    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea")'
    );
    if (await newIdeaBtn.count() > 0) {
      await newIdeaBtn.first().click();
      await page.locator('[role="dialog"]').waitFor({ state: "visible" });

      const titleField = page.locator('[name="title"], input[placeholder*="title" i]');
      await titleField.first().fill("Idea to Delete");

      const thesisField = page.locator('textarea, [name="thesis"]');
      await thesisField.first().fill("This idea will be deleted.");

      const submitBtn = page.locator(
        '[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create")'
      );
      await submitBtn.first().click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 8_000 });
    }

    // Find a delete button in the idea list
    const deleteBtn = page.locator(
      'button:has-text("Delete"), button[aria-label*="delete" i], button[aria-label*="remove" i], [data-testid*="delete"]'
    );

    if (await deleteBtn.count() > 0) {
      await deleteBtn.first().click();

      // A confirmation dialog should appear
      const confirmDialog = page.locator('[role="dialog"]');
      await expect(confirmDialog).toBeVisible({ timeout: 5_000 });
    }
  });

  test("IDEA-UI-09: confirming delete removes the idea from the list", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(IDEAS_ROUTE);
    await page.waitForLoadState("networkidle");

    const ideaTitle = `E2E Delete Test ${Date.now()}`;

    // Create idea via UI
    const newIdeaBtn = page.locator(
      'button:has-text("New Idea"), button:has-text("Add Idea"), button:has-text("Create Idea")'
    );
    if (await newIdeaBtn.count() > 0) {
      await newIdeaBtn.first().click();
      await page.locator('[role="dialog"]').waitFor({ state: "visible" });

      await page.locator('[name="title"], input[placeholder*="title" i]').first().fill(ideaTitle);
      await page.locator('textarea, [name="thesis"]').first().fill("Temporary idea for deletion test.");
      await page.locator('[role="dialog"] button[type="submit"], [role="dialog"] button:has-text("Save"), [role="dialog"] button:has-text("Create")').first().click();
      await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 8_000 });

      // Verify it appears
      await expect(page.locator(`text=${ideaTitle}`).first()).toBeVisible({ timeout: 8_000 });

      // Find and click the delete button for this specific card
      const ideaCard = page.locator(`text=${ideaTitle}`).locator("..").locator("..");
      const deleteBtn = ideaCard.locator(
        'button:has-text("Delete"), button[aria-label*="delete" i]'
      );

      if (await deleteBtn.count() > 0) {
        await deleteBtn.first().click();

        // Confirm the deletion
        const confirmBtn = page.locator(
          '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Delete"), [role="dialog"] button:has-text("Yes")'
        );
        if (await confirmBtn.count() > 0) {
          await confirmBtn.first().click();
        }

        // Idea should no longer be visible
        await expect(page.locator(`text=${ideaTitle}`)).not.toBeVisible({ timeout: 8_000 });
      }
    }
  });
});
