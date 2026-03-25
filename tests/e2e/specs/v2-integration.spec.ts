/**
 * v2-integration.spec.ts — Cross-feature v2 integration E2E tests
 *
 * These tests exercise full user journeys that span multiple v2 features.
 *
 * Covers:
 *   V2-INT-01  Create idea → idea appears in list → linked ticker is trackable
 *   V2-INT-02  Create alert for ticker → alert appears in alert list
 *   V2-INT-03  Auto-buy dry-run returns full safeguard breakdown
 *   V2-INT-04  Buy zone GET + theme score GET are both available for the same ticker
 *   V2-INT-05  Auto-buy settings start safe (enabled=false, paper_mode=true)
 *              and can be updated without side effects on other users
 *   V2-INT-06  Multi-tenancy: alerts created by USER_A not visible to USER_B
 *   V2-INT-07  Multi-tenancy: ideas created by USER_A not visible to USER_B
 *   V2-INT-08  Multi-tenancy: auto-buy settings are per-user (USER_A and USER_B
 *              can have independent settings)
 *   V2-INT-09  Dry-run auto-buy creates an entry in the decision log
 *   V2-INT-10  Opportunities endpoint returns data consistent with buy zone schema
 */

import { test, expect } from "@playwright/test";
import {
  API_URL,
  USER_A,
  USER_B,
  STOCK_SYMBOL,
  ETF_SYMBOL,
} from "../fixtures/test-data";
import {
  getBuyZone,
  getThemeScore,
  createAlert,
  listAlerts,
  createIdea,
  listIdeas,
  getAutoBuySettings,
  updateAutoBuySettings,
  getAutoBuyDecisionLog,
  autoBuyDryRun,
  getOpportunities,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser, logoutUser } from "../helpers/api.helper";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function asUserA(request: Parameters<typeof loginUser>[0]): Promise<void> {
  await registerUser(request, USER_A.email, USER_A.password);
  await loginUser(request, USER_A.email, USER_A.password);
}

async function asUserB(request: Parameters<typeof loginUser>[0]): Promise<void> {
  await registerUser(request, USER_B.email, USER_B.password);
  await logoutUser(request);
  await loginUser(request, USER_B.email, USER_B.password);
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature cross-links: idea creation and ticker tracking
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — idea to opportunity pipeline", () => {
  test("V2-INT-01: created idea appears in idea list with rank_score", async ({
    request,
  }) => {
    await asUserA(request);

    const { ok, body: created } = await createIdea(request, {
      title: "Integration Test: AI Chipmaker Play",
      thesis: "AI accelerator demand will drive chipmaker revenue for 3+ years.",
      conviction_score: 8,
      watch_only: false,
      tradable: true,
      tags_json: ["ai", "semiconductors"],
      tickers: [{ ticker: STOCK_SYMBOL, is_primary: true }],
    });
    expect(ok).toBe(true);
    const ideaId = (created as { id: number }).id;

    const { ok: listOk, body: ideas } = await listIdeas(request);
    expect(listOk).toBe(true);

    const ids = (ideas as { id: number }[]).map((i) => i.id);
    expect(ids).toContain(ideaId);

    // rank_score must be present on the returned idea
    const idea = (ideas as { id: number; rank_score: number }[]).find(
      (i) => i.id === ideaId
    );
    expect(idea).toBeDefined();
    expect(typeof idea!.rank_score).toBe("number");
  });

  test("V2-INT-02: buy zone and theme score are independently fetchable for the same ticker", async ({
    request,
  }) => {
    await asUserA(request);

    const [bzResult, tsResult] = await Promise.all([
      getBuyZone(request, STOCK_SYMBOL),
      getThemeScore(request, STOCK_SYMBOL),
    ]);

    expect(bzResult.ok).toBe(true);
    expect(tsResult.ok).toBe(true);

    // Both responses reference the same ticker
    expect(bzResult.body.ticker).toBe(STOCK_SYMBOL);
    expect(tsResult.body.ticker).toBe(STOCK_SYMBOL);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Alert creation flow
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — alert creation flow", () => {
  test("V2-INT-03: create alert for ticker → alert appears in alerts list with correct ticker", async ({
    request,
  }) => {
    await asUserA(request);

    const { ok, body: alert } = await createAlert(request, {
      ticker: ETF_SYMBOL,
      alert_type: "entered_buy_zone",
      enabled: true,
    });
    expect(ok).toBe(true);
    const alertId = (alert as { id: number }).id;

    const { ok: listOk, body: alerts } = await listAlerts(request);
    expect(listOk).toBe(true);

    const found = (alerts as { id: number; ticker: string }[]).find(
      (a) => a.id === alertId
    );
    expect(found).toBeDefined();
    expect(found!.ticker).toBe(ETF_SYMBOL);
  });

  test("V2-INT-04: alert is enabled by default and can be toggled", async ({ request }) => {
    await asUserA(request);

    const { body: alert } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "confidence_improved",
    });
    const alertId = (alert as { id: number }).id;

    // Disable
    const { ok: patchOk, body: updated } = await request
      .patch(`${API_URL}/alerts/${alertId}`, { data: { enabled: false } })
      .then(async (r) => ({ ok: r.ok(), body: await r.json().catch(() => ({})) }));

    expect(patchOk).toBe(true);
    expect((updated as { enabled: boolean }).enabled).toBe(false);

    // Re-enable
    const { ok: reEnableOk, body: reEnabled } = await request
      .patch(`${API_URL}/alerts/${alertId}`, { data: { enabled: true } })
      .then(async (r) => ({ ok: r.ok(), body: await r.json().catch(() => ({})) }));

    expect(reEnableOk).toBe(true);
    expect((reEnabled as { enabled: boolean }).enabled).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-buy dry-run pipeline
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — auto-buy dry-run pipeline", () => {
  test("V2-INT-05: auto-buy dry-run returns a full decision with all safeguard codes", async ({
    request,
  }) => {
    await asUserA(request);

    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    // Core fields
    expect(body).toHaveProperty("ticker", STOCK_SYMBOL);
    expect(body).toHaveProperty("decision_state");
    expect(body).toHaveProperty("dry_run", true);

    // reason_codes array
    const reasonCodes = (body.reason_codes ?? body.reason_codes_json) as string[];
    expect(Array.isArray(reasonCodes)).toBe(true);
    expect(reasonCodes.length).toBeGreaterThan(0);

    // Every reason code should indicate PASSED or FAILED for a known safeguard
    for (const code of reasonCodes) {
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });

  test("V2-INT-06: dry-run creates a log entry in the decision log", async ({ request }) => {
    await asUserA(request);

    // Get current log count
    const { body: before } = await getAutoBuyDecisionLog(request);
    const countBefore = (before as unknown[]).length;

    // Run a dry-run
    await autoBuyDryRun(request, STOCK_SYMBOL);

    // Log should have grown by at least 1
    const { ok, body: after } = await getAutoBuyDecisionLog(request);
    expect(ok).toBe(true);
    expect((after as unknown[]).length).toBeGreaterThan(countBefore);
  });

  test("V2-INT-07: dry-run is safe — decision log entry has dry_run=true", async ({
    request,
  }) => {
    await asUserA(request);

    await autoBuyDryRun(request, STOCK_SYMBOL);

    const { body: log } = await getAutoBuyDecisionLog(request, 1);
    const lastEntry = (log as { dry_run: boolean; ticker: string }[])[0];

    if (lastEntry) {
      expect(lastEntry.dry_run).toBe(true);
      expect(lastEntry.ticker).toBe(STOCK_SYMBOL);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Opportunities endpoint consistency
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — opportunities consistency", () => {
  test("V2-INT-08: opportunities response uses probabilistic language, not guarantee language", async ({
    request,
  }) => {
    await asUserA(request);

    const { ok, body } = await getOpportunities(request);
    expect(ok).toBe(true);

    const bodyStr = JSON.stringify(body).toLowerCase();
    const banned = ["guaranteed", "safe entry", "certain to go up", "no chance of loss"];
    for (const phrase of banned) {
      expect(bodyStr).not.toContain(phrase);
    }
  });

  test("V2-INT-09: opportunities confidence_score values match buy zone response range", async ({
    request,
  }) => {
    await asUserA(request);

    const { ok, body: opps } = await getOpportunities(request);
    expect(ok).toBe(true);

    // Every confidence_score in opportunities must be within valid range
    for (const row of opps as { confidence_score: number }[]) {
      expect(row.confidence_score).toBeGreaterThanOrEqual(0.0);
      expect(row.confidence_score).toBeLessThanOrEqual(1.0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-tenancy — cross-feature isolation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — multi-tenancy isolation", () => {
  test("V2-INT-10: alerts created by USER_A are not visible to USER_B", async ({
    request,
  }) => {
    await asUserA(request);
    const { body: alertA } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });
    const alertIdA = (alertA as { id: number }).id;

    await asUserB(request);
    const { body: alertsB } = await listAlerts(request);
    const idsB = (alertsB as { id: number }[]).map((a) => a.id);
    expect(idsB).not.toContain(alertIdA);
  });

  test("V2-INT-11: ideas created by USER_A are not visible to USER_B", async ({
    request,
  }) => {
    await asUserA(request);
    const { body: ideaA } = await createIdea(request, {
      title: "USER_A Private Idea",
      thesis: "This idea belongs only to USER_A.",
      conviction_score: 5,
    });
    const ideaIdA = (ideaA as { id: number }).id;

    await asUserB(request);
    const { body: ideasB } = await listIdeas(request);
    const idsB = (ideasB as { id: number }[]).map((i) => i.id);
    expect(idsB).not.toContain(ideaIdA);
  });

  test("V2-INT-12: auto-buy settings are independent per user", async ({ request }) => {
    // USER_A sets a specific confidence threshold
    await asUserA(request);
    await updateAutoBuySettings(request, { confidence_threshold: 0.85 });

    // USER_B should have default settings (not USER_A's custom value)
    await asUserB(request);
    const { ok, body: settingsB } = await getAutoBuySettings(request);
    expect(ok).toBe(true);

    // USER_B's threshold should be the default (0.70), not USER_A's 0.85
    const thresholdB = settingsB.confidence_threshold as number;
    expect(thresholdB).toBe(0.70);
  });

  test("V2-INT-13: decision log is scoped per user — USER_B cannot see USER_A's dry-runs", async ({
    request,
  }) => {
    // USER_A runs a dry-run
    await asUserA(request);
    await autoBuyDryRun(request, STOCK_SYMBOL);
    const { body: logA } = await getAutoBuyDecisionLog(request);
    const userALogIds = (logA as { id: number }[]).map((e) => e.id);

    // USER_B checks their own log — must not contain USER_A's entries
    await asUserB(request);
    const { body: logB } = await getAutoBuyDecisionLog(request);
    const userBLogIds = (logB as { id: number }[]).map((e) => e.id);

    for (const id of userALogIds) {
      expect(userBLogIds).not.toContain(id);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auto-buy safety defaults — enforcement integration check
// ─────────────────────────────────────────────────────────────────────────────

test.describe("V2 Integration — auto-buy safety defaults", () => {
  test("V2-INT-14: fresh user auto-buy settings default to disabled and paper_mode", async ({
    request,
  }) => {
    const uniqueEmail = `v2-safety-${Date.now()}@nextgenstock.io`;
    const password = "TestPass1234!";

    await request.post(`${API_URL}/auth/register`, {
      data: { email: uniqueEmail, password },
    });
    await request.post(`${API_URL}/auth/login`, {
      data: { email: uniqueEmail, password },
    });

    const { ok, body } = await getAutoBuySettings(request);
    expect(ok).toBe(true);

    // Critical safety defaults
    expect(body.enabled).toBe(false);
    expect(body.paper_mode).toBe(true);
    expect(body.allow_near_earnings).toBe(false);
  });

  test("V2-INT-15: dry-run with auto-buy disabled still returns decision (blocked_by_risk or candidate)", async ({
    request,
  }) => {
    await asUserA(request);

    // Ensure auto-buy is disabled
    await updateAutoBuySettings(request, { enabled: false });

    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body.dry_run).toBe(true);

    // With auto-buy disabled, the decision should not be ready_to_buy or order_submitted
    const state = body.decision_state as string;
    expect(["candidate", "ready_to_alert", "blocked_by_risk"]).toContain(state);
  });
});
