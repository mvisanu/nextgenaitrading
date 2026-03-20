/**
 * Tests for lib/utils.ts
 * Covers: cn, formatCurrency, formatPct, formatDate, formatDateTime,
 *         getModeLabel, getRegimeVariant, getSignalVariant
 */

import {
  cn,
  formatCurrency,
  formatPct,
  formatDate,
  formatDateTime,
  getModeLabel,
  getRegimeVariant,
  getSignalVariant,
} from "@/lib/utils";

// ─── cn ───────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "skipped", "included")).toBe("base included");
  });

  it("handles undefined / null gracefully", () => {
    expect(cn(undefined, null, "ok")).toBe("ok");
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats positive value with default 2 decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("formats zero correctly", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative value", () => {
    expect(formatCurrency(-99.99)).toBe("-$99.99");
  });

  it("respects custom decimals argument", () => {
    expect(formatCurrency(1.005, 0)).toBe("$1");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});

// ─── formatPct ────────────────────────────────────────────────────────────────

describe("formatPct", () => {
  it("prepends + for positive values", () => {
    expect(formatPct(12.5)).toBe("+12.50%");
  });

  it("does NOT prepend + for negative values", () => {
    expect(formatPct(-5.25)).toBe("-5.25%");
  });

  it("handles zero — zero is non-negative so gets +", () => {
    expect(formatPct(0)).toBe("+0.00%");
  });

  it("respects custom decimals argument", () => {
    expect(formatPct(8.1234, 1)).toBe("+8.1%");
  });

  it("handles large values", () => {
    expect(formatPct(100)).toBe("+100.00%");
  });
});

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns a human-readable date string", () => {
    // Use a fixed UTC date string to avoid TZ-dependent day offset
    const result = formatDate("2024-06-15T12:00:00Z");
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2024/);
  });

  it("includes day number", () => {
    const result = formatDate("2024-01-01T12:00:00Z");
    // "Jan 1, 2024" or similar
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/1/);
  });
});

// ─── formatDateTime ───────────────────────────────────────────────────────────

describe("formatDateTime", () => {
  it("includes time in the output", () => {
    const result = formatDateTime("2024-03-10T14:30:00Z");
    // Should contain AM/PM or hour:minute
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });

  it("includes year and month", () => {
    const result = formatDateTime("2024-03-10T14:30:00Z");
    expect(result).toMatch(/2024/);
    expect(result).toMatch(/Mar/);
  });
});

// ─── getModeLabel ─────────────────────────────────────────────────────────────

describe("getModeLabel", () => {
  it.each([
    ["conservative", "Conservative"],
    ["aggressive", "Aggressive"],
    ["ai-pick", "AI Pick"],
    ["buy-low-sell-high", "Buy Low / Sell High"],
  ])("returns label for mode '%s'", (mode, expected) => {
    expect(getModeLabel(mode)).toBe(expected);
  });

  it("returns unknown mode as-is (no crash)", () => {
    expect(getModeLabel("unknown-mode")).toBe("unknown-mode");
  });
});

// ─── getRegimeVariant ─────────────────────────────────────────────────────────

describe("getRegimeVariant", () => {
  it("returns 'secondary' for null regime", () => {
    expect(getRegimeVariant(null)).toBe("secondary");
  });

  it("returns 'default' for bull regime", () => {
    expect(getRegimeVariant("bull")).toBe("default");
    expect(getRegimeVariant("BULLISH")).toBe("default");
    expect(getRegimeVariant("Bull Market")).toBe("default");
  });

  it("returns 'destructive' for bear regime", () => {
    expect(getRegimeVariant("bear")).toBe("destructive");
    expect(getRegimeVariant("BEARISH")).toBe("destructive");
  });

  it("returns 'secondary' for neutral/unknown regimes", () => {
    expect(getRegimeVariant("sideways")).toBe("secondary");
    expect(getRegimeVariant("neutral")).toBe("secondary");
  });
});

// ─── getSignalVariant ─────────────────────────────────────────────────────────

describe("getSignalVariant", () => {
  it("returns 'secondary' for null signal", () => {
    expect(getSignalVariant(null)).toBe("secondary");
  });

  it("returns 'default' for 'buy' (exact, lowercase)", () => {
    expect(getSignalVariant("buy")).toBe("default");
  });

  it("returns 'secondary' for 'BUY' (uppercase — not matched)", () => {
    // BUG CANDIDATE: getSignalVariant uses `=== 'buy'` after toLowerCase
    // so uppercase 'BUY' is lowercased then compared — should match
    expect(getSignalVariant("BUY")).toBe("default");
  });

  it("returns 'destructive' for 'sell'", () => {
    expect(getSignalVariant("sell")).toBe("destructive");
    expect(getSignalVariant("SELL")).toBe("destructive");
  });

  it("returns 'secondary' for 'hold'", () => {
    expect(getSignalVariant("hold")).toBe("secondary");
  });
});
