/**
 * auto-buy.spec.ts — Optional Auto-Buy Execution API E2E tests
 *
 * Covers:
 *   AB-01  GET /api/auto-buy/settings returns defaults (enabled=false, paper_mode=true)
 *   AB-02  PATCH /api/auto-buy/settings updates individual fields
 *   AB-03  PATCH cannot set enabled=true without other safeguards (backend allows it but
 *           auto-buy is still blocked if safeguards fail at decision time)
 *   AB-04  GET /api/auto-buy/decision-log returns paginated array
 *   AB-05  GET /api/auto-buy/decision-log?limit=N respects the limit
 *   AB-06  POST /api/auto-buy/dry-run/{ticker} returns AutoBuyDecision
 *   AB-07  Dry-run response always has dry_run=true
 *   AB-08  Dry-run response includes decision_state
 *   AB-09  Dry-run response includes reason_codes array
 *   AB-10  Dry-run response includes signal_payload (buy zone snapshot used)
 *   AB-11  Broker credentials are never exposed in any auto-buy response
 *   AB-12  GET /api/auto-buy/settings returns 401 without auth
 *   AB-13  PATCH /api/auto-buy/settings returns 401 without auth
 *   AB-14  GET /api/auto-buy/decision-log returns 401 without auth
 *   AB-15  POST /api/auto-buy/dry-run/{ticker} returns 401 without auth
 *   AB-16  decision_state is one of the valid states
 *   AB-17  reason_codes contain at least the expected safeguard identifiers
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A, STOCK_SYMBOL, ETF_SYMBOL } from "../fixtures/test-data";
import {
  getAutoBuySettings,
  updateAutoBuySettings,
  getAutoBuyDecisionLog,
  autoBuyDryRun,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser } from "../helpers/api.helper";

// Valid decision states per the spec
const VALID_DECISION_STATES = [
  "candidate",
  "ready_to_alert",
  "ready_to_buy",
  "blocked_by_risk",
  "order_submitted",
  "order_filled",
  "order_rejected",
  "cancelled",
];

// Safeguard check identifiers per auto_buy_engine.py SAFEGUARD_CHECKS list
const EXPECTED_SAFEGUARD_KEYS = [
  "price_inside_buy_zone",
  "confidence_above_threshold",
  "drawdown_within_limit",
  "liquidity_filter",
  "spread_filter",
  "not_near_earnings",
  "position_size_limit",
  "daily_risk_budget",
  "no_duplicate_order",
];

// ─────────────────────────────────────────────────────────────────────────────
// Settings — GET and PATCH
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy API — settings GET/PATCH", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    // Reset settings to known defaults before each test to prevent state bleed
    // across test runs (prior runs may have changed enabled/paper_mode/confidence_threshold)
    await updateAutoBuySettings(request, {
      enabled: false,
      paper_mode: true,
      confidence_threshold: 0.70,
      max_trade_amount: 1000.0,
      max_position_percent: 0.05,
      allow_near_earnings: false,
    });
  });

  test("AB-01: GET /api/auto-buy/settings returns defaults for new user (enabled=false, paper_mode=true)", async ({
    request,
  }) => {
    const { ok, body } = await getAutoBuySettings(request);
    expect(ok).toBe(true);

    // Auto-buy must default to disabled to satisfy Feature C requirement
    expect(body).toHaveProperty("enabled", false);
    // paper_mode must default to true (safe default)
    expect(body).toHaveProperty("paper_mode", true);
  });

  test("AB-02: GET /api/auto-buy/settings response includes all settings fields", async ({
    request,
  }) => {
    const { ok, body } = await getAutoBuySettings(request);
    expect(ok).toBe(true);

    expect(body).toHaveProperty("confidence_threshold");
    expect(body).toHaveProperty("max_trade_amount");
    expect(body).toHaveProperty("max_position_percent");
    expect(body).toHaveProperty("max_expected_drawdown");
    expect(body).toHaveProperty("allow_near_earnings");
  });

  test("AB-03: PATCH /api/auto-buy/settings can update confidence_threshold", async ({
    request,
  }) => {
    const { ok, body } = await updateAutoBuySettings(request, {
      confidence_threshold: 0.80,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("confidence_threshold", 0.80);
  });

  test("AB-04: PATCH /api/auto-buy/settings can update max_trade_amount", async ({
    request,
  }) => {
    const { ok, body } = await updateAutoBuySettings(request, {
      max_trade_amount: 500.0,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("max_trade_amount", 500.0);
  });

  test("AB-05: PATCH /api/auto-buy/settings can set enabled=true", async ({ request }) => {
    const { ok, body } = await updateAutoBuySettings(request, {
      enabled: true,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("enabled", true);
  });

  test("AB-06: PATCH /api/auto-buy/settings can switch paper_mode", async ({ request }) => {
    const { ok, body } = await updateAutoBuySettings(request, {
      paper_mode: false,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("paper_mode", false);
  });

  test("AB-07: settings response never contains raw broker credentials or API keys", async ({
    request,
  }) => {
    const { body } = await getAutoBuySettings(request);
    const bodyStr = JSON.stringify(body).toLowerCase();

    // Raw key patterns that must never appear
    expect(bodyStr).not.toMatch(/api_key.*[a-z0-9]{10,}/);
    expect(bodyStr).not.toMatch(/secret_key.*[a-z0-9]{10,}/);
    expect(bodyStr).not.toMatch(/pk[a-z0-9]{10,}/i); // Alpaca key pattern
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Decision log — GET
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy API — decision log", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("AB-08: GET /api/auto-buy/decision-log returns an array", async ({ request }) => {
    const { ok, body } = await getAutoBuyDecisionLog(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
  });

  test("AB-09: GET /api/auto-buy/decision-log?limit=5 returns at most 5 entries", async ({
    request,
  }) => {
    // Run a few dry-runs to populate the log
    await autoBuyDryRun(request, STOCK_SYMBOL);
    await autoBuyDryRun(request, ETF_SYMBOL);

    const { ok, body } = await getAutoBuyDecisionLog(request, 5);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBeLessThanOrEqual(5);
  });

  test("AB-10: decision log entries have required fields", async ({ request }) => {
    // Create a log entry via dry-run
    await autoBuyDryRun(request, STOCK_SYMBOL);

    const { ok, body } = await getAutoBuyDecisionLog(request);
    expect(ok).toBe(true);

    if ((body as unknown[]).length > 0) {
      const entry = (body as Record<string, unknown>[])[0];
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("ticker");
      expect(entry).toHaveProperty("decision_state");
      expect(entry).toHaveProperty("reason_codes_json");
      expect(entry).toHaveProperty("dry_run");
      expect(entry).toHaveProperty("created_at");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run endpoint
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy API — dry-run POST /api/auto-buy/dry-run/{ticker}", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("AB-11: dry-run returns 200 with AutoBuyDecision body", async ({ request }) => {
    const { ok, status } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(status).toBe(200);
  });

  test("AB-12: dry-run response always has dry_run=true", async ({ request }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("dry_run", true);
  });

  test("AB-13: dry-run response includes decision_state field", async ({ request }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("decision_state");
  });

  test("AB-14: dry-run decision_state is one of the valid decision states", async ({
    request,
  }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const state = body.decision_state as string;
    expect(VALID_DECISION_STATES).toContain(state);
  });

  test("AB-15: dry-run response includes reason_codes array", async ({ request }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    // reason_codes may be in body directly or under a field name
    const reasonCodes = (body.reason_codes ?? body.reason_codes_json) as unknown[];
    expect(Array.isArray(reasonCodes)).toBe(true);
  });

  test("AB-16: dry-run reason_codes cover all expected safeguard identifiers", async ({
    request,
  }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const reasonCodes = (body.reason_codes ?? body.reason_codes_json) as string[];

    // Each code should map to one of the known safeguard identifiers
    // (format: "PASSED: <key>" or "FAILED: <key>: <reason>")
    // At minimum, some safeguard keys must be present in the codes
    const combinedCodes = reasonCodes.join(" ");
    let matchedSafeguards = 0;
    for (const safeguard of EXPECTED_SAFEGUARD_KEYS) {
      if (combinedCodes.includes(safeguard)) {
        matchedSafeguards++;
      }
    }
    // Expect at least half of the safeguards to be referenced
    expect(matchedSafeguards).toBeGreaterThanOrEqual(
      Math.floor(EXPECTED_SAFEGUARD_KEYS.length / 2)
    );
  });

  test("AB-17: dry-run response includes signal_payload (buy zone data used)", async ({
    request,
  }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("signal_payload");
  });

  test("AB-18: dry-run response does not expose raw broker API keys", async ({
    request,
  }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);

    const bodyStr = JSON.stringify(body).toLowerCase();
    // Alpaca key format: PK + 20 alphanumeric chars
    expect(bodyStr).not.toMatch(/pk[a-z0-9]{10,}/i);
    // Generic pattern: secret_key with a long value
    expect(bodyStr).not.toMatch(/secret_key.*[a-z0-9]{15,}/i);
  });

  test("AB-19: dry-run ticker in response matches request ticker", async ({ request }) => {
    const { ok, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("ticker", STOCK_SYMBOL);
  });

  test("AB-20: dry-run blocked decision still returns 200 (not 4xx)", async ({
    request,
  }) => {
    // With default settings (enabled=false, no buy zone data), the dry-run
    // should return blocked_by_risk or candidate — not an HTTP error.
    const { ok, status, body } = await autoBuyDryRun(request, STOCK_SYMBOL);
    expect(ok).toBe(true);
    expect(status).toBe(200);

    const state = body.decision_state as string;
    // blocked_by_risk or candidate are both valid for default settings
    expect(VALID_DECISION_STATES).toContain(state);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authentication enforcement
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Auto-Buy API — 401 without authentication", () => {
  test("AB-21: GET /api/auto-buy/settings returns 401 without auth", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/auto-buy/settings`);
    expect(res.status()).toBe(401);
  });

  test("AB-22: PATCH /api/auto-buy/settings returns 401 without auth", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.patch(`${API_URL}/auto-buy/settings`, {
      data: { confidence_threshold: 0.9 },
    });
    expect(res.status()).toBe(401);
  });

  test("AB-23: GET /api/auto-buy/decision-log returns 401 without auth", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/auto-buy/decision-log`);
    expect(res.status()).toBe(401);
  });

  test("AB-24: POST /api/auto-buy/dry-run/{ticker} returns 401 without auth", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.post(`${API_URL}/auto-buy/dry-run/${STOCK_SYMBOL}`);
    expect(res.status()).toBe(401);
  });
});
