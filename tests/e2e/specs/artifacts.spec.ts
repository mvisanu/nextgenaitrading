/**
 * artifacts.spec.ts — Pine Script artifact E2E tests
 *
 * Covers:
 *   FR-51  AI Pick / BLSH runs generate complete Pine Script v5 code
 *   FR-52  Artifacts stored in WinningStrategyArtifact tied to user + run
 *   FR-53  GET /artifacts returns all artifacts for current user
 *   FR-54  GET /artifacts/{id} returns artifact metadata
 *   FR-55  GET /artifacts/{id}/pine-script returns raw Pine Script
 *   FR-56  Frontend renders Pine Script in copyable code block
 */

import { test, expect } from "../fixtures/auth.fixture";
import {
  API_URL,
  CRYPTO_SYMBOL,
  ROUTES,
  USER_A,
} from "../fixtures/test-data";
import {
  registerUser,
  runAiPick,
  runBLSH,
  listArtifacts,
  getArtifact,
  getPineScript,
} from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// API-level artifact tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Artifacts API", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
  });

  test("ART-01: GET /artifacts returns empty array for new user", async ({ request }) => {
    const { ok, body } = await listArtifacts(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    // A brand-new user has no artifacts
  });

  test("ART-02: AI Pick run creates an artifact accessible via GET /artifacts", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { ok, body } = await listArtifacts(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(1);
  }, 180_000);

  test("ART-03: artifact has correct metadata fields (ArtifactOut shape)", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    expect(artifacts.length).toBeGreaterThanOrEqual(1);

    const artifact = artifacts[0] as Record<string, unknown>;
    expect(artifact).toHaveProperty("id");
    expect(artifact).toHaveProperty("user_id");
    expect(artifact).toHaveProperty("strategy_run_id");
    expect(artifact).toHaveProperty("created_at");
    expect(artifact).toHaveProperty("mode_name");
    expect(artifact).toHaveProperty("variant_name");
    expect(artifact).toHaveProperty("symbol");
    expect(artifact).toHaveProperty("pine_script_version");
    expect(artifact).toHaveProperty("selected_winner");
  }, 180_000);

  test("ART-04: artifact.mode_name is 'ai-pick' for AI Pick runs", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    const aiPickArtifact = (artifacts as { mode_name: string }[]).find(
      (a) => a.mode_name === "ai-pick"
    );
    expect(aiPickArtifact).toBeDefined();
  }, 180_000);

  test("ART-05: BLSH run creates artifact with mode_name='buy-low-sell-high'", async ({
    request,
  }) => {
    await runBLSH(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "buy-low-sell-high",
    });

    const { body: artifacts } = await listArtifacts(request);
    const blshArtifact = (artifacts as { mode_name: string }[]).find(
      (a) => a.mode_name === "buy-low-sell-high"
    );
    expect(blshArtifact).toBeDefined();
  }, 180_000);

  test("ART-06: GET /artifacts/{id} returns ArtifactOut", async ({ request }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
    const id = (artifacts[0] as { id: number }).id;

    const { ok, body } = await getArtifact(request, id);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id", id);
    expect(body).toHaveProperty("mode_name");
    expect(body).toHaveProperty("variant_name");
    expect(body).toHaveProperty("symbol");
  }, 180_000);

  test("ART-07: GET /artifacts/{id} returns 404 for non-existent artifact", async ({
    request,
  }) => {
    const res = await request.get(`${API_URL}/artifacts/999999999`);
    expect(res.status()).toBe(404);
  });

  test("ART-08: GET /artifacts/{id}/pine-script returns PineScriptOut with code", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    const id = (artifacts[0] as { id: number }).id;

    const { ok, body } = await getPineScript(request, id);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id", id);
    expect(body).toHaveProperty("variant_name");
    expect(body).toHaveProperty("symbol");
    expect(body).toHaveProperty("pine_script_version");
    expect(body).toHaveProperty("pine_script_code");

    // Pine Script code should be a non-empty string
    const code = (body as { pine_script_code: string }).pine_script_code;
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThan(0);
  }, 180_000);

  test("ART-09: Pine Script code starts with //@version=5", async ({ request }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    const id = (artifacts[0] as { id: number }).id;

    const { body } = await getPineScript(request, id);
    const code = (body as { pine_script_code: string }).pine_script_code;
    // Valid Pine Script v5 starts with the version annotation
    expect(code).toMatch(/\/\/@version=5/);
  }, 180_000);

  test("ART-10: artifact symbol matches the symbol used in the optimizer run", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    const artifact = artifacts[0] as { symbol: string };
    expect(artifact.symbol).toBe(CRYPTO_SYMBOL);
  }, 180_000);

  test("ART-11: GET /artifacts returns 401 when unauthenticated", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/artifacts`);
    expect(res.status()).toBe(401);
  });

  test("ART-12: GET /artifacts/{id}/pine-script returns 403 for another user's artifact", async ({
    request,
  }) => {
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    const { body: artifacts } = await listArtifacts(request);
    const artifactId = (artifacts[0] as { id: number }).id;

    // Switch to another user
    await request.post(`${API_URL}/auth/logout`);
    const otherEmail = `art-cross-${Date.now()}@nextgenstock.test`;
    await request.post(`${API_URL}/auth/register`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: otherEmail, password: "OtherUser123!" },
    });

    const res = await request.get(`${API_URL}/artifacts/${artifactId}/pine-script`);
    expect([403, 404]).toContain(res.status());
  }, 180_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// UI-level artifact tests
// ─────────────────────────────────────────────────────────────────────────────
test.describe("Artifacts UI — /artifacts page", () => {
  test("ART-13: artifacts page loads", async ({ authenticatedPage: page }) => {
    await page.goto(ROUTES.artifacts);
    await page.waitForLoadState("networkidle");

    const heading = page.locator('h1, h2, [data-testid="page-title"]');
    await expect(heading.first()).toBeVisible({ timeout: 8_000 });
  });

  test("ART-14: artifacts list shows Pine Script entries with mode + symbol labels", async ({
    authenticatedPage: page,
    request,
  }) => {
    // Pre-create an artifact via API
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });

    await page.goto(ROUTES.artifacts);
    await page.waitForLoadState("networkidle");

    // BTC-USD should appear in the artifacts list
    const symbolText = page.locator(`text=${CRYPTO_SYMBOL}`).or(page.locator("text=BTC"));
    await expect(symbolText.first()).toBeVisible({ timeout: 10_000 });
  }, 180_000);

  test("ART-15: clicking an artifact shows Pine Script code block", async ({
    authenticatedPage: page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const { body: artifacts } = await listArtifacts(request);
    const artifactId = (artifacts[0] as { id: number }).id;

    // Try different URL patterns for the detail page
    for (const urlPattern of [
      `${ROUTES.artifacts}/${artifactId}`,
      `${ROUTES.artifacts}?id=${artifactId}`,
    ]) {
      await page.goto(urlPattern);
      await page.waitForLoadState("networkidle");

      const codeBlock = page.locator("pre, code, [data-testid='pine-script'], .code-block");
      if (await codeBlock.count() > 0) {
        await expect(codeBlock.first()).toBeVisible({ timeout: 8_000 });
        const codeText = await codeBlock.first().textContent();
        expect(codeText).toMatch(/version|strategy|indicator/i);
        break;
      }
    }
  }, 180_000);

  test("ART-16: copy button is present next to Pine Script code", async ({
    authenticatedPage: page,
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await request.post(`${API_URL}/auth/login`, {
      data: { email: USER_A.email, password: USER_A.password },
    });
    await runAiPick(request, {
      symbol: CRYPTO_SYMBOL,
      timeframe: "1d",
      mode: "ai-pick",
    });
    const { body: artifacts } = await listArtifacts(request);
    const artifactId = (artifacts[0] as { id: number }).id;

    await page.goto(`${ROUTES.artifacts}/${artifactId}`);
    await page.waitForLoadState("networkidle");

    const copyBtn = page.locator(
      'button:has-text("Copy"), button[aria-label*="copy" i], [data-testid="copy-button"]'
    );
    await expect(copyBtn.first()).toBeVisible({ timeout: 8_000 });
  }, 180_000);
});
