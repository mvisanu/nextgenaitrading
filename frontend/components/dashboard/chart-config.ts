
export interface IntervalOption {
  label: string;
  value: string;
  shortLabel: string;
}

interface IntervalGroup {
  title: string;
  items: IntervalOption[];
}

export const INTERVAL_GROUPS: IntervalGroup[] = [
  {
    title: "MINUTES",
    items: [
      { label: "1 minute",    value: "1m",  shortLabel: "1m"  },
      { label: "2 minutes",   value: "2m",  shortLabel: "2m"  },
      { label: "3 minutes",   value: "3m",  shortLabel: "3m"  },
      { label: "5 minutes",   value: "5m",  shortLabel: "5m"  },
      { label: "10 minutes",  value: "10m", shortLabel: "10m" },
      { label: "15 minutes",  value: "15m", shortLabel: "15m" },
      { label: "30 minutes",  value: "30m", shortLabel: "30m" },
    ],
  },
  {
    title: "HOURS",
    items: [
      { label: "1 hour",   value: "1h", shortLabel: "1h" },
      { label: "2 hours",  value: "2h", shortLabel: "2h" },
      { label: "4 hours",  value: "4h", shortLabel: "4h" },
    ],
  },
  {
    title: "DAYS",
    items: [
      { label: "1 day",   value: "1d",  shortLabel: "1D" },
      { label: "1 week",  value: "1wk", shortLabel: "1W" },
      { label: "1 month", value: "1mo", shortLabel: "1M" },
    ],
  },
];

export const ALL_INTERVALS = INTERVAL_GROUPS.flatMap((g) => g.items);
export const DEFAULT_INTERVAL = ALL_INTERVALS.find((i) => i.value === "1d")!;

// Webull-style inline interval buttons (shown in toolbar)
const INLINE_INTERVALS = ["1m", "2m", "3m", "5m", "10m", "15m", "30m", "1h", "2h", "4h"];


// Webull-style period range buttons (bottom bar below chart)
export interface PeriodRange {
  label: string;
  interval: string; // maps to a candle interval
}

export const PERIOD_RANGES: PeriodRange[] = [
  { label: "1D",  interval: "5m"  },
  { label: "5D",  interval: "15m" },
  { label: "1M",  interval: "1h"  },
  { label: "3M",  interval: "1d"  },
  { label: "6M",  interval: "1d"  },
  { label: "YTD", interval: "1d"  },
  { label: "1Y",  interval: "1d"  },
  { label: "5Y",  interval: "1wk" },
  { label: "Max", interval: "1mo" },
];

// Common yfinance symbol suggestions for search autocomplete
export const POPULAR_SYMBOLS = [
  "BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "DOGE-USD", "XRP-USD",
  "AAPL", "TSLA", "NFLX", "GOOGL", "AMZN", "MSFT", "NVDA", "META", "AMD",
  "SPY", "QQQ", "DIA", "IWM", "GLD", "SLV",
  "JPM", "BAC", "GS", "V", "MA", "PYPL",
  "COIN", "MSTR", "RIOT", "MARA", "HOOD",
  "^GSPC", "^IXIC", "^DJI", "^VIX",
];

// ─── Animation styles ─────────────────────────────────────────────────────────
