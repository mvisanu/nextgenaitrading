/**
 * Tests for lib/api.ts
 * Covers: correct URL construction, method, credentials:include, body serialization,
 *         401 silent-refresh flow, error extraction, 204 handling.
 *
 * All tests mock globalThis.fetch.
 */

// We reset module state between tests so the isRefreshing flag is fresh
beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

const BASE = "http://localhost:8000";

function makeFetchMock(responses: Array<{ status: number; body?: unknown }>) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const r = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve({
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: () => Promise.resolve(r.body ?? {}),
    });
  });
}

// ─── authApi ──────────────────────────────────────────────────────────────────

describe("authApi", () => {
  it("login sends POST to /auth/login with credentials:include and JSON body", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { id: 1, email: "a@b.com" } }]);
    const { authApi } = await import("@/lib/api");

    await authApi.login({ email: "a@b.com", password: "secret" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/auth/login`);
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual({ email: "a@b.com", password: "secret" });
  });

  it("register sends POST to /auth/register", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { id: 2, email: "x@y.com" } }]);
    const { authApi } = await import("@/lib/api");

    await authApi.register({ email: "x@y.com", password: "pass1234" });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/auth/register`);
    expect(opts.method).toBe("POST");
  });

  it("me sends GET to /auth/me", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { id: 1 } }]);
    const { authApi } = await import("@/lib/api");

    await authApi.me();

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/auth/me`);
    expect(opts.method).toBe("GET");
  });

  it("logout sends POST to /auth/logout", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { ok: true } }]);
    const { authApi } = await import("@/lib/api");

    await authApi.logout();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/auth/logout`);
  });
});

// ─── profileApi ───────────────────────────────────────────────────────────────

describe("profileApi", () => {
  it("get sends GET to /profile", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { id: 1, user_id: 1 } }]);
    const { profileApi } = await import("@/lib/api");

    await profileApi.get();

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/profile`);
    expect(opts.method).toBe("GET");
  });

  it("update sends PATCH to /profile with body", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { profileApi } = await import("@/lib/api");

    await profileApi.update({ display_name: "Alice" });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/profile`);
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual({ display_name: "Alice" });
  });
});

// ─── brokerApi ────────────────────────────────────────────────────────────────

describe("brokerApi", () => {
  it("list sends GET to /broker/credentials", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { brokerApi } = await import("@/lib/api");

    await brokerApi.list();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/broker/credentials`);
  });

  it("create sends POST to /broker/credentials", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { id: 1 } }]);
    const { brokerApi } = await import("@/lib/api");

    const body = { provider: "alpaca" as const, profile_name: "My", api_key: "K", secret_key: "S" };
    await brokerApi.create(body);

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/broker/credentials`);
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(body);
  });

  it("update sends PATCH to /broker/credentials/:id", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { brokerApi } = await import("@/lib/api");

    await brokerApi.update(42, { profile_name: "New" });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/broker/credentials/42`);
    expect(opts.method).toBe("PATCH");
  });

  it("delete sends DELETE to /broker/credentials/:id", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { ok: true } }]);
    const { brokerApi } = await import("@/lib/api");

    await brokerApi.delete(7);

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/broker/credentials/7`);
    expect(opts.method).toBe("DELETE");
  });

  it("test sends POST to /broker/credentials/:id/test", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { ok: true } }]);
    const { brokerApi } = await import("@/lib/api");

    await brokerApi.test(5);

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/broker/credentials/5/test`);
    expect(opts.method).toBe("POST");
  });
});

// ─── backtestApi ──────────────────────────────────────────────────────────────

describe("backtestApi", () => {
  it("run sends POST to /backtests/run", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { backtestApi } = await import("@/lib/api");

    await backtestApi.run({ symbol: "AAPL", timeframe: "1d", mode: "conservative", dry_run: true });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/backtests/run`);
    expect(opts.method).toBe("POST");
  });

  it("list sends GET to /backtests?limit=50 by default", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { backtestApi } = await import("@/lib/api");

    await backtestApi.list();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/backtests?limit=50`);
  });

  it("list accepts custom limit", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { backtestApi } = await import("@/lib/api");

    await backtestApi.list(10);

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/backtests?limit=10`);
  });

  it("trades sends GET to /backtests/:id/trades", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { backtestApi } = await import("@/lib/api");

    await backtestApi.trades(99);

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/backtests/99/trades`);
  });

  it("chartData sends GET to /backtests/:id/chart-data", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { backtestApi } = await import("@/lib/api");

    await backtestApi.chartData(3);

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/backtests/3/chart-data`);
  });
});

// ─── strategyApi ──────────────────────────────────────────────────────────────

describe("strategyApi", () => {
  it("runAiPick sends POST to /strategies/ai-pick/run", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { strategyApi } = await import("@/lib/api");

    await strategyApi.runAiPick({ symbol: "BTC-USD", timeframe: "1d", mode: "ai-pick", dry_run: true });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/strategies/ai-pick/run`);
    expect(opts.method).toBe("POST");
  });

  it("runBuyLowSellHigh sends POST to /strategies/buy-low-sell-high/run", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { strategyApi } = await import("@/lib/api");

    await strategyApi.runBuyLowSellHigh({ symbol: "ETH-USD", timeframe: "4h", mode: "buy-low-sell-high", dry_run: false });

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/strategies/buy-low-sell-high/run`);
  });

  it("optimizationChart sends GET to /strategies/runs/:id/optimization-chart", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { strategyApi } = await import("@/lib/api");

    await strategyApi.optimizationChart(15);

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/strategies/runs/15/optimization-chart`);
  });
});

// ─── liveApi ──────────────────────────────────────────────────────────────────

describe("liveApi", () => {
  it("signalCheck sends POST to /live/run-signal-check", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: {} }]);
    const { liveApi } = await import("@/lib/api");

    await liveApi.signalCheck({ symbol: "AAPL", timeframe: "1d", mode: "conservative", credential_id: 1 });

    const [url, opts] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/live/run-signal-check`);
    expect(opts.method).toBe("POST");
  });

  it("chartData URL-encodes the symbol parameter", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { candles: [] } }]);
    const { liveApi } = await import("@/lib/api");

    await liveApi.chartData("BTC-USD", "1d");

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/live/chart-data?symbol=BTC-USD&interval=1d`);
  });

  it("chartData encodes special characters in symbol", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { candles: [] } }]);
    const { liveApi } = await import("@/lib/api");

    await liveApi.chartData("S&P500", "1h");

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("S%26P500");
  });

  it("orders sends GET to /live/orders?limit=50 by default", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { liveApi } = await import("@/lib/api");

    await liveApi.orders();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/live/orders?limit=50`);
  });

  it("positions sends GET to /live/positions", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] } ]);
    const { liveApi } = await import("@/lib/api");

    await liveApi.positions();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/live/positions`);
  });
});

// ─── artifactApi ──────────────────────────────────────────────────────────────

describe("artifactApi", () => {
  it("list sends GET to /artifacts", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: [] }]);
    const { artifactApi } = await import("@/lib/api");

    await artifactApi.list();

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/artifacts`);
  });

  it("pineScript sends GET to /artifacts/:id/pine-script", async () => {
    globalThis.fetch = makeFetchMock([{ status: 200, body: { code: "//@version=5" } }]);
    const { artifactApi } = await import("@/lib/api");

    await artifactApi.pineScript(12);

    const [url] = (fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(`${BASE}/artifacts/12/pine-script`);
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe("apiFetch error handling", () => {
  it("throws with detail message on 4xx", async () => {
    globalThis.fetch = makeFetchMock([{ status: 422, body: { detail: "Invalid payload" } }]);
    const { authApi } = await import("@/lib/api");

    await expect(authApi.login({ email: "bad", password: "x" })).rejects.toThrow("Invalid payload");
  });

  it("throws with HTTP status fallback when no detail", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("not json")),
    });
    const { authApi } = await import("@/lib/api");

    await expect(authApi.me()).rejects.toThrow("HTTP 500");
  });

  it("returns empty object for 204 No Content", async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    const { authApi } = await import("@/lib/api");

    const result = await authApi.logout();
    expect(result).toEqual({});
  });

  it("attaches status property to thrown error", async () => {
    globalThis.fetch = makeFetchMock([{ status: 404, body: { detail: "Not found" } }]);
    const { brokerApi } = await import("@/lib/api");

    try {
      await brokerApi.delete(999);
      fail("should have thrown");
    } catch (err: unknown) {
      expect((err as { status: number }).status).toBe(404);
    }
  });
});

// ─── Silent 401 refresh flow ──────────────────────────────────────────────────

describe("401 silent refresh flow", () => {
  it("attempts refresh then retries original request on 401", async () => {
    let callCount = 0;
    globalThis.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Original request: 401
        return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) });
      }
      if (callCount === 2) {
        // Refresh: 200
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
      }
      // Retry of original: 200
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ id: 1 }) });
    });

    const { authApi } = await import("@/lib/api");
    const result = await authApi.me();

    expect(callCount).toBe(3);
    expect(result).toEqual({ id: 1 });
  });

  it("throws 'Session expired' when refresh also fails", async () => {
    // When refresh fails the code redirects window.location.href = "/login" then
    // throws. We assert the thrown error; the redirect side-effect is tested manually
    // (jsdom window.location is non-configurable).
    globalThis.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) })
    );

    const { authApi } = await import("@/lib/api");

    await expect(authApi.me()).rejects.toThrow("Session expired");
  });
});
