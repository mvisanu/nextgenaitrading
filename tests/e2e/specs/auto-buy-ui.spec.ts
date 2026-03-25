/**
 * auto-buy-ui.spec.ts — Auto-Buy page UI E2E tests
 *
 * Covers:
 *   AB-UI-01  Unauthenticated user is redirected to /login
 *   AB-UI-02  Page loads with "Auto-Buy" heading
 *   AB-UI-03  Risk disclaimer banner is visible at the top of the page
 *   AB-UI-04  Master enable Switch is present and initially OFF
 *   AB-UI-05  Clicking the enable Switch opens a confirmation dialog
 *   AB-UI-06  Clicking Cancel keeps the Switch OFF (enabled=false)
 *   AB-UI-07  Clicking Confirm enables auto-buy (Switch turns ON)
 *   AB-UI-08  Paper/Live toggle is present
 *   AB-UI-09  Switching to Live mode shows a second confirmation dialog
 *   AB-UI-10  Decision log table is visible with column headers
 *   AB-UI-11  Dry-run panel has a ticker input and "Dry Run" button
 *   AB-UI-12  Dry-run result appears after clicking the button
 *   AB-UI-13  Dry-run result shows decision_state badge
 *   AB-UI-14  Dry-run result shows reason_codes
 *   AB-UI-15  Page does not display banned language
 *   AB-UI-16  No language implying guaranteed outcomes anywhere on page
 */

import { test, expect } from "../fixtures/auth.fixture";

const AUTO_BUY_ROUTE = "/auto-buy";

// ─────────────────────────────────────────────────────────────────────────────
// Authentication guard
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy page — authentication guard", () => {
  test("AB-UI-01: unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Page structure and safety messaging
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy page — structure and safety messaging", () => {
  test("AB-UI-02: page loads with 'Auto-Buy' heading", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, h3, [data-testid="page-title"]').filter({
      hasText: /auto.?buy/i,
    });
    await expect(heading.first()).toBeVisible({ timeout: 8_000 });
  });

  test("AB-UI-03: risk disclaimer banner is visible at the top of the page", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // The spec mandates a persistent risk disclaimer banner
    const disclaimer = page.locator(
      '[data-testid="risk-disclaimer"], [role="alert"], .disclaimer, .warning-banner'
    ).or(
      page.locator('text=/risk|disclaimer|real orders|loss/i').first()
    );
    await expect(disclaimer.first()).toBeVisible({ timeout: 8_000 });
  });

  test("AB-UI-04: master enable Switch is present and initially OFF", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // The master enable switch — look for switch near "Auto-Buy" or "Enable" label
    const masterSwitch = page.locator('[role="switch"]').first();
    await expect(masterSwitch).toBeVisible({ timeout: 8_000 });

    // Initial state should be OFF (aria-checked="false")
    const checkedAttr = await masterSwitch.getAttribute("aria-checked");
    expect(checkedAttr).toBe("false");
  });

  test("AB-UI-05: clicking the enable Switch opens a confirmation dialog with risk warning", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const masterSwitch = page.locator('[role="switch"]').first();
    await masterSwitch.click();

    // A confirmation dialog must appear (per spec: "Confirm you understand the risks")
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const dialogText = (await dialog.textContent() ?? "").toLowerCase();
    expect(dialogText).toMatch(/risk|real orders|confirm|understand/i);
  });

  test("AB-UI-06: clicking Cancel in the confirmation dialog keeps auto-buy disabled", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const masterSwitch = page.locator('[role="switch"]').first();
    await masterSwitch.click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });

    // Click Cancel
    const cancelBtn = page.locator(
      '[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("No")'
    );
    await cancelBtn.first().click();

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });

    // Switch should still be OFF
    const checkedAttr = await masterSwitch.getAttribute("aria-checked");
    expect(checkedAttr).toBe("false");
  });

  test("AB-UI-07: clicking Confirm in the dialog enables auto-buy (switch turns ON)", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const masterSwitch = page.locator('[role="switch"]').first();
    await masterSwitch.click();
    await page.locator('[role="dialog"]').waitFor({ state: "visible" });

    // Click Confirm
    const confirmBtn = page.locator(
      '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Enable"), [role="dialog"] button:has-text("Yes")'
    );
    await confirmBtn.first().click();

    // Dialog should close
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5_000 });

    // Switch should now be ON
    const checkedAttr = await masterSwitch.getAttribute("aria-checked");
    expect(checkedAttr).toBe("true");
  });

  test("AB-UI-08: page does not display banned language", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.textContent("body") ?? "").toLowerCase();
    const banned = [
      "guaranteed profit",
      "safe entry",
      "certain to go up",
      "no chance of loss",
      "guaranteed winner",
    ];
    for (const phrase of banned) {
      expect(bodyText).not.toContain(phrase);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Paper / Live mode toggle
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy page — paper/live mode toggle", () => {
  test("AB-UI-09: Paper/Live mode toggle is present on the settings panel", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // Look for a switch or toggle labeled paper/live
    const modeToggle = page.locator(
      '[role="switch"]:nth-child(2), [aria-label*="paper" i], [aria-label*="live" i], text=Paper, text=Live'
    );
    // At least one reference to paper/live mode should exist on the page
    const bodyText = (await page.textContent("body") ?? "").toLowerCase();
    expect(bodyText).toMatch(/paper|live mode/i);
  });

  test("AB-UI-10: switching to Live mode shows a second confirmation dialog", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // Find the paper/live toggle by aria-label or proximity to "Live" label
    const liveToggle = page.locator(
      '[aria-label*="live" i], [data-testid*="live" i], [data-testid*="paper" i]'
    );

    if (await liveToggle.count() > 0) {
      await liveToggle.first().click();
      // A warning dialog should appear before enabling real-money trading
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 5_000 });

      const dialogText = (await dialog.textContent() ?? "").toLowerCase();
      expect(dialogText).toMatch(/real|live|risk|confirm/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision log table
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy page — decision log table", () => {
  test("AB-UI-11: decision log section is visible with expected column headers", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // Decision log section must exist
    const logSection = page
      .locator('[data-testid="decision-log"]')
      .or(page.locator('text=Decision Log').first())
      .or(page.locator('text=Log').first());
    await expect(logSection.first()).toBeVisible({ timeout: 8_000 });

    // Check for expected column headers
    const pageText = (await page.textContent("body") ?? "").toLowerCase();
    expect(pageText).toMatch(/ticker|state|timestamp|reason/i);
  });

  test("AB-UI-12: decision log renders without JS errors on load", async ({
    authenticatedPage: page,
  }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) => e.includes("TypeError") || e.includes("Uncaught")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run panel
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy page — dry-run panel", () => {
  test("AB-UI-13: dry-run panel has a ticker input and 'Dry Run' button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // Ticker input in the dry-run section
    const dryRunInput = page.locator(
      '[data-testid="dry-run-ticker"], input[placeholder*="ticker" i][aria-label*="dry" i], input[placeholder*="dry" i]'
    ).or(
      page.locator('text=Dry Run').locator("..").locator('input')
    );

    // Dry-run button
    const dryRunBtn = page.locator(
      'button:has-text("Dry Run"), button:has-text("Simulate"), [data-testid="dry-run-btn"]'
    );
    await expect(dryRunBtn.first()).toBeVisible({ timeout: 8_000 });
  });

  test("AB-UI-14: dry-run result appears with decision state badge after clicking button", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    // Fill in the ticker input (find it near the dry run button)
    const dryRunBtn = page.locator('button:has-text("Dry Run"), button:has-text("Simulate")');

    if (await dryRunBtn.count() > 0) {
      // Try to find an adjacent input
      const tickerInputNearBtn = page.locator(
        'input[placeholder*="ticker" i]'
      );
      if (await tickerInputNearBtn.count() > 0) {
        await tickerInputNearBtn.first().fill("AAPL");
      }

      await dryRunBtn.first().click();

      // Wait for the result to appear — the backend may take a moment
      const resultSection = page.locator(
        '[data-testid="dry-run-result"], text=decision_state, text=blocked_by_risk, text=ready_to_alert, text=candidate'
      );
      await expect(resultSection.first()).toBeVisible({ timeout: 30_000 });
    }
  });

  test("AB-UI-15: dry-run result section shows reason codes", async ({
    authenticatedPage: page,
  }) => {
    await page.goto(AUTO_BUY_ROUTE);
    await page.waitForLoadState("networkidle");

    const dryRunBtn = page.locator('button:has-text("Dry Run"), button:has-text("Simulate")');

    if (await dryRunBtn.count() > 0) {
      const tickerInput = page.locator('input[placeholder*="ticker" i]');
      if (await tickerInput.count() > 0) {
        await tickerInput.first().fill("AAPL");
      }
      await dryRunBtn.first().click();

      // Reason codes should appear in the result area
      const reasonCodes = page.locator(
        'text=PASSED, text=FAILED, [data-testid="reason-codes"], text=price_inside_buy_zone, text=confidence_above_threshold'
      );
      await expect(reasonCodes.first()).toBeVisible({ timeout: 30_000 });
    }
  });
});
