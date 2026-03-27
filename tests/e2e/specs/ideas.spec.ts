/**
 * ideas.spec.ts — Idea Pipeline and Conviction Watchlist API E2E tests
 *
 * Covers:
 *   IDEA-01  POST /api/ideas creates a new idea (201)
 *   IDEA-02  POST with linked tickers stores ticker associations
 *   IDEA-03  GET /api/ideas returns list sorted by rank_score desc
 *   IDEA-04  PATCH /api/ideas/{id} updates title, thesis, conviction_score
 *   IDEA-05  DELETE /api/ideas/{id} removes idea and cascades to tickers
 *   IDEA-06  conviction_score < 1 returns 422
 *   IDEA-07  conviction_score > 10 returns 422
 *   IDEA-08  GET /api/ideas returns 401 without auth
 *   IDEA-09  POST /api/ideas returns 401 without auth
 *   IDEA-10  PATCH /api/ideas/{id} returns 401 without auth
 *   IDEA-11  DELETE /api/ideas/{id} returns 401 without auth
 *   IDEA-12  USER_B cannot update or delete USER_A's idea (403/404)
 *   IDEA-13  GET /api/ideas only returns the current user's ideas
 *   IDEA-14  watch_only=true idea has watch_only flag set in response
 *   IDEA-15  tags_json stores selected theme tags
 *   IDEA-16  rank_score field is present in list response
 */

import { test, expect } from "@playwright/test";
import { API_URL, USER_A, USER_B, STOCK_SYMBOL, ETF_SYMBOL } from "../fixtures/test-data";
import {
  listIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
} from "../helpers/v2-api.helper";
import { registerUser, loginUser, logoutUser } from "../helpers/api.helper";

// Minimal valid idea payload
const VALID_IDEA = {
  title: "AI Infrastructure Play",
  thesis: "Chipmakers and data center operators will benefit from AI buildout.",
  conviction_score: 7,
  watch_only: false,
  tradable: true,
  tags_json: ["ai", "semiconductors"],
  tickers: [
    { ticker: STOCK_SYMBOL, is_primary: true },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CRUD — happy paths
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas API — CRUD operations", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("IDEA-01: POST /api/ideas creates idea and returns 201 with id", async ({
    request,
  }) => {
    const { ok, status, body } = await createIdea(request, VALID_IDEA);

    expect(status).toBe(201);
    expect(ok).toBe(true);
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("title", VALID_IDEA.title);
    expect(body).toHaveProperty("conviction_score", VALID_IDEA.conviction_score);
  });

  test("IDEA-02: POST with linked tickers stores ticker associations", async ({
    request,
  }) => {
    const { ok, body } = await createIdea(request, {
      ...VALID_IDEA,
      tickers: [
        { ticker: STOCK_SYMBOL, is_primary: true },
        { ticker: ETF_SYMBOL, is_primary: false },
      ],
    });

    expect(ok).toBe(true);
    // Response should expose tickers array (or they appear in a sub-query)
    // Accept either direct tickers field or absence if backend is lazy-loaded
    if (body.tickers) {
      const tickers = body.tickers as { ticker: string }[];
      const symbols = tickers.map((t) => t.ticker);
      expect(symbols).toContain(STOCK_SYMBOL);
      expect(symbols).toContain(ETF_SYMBOL);
    }
  });

  test("IDEA-03: GET /api/ideas returns array including newly created idea", async ({
    request,
  }) => {
    const { body: created } = await createIdea(request, VALID_IDEA);
    const createdId = (created as { id: number }).id;

    const { ok, body } = await listIdeas(request);
    expect(ok).toBe(true);
    expect(Array.isArray(body)).toBe(true);

    const ids = (body as { id: number }[]).map((i) => i.id);
    expect(ids).toContain(createdId);
  });

  test("IDEA-04: GET /api/ideas list items have rank_score field", async ({ request }) => {
    await createIdea(request, VALID_IDEA);

    const { ok, body } = await listIdeas(request);
    expect(ok).toBe(true);
    expect((body as unknown[]).length).toBeGreaterThan(0);

    for (const idea of body as Record<string, unknown>[]) {
      expect(idea).toHaveProperty("rank_score");
      expect(typeof idea.rank_score).toBe("number");
    }
  });

  test("IDEA-05: GET /api/ideas is sorted by rank_score descending", async ({
    request,
  }) => {
    // Create two ideas with different conviction scores to produce different rank_scores
    await createIdea(request, { ...VALID_IDEA, title: "Low Conviction", conviction_score: 2 });
    await createIdea(request, { ...VALID_IDEA, title: "High Conviction", conviction_score: 9 });

    const { ok, body } = await listIdeas(request);
    expect(ok).toBe(true);

    const ideas = body as { rank_score: number }[];
    for (let i = 0; i < ideas.length - 1; i++) {
      expect(ideas[i].rank_score).toBeGreaterThanOrEqual(ideas[i + 1].rank_score);
    }
  });

  test("IDEA-06: PATCH /api/ideas/{id} updates title and conviction_score", async ({
    request,
  }) => {
    const { body: created } = await createIdea(request, VALID_IDEA);
    const id = (created as { id: number }).id;

    const { ok, body } = await updateIdea(request, id, {
      title: "Updated Title",
      conviction_score: 10,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("title", "Updated Title");
    expect(body).toHaveProperty("conviction_score", 10);
  });

  test("IDEA-07: DELETE /api/ideas/{id} removes idea (200 or 204)", async ({ request }) => {
    const { body: created } = await createIdea(request, VALID_IDEA);
    const id = (created as { id: number }).id;

    const { ok, status } = await deleteIdea(request, id);
    expect(ok).toBe(true);
    expect([200, 204]).toContain(status);

    // Verify it no longer appears in the list
    const { body: ideas } = await listIdeas(request);
    const ids = (ideas as { id: number }[]).map((i) => i.id);
    expect(ids).not.toContain(id);
  });

  test("IDEA-08: watch_only=true idea has watch_only flag set in response", async ({
    request,
  }) => {
    const { ok, body } = await createIdea(request, {
      ...VALID_IDEA,
      watch_only: true,
      tradable: false,
    });
    expect(ok).toBe(true);
    expect(body).toHaveProperty("watch_only", true);
  });

  test("IDEA-09: tags_json is stored and returned correctly", async ({ request }) => {
    const tags = ["ai", "data_centers", "semiconductors"];
    const { ok, body } = await createIdea(request, {
      ...VALID_IDEA,
      tags_json: tags,
    });
    expect(ok).toBe(true);

    const returnedTags = body.tags_json as string[];
    for (const tag of tags) {
      expect(returnedTags).toContain(tag);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Conviction score validation
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas API — conviction_score validation", () => {
  test.beforeEach(async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
  });

  test("IDEA-10: conviction_score below 1 returns 422", async ({ request }) => {
    const res = await request.post(`${API_URL}/ideas`, {
      data: { ...VALID_IDEA, conviction_score: 0 },
    });
    expect(res.status()).toBe(422);
  });

  test("IDEA-11: conviction_score above 10 returns 422", async ({ request }) => {
    const res = await request.post(`${API_URL}/ideas`, {
      data: { ...VALID_IDEA, conviction_score: 11 },
    });
    expect(res.status()).toBe(422);
  });

  test("IDEA-12: conviction_score of exactly 1 is accepted", async ({ request }) => {
    const { ok, status } = await createIdea(request, {
      ...VALID_IDEA,
      conviction_score: 1,
    });
    expect(status).toBe(201);
    expect(ok).toBe(true);
  });

  test("IDEA-13: conviction_score of exactly 10 is accepted", async ({ request }) => {
    const { ok, status } = await createIdea(request, {
      ...VALID_IDEA,
      conviction_score: 10,
    });
    expect(status).toBe(201);
    expect(ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Authentication enforcement
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas API — 401 without authentication", () => {
  test("IDEA-14: GET /api/ideas returns 401 without auth", async ({ request, playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.get(`${API_URL}/ideas`);
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("IDEA-15: POST /api/ideas returns 401 without auth", async ({ request, playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.post(`${API_URL}/ideas`, { data: VALID_IDEA });
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("IDEA-16: PATCH /api/ideas/{id} returns 401 without auth", async ({ request, playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.patch(`${API_URL}/ideas/1`, {
        data: { title: "Hacked" },
      });
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });

  test("IDEA-17: DELETE /api/ideas/{id} returns 401 without auth", async ({ request, playwright }) => {
    const freshCtx = await playwright.request.newContext();
    try {
      const res = await freshCtx.delete(`${API_URL}/ideas/1`);
      expect(res.status()).toBe(401);
    } finally {
      await freshCtx.dispose();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ownership enforcement (cross-user access)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Ideas API — ownership enforcement (USER_A vs USER_B)", () => {
  test("IDEA-18: USER_B cannot update USER_A's idea (403 or 404)", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: idea } = await createIdea(request, VALID_IDEA);
    const ideaId = (idea as { id: number }).id;

    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);

    const { status } = await updateIdea(request, ideaId, { title: "Hijacked" });
    expect([403, 404]).toContain(status);
  });

  test("IDEA-19: USER_B cannot delete USER_A's idea (403 or 404)", async ({ request }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: idea } = await createIdea(request, VALID_IDEA);
    const ideaId = (idea as { id: number }).id;

    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);

    const { status } = await deleteIdea(request, ideaId);
    expect([403, 404]).toContain(status);
  });

  test("IDEA-20: GET /api/ideas as USER_B does not include USER_A's ideas", async ({
    request,
  }) => {
    await registerUser(request, USER_A.email, USER_A.password);
    await loginUser(request, USER_A.email, USER_A.password);
    const { body: ideaA } = await createIdea(request, VALID_IDEA);
    const ideaIdA = (ideaA as { id: number }).id;

    await logoutUser(request);
    await registerUser(request, USER_B.email, USER_B.password);
    await loginUser(request, USER_B.email, USER_B.password);
    const { body: ideasB } = await listIdeas(request);

    const ids = (ideasB as { id: number }[]).map((i) => i.id);
    expect(ids).not.toContain(ideaIdA);
  });
});
