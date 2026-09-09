
export function formatPrice(price: number, symbol: string): string {
  if (!Number.isFinite(price) || price <= 0) return "-";
  if (price < 1) return price.toFixed(4);
  if (price > 10000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatChange(val: number): string {
  const sign = val >= 0 ? "+" : "";
  if (Math.abs(val) < 1) return `${sign}${val.toFixed(4)}`;
  return `${sign}${val.toFixed(2)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Fills parent height using ResizeObserver, then passes pixel height to PriceChart
