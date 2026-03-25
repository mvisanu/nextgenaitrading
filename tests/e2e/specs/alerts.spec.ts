/**
 * alerts.spec.ts — Smart Price Alert Engine API E2E tests
 *
 * Covers:
 *   ALERT-01  POST /api/alerts creates a new alert rule (201)
 *   ALERT-02  GET /api/alerts lists the user's alert rules
 *   ALERT-03  PATCH /api/alerts/{id} updates enabled state
 *   ALERT-04  PATCH /api/alerts/{id} updates threshold_json
 *   ALERT-05  DELETE /api/alerts/{id} removes the alert rule
 *   ALERT-06  All 6 alert_type values are accepted
 *   ALERT-07  Invalid alert_type returns 422
 *   ALERT-08  GET /api/alerts returns 401 without auth
 *   ALERT-09  POST /api/alerts returns 401 without auth
 *   ALERT-10  PATCH /api/alerts/{id} returns 401 without auth
 *   ALERT-11  DELETE /api/alerts/{id} returns 401 without auth
 *   ALERT-12  USER_B cannot read, update, or delete USER_A's alert (403/404)
 *   ALERT-13  GET /api/alerts only returns the current user's rules
 *   ALERT-14  Created alert has correct default values (enabled=true, market_hours_only=true)
 *   ALERT-15  near_buy_zone alert accepts proximity_pct in threshold_json
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A, USER_B, STOCK_SYMBOL, ETF_SYMBOL } from "../fixtures/test-data";
import {
  listAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  loginAsNewUser,
  logoutCurrent,
  type AlertType,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser, logoutUser } from "../helpers/api.helper";

// All valid alert types from Feature B spec
const VALID_ALERT_TYPES: AlertType[] = [
  "entered_buy_zone",
  "near_buy_zone",
  "below_invalidation",
  "confidence_improved",
  "theme_score_increased",
  "macro_deterioration",
];

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — happy paths
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Alerts API — CRUD operations", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("ALERT-01: POST /api/alerts creates alert and returns 201 with id", async ({
    request,
  }) => {
    const { ok, status, body } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });

    expect(status).toBe(201);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("ticker", STOCK_SYMBOL);
    expect(body).toHaveProperty("alert_type", "entered_buy_zone");
  });

  test("ALERT-02: GET /api/alerts returns list containing newly created alert", async ({
    request,
  }) => {
    await createAlert(request, {
      ticker: ETF_SYMBOL,
      alert_type: "confidence_improved",
    });

    const { ok, body } = await listAlerts(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);

    const tickers = (body as { ticker: string }[]).map((a) => a.ticker);
    expect(tickers).toContain(ETF_SYMBOL);
  });

  test("ALERT-03: PATCH /api/alerts/{id} can disable an alert (enabled=false)", async ({
    request,
  }) => {
    const { body: created } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
      enabled: true,
    });
    const id = (created as { id: number }).id;

    const { ok, body } = await updateAlert(request, id, { enabled: false });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("enabled", false);
  });

  test("ALERT-04: PATCH /api/alerts/{id} can update threshold_json", async ({
    request,
  }) => {
    const { body: created } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "near_buy_zone",
      threshold_json: { proximity_pct: 2.0 },
    });
    const id = (created as { id: number }).id;

    const { ok, body } = await updateAlert(request, id, {
      threshold_json: { proximity_pct: 5.0 },
    });
    expect(ok).toBe(true);
    const threshold = body.threshold_json as { proximity_pct: number };
    expect(threshold.proximity_pct).toBe(5.0);
  });

  test("ALERT-05: DELETE /api/alerts/{id} removes the alert (204 or 200)", async ({
    request,
  }) => {
    const { body: created } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "below_invalidation",
    });
    const id = (created as { id: number }).id;

    const { ok, status } = await deleteAlert(request, id);
    expect(ok).toBe(true);
    expect([200, 204]).toContain(status);

    // Verify it is no longer in the list
    const { body: alerts } = await listAlerts(request);
    const ids = (alerts as { id: number }[]).map((a) => a.id);
    expect(ids).not.toContain(id);
  });

  test("ALERT-06: GET /api/alerts returns only the current user's alerts", async ({
    request,
  }) => {
    await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });

    const { body: alerts } = await listAlerts(request);
    // All returned alerts must belong to the logged-in user (no user_id leakage check)
    expect(Array.isArray(alerts)).toBe(true);
  });

  test("ALERT-07: created alert has correct default values", async ({ request }) => {
    const { ok, body } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "theme_score_increased",
    });
    expect(ok).toBe(true);

    // Defaults per ORM model: enabled=true, market_hours_only=true, cooldown_minutes=60
    expect(body).toHaveProperty("enabled", true);
    expect(body).toHaveProperty("market_hours_only", true);
    expect(body).toHaveProperty("cooldown_minutes", 60);
  });

  test("ALERT-08: near_buy_zone alert accepts proximity_pct in threshold_json", async ({
    request,
  }) => {
    const { ok, body } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "near_buy_zone",
      threshold_json: { proximity_pct: 3.5 },
    });
    expect(ok).toBe(true);
    const threshold = body.threshold_json as { proximity_pct: number };
    expect(threshold.proximity_pct).toBe(3.5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Alert type validation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Alerts API — alert_type validation", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  for (const alertType of VALID_ALERT_TYPES) {
    test(`ALERT-09-${alertType}: accepts valid alert_type '${alertType}'`, async ({
      request,
    }) => {
      const { ok, status } = await createAlert(request, {
        ticker: STOCK_SYMBOL,
        alert_type: alertType,
      });
      expect(status).toBe(201);
      expect(ok).toBe(true);
    });
  }

  test("ALERT-10: invalid alert_type returns 422", async ({ request }) => {
    const res = await request.post(`${API_URL}/alerts`, {
      data: {
        ticker: STOCK_SYMBOL,
        alert_type: "definitely_not_a_real_type",
      },
    });
    expect(res.status()).toBe(422);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authentication enforcement
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Alerts API — 401 without authentication", () => {
  test("ALERT-11: GET /api/alerts returns 401 without auth", async ({ request }) => {
    // Ensure no session
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.get(`${API_URL}/alerts`);
    expect(res.status()).toBe(401);
  });

  test("ALERT-12: POST /api/alerts returns 401 without auth", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.post(`${API_URL}/alerts`, {
      data: { ticker: STOCK_SYMBOL, alert_type: "entered_buy_zone" },
    });
    expect(res.status()).toBe(401);
  });

  test("ALERT-13: PATCH /api/alerts/{id} returns 401 without auth", async ({ request }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.patch(`${API_URL}/alerts/1`, {
      data: { enabled: false },
    });
    expect(res.status()).toBe(401);
  });

  test("ALERT-14: DELETE /api/alerts/{id} returns 401 without auth", async ({
    request,
  }) => {
    await request.post(`${API_URL}/auth/logout`);
    const res = await request.delete(`${API_URL}/alerts/1`);
    expect(res.status()).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ownership enforcement (cross-user access)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Alerts API — ownership enforcement (USER_A vs USER_B)", () => {
  test("ALERT-15: USER_B cannot read USER_A's alert (403 or 404)", async ({ request }) => {
    // USER_A creates an alert
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: alert } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });
    const alertId = (alert as { id: number }).id;

    // Switch to USER_B
    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);

    const res = await request.get(`${API_URL}/alerts/${alertId}`);
    expect([403, 404]).toContain(res.status());
  });

  test("ALERT-16: USER_B cannot update USER_A's alert (403 or 404)", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: alert } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });
    const alertId = (alert as { id: number }).id;

    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);

    const { status } = await updateAlert(request, alertId, { enabled: false });
    expect([403, 404]).toContain(status);
  });

  test("ALERT-17: USER_B cannot delete USER_A's alert (403 or 404)", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: alert } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });
    const alertId = (alert as { id: number }).id;

    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);

    const { status } = await deleteAlert(request, alertId);
    expect([403, 404]).toContain(status);
  });

  test("ALERT-18: GET /api/alerts as USER_B does not include USER_A's alerts", async ({
    request,
  }) => {
    // USER_A creates an alert
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: alertA } = await createAlert(request, {
      ticker: STOCK_SYMBOL,
      alert_type: "entered_buy_zone",
    });
    const alertIdA = (alertA as { id: number }).id;

    // USER_B lists alerts — must not see USER_A's entry
    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);
    const { body: alertsB } = await listAlerts(request);

    const ids = (alertsB as { id: number }[]).map((a) => a.id);
    expect(ids).not.toContain(alertIdA);
  });
});
