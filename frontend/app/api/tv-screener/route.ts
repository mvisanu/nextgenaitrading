import { NextRequest, NextResponse } from "next/server";

// This route handler proxies screener requests.
// In production, this would call the TradingView Screener API or MCP server.
// For now, it returns structured mock data that matches the real API shape.

const MOCK_STOCKS: Record<string, unknown>[] = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", close: 178.72, change: 2.34, change_pct: 1.33, volume: 54200000, market_cap: 2780000000000, rsi: 58.4, sma50: 175.20, sma200: 168.50, sector: "Technology", recommendation: "BUY" },
  { symbol: "MSFT", name: "Microsoft Corp", exchange: "NASDAQ", close: 415.56, change: 3.12, change_pct: 0.76, volume: 22100000, market_cap: 3090000000000, rsi: 62.1, sma50: 410.80, sma200: 395.20, sector: "Technology", recommendation: "BUY" },
  { symbol: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", close: 875.30, change: 15.42, change_pct: 1.79, volume: 41500000, market_cap: 2160000000000, rsi: 67.8, sma50: 820.50, sma200: 680.30, sector: "Technology", recommendation: "STRONG_BUY" },
  { symbol: "GOOGL", name: "Alphabet Inc", exchange: "NASDAQ", close: 155.72, change: -0.85, change_pct: -0.54, volume: 18900000, market_cap: 1930000000000, rsi: 48.2, sma50: 153.40, sma200: 142.60, sector: "Technology", recommendation: "NEUTRAL" },
  { symbol: "AMZN", name: "Amazon.com Inc", exchange: "NASDAQ", close: 185.40, change: 1.95, change_pct: 1.06, volume: 35600000, market_cap: 1920000000000, rsi: 55.6, sma50: 182.30, sma200: 168.90, sector: "Consumer Cyclical", recommendation: "BUY" },
  { symbol: "META", name: "Meta Platforms", exchange: "NASDAQ", close: 505.75, change: 8.40, change_pct: 1.69, volume: 16800000, market_cap: 1290000000000, rsi: 64.3, sma50: 490.20, sma200: 445.80, sector: "Technology", recommendation: "BUY" },
  { symbol: "TSLA", name: "Tesla Inc", exchange: "NASDAQ", close: 175.20, change: -3.45, change_pct: -1.93, volume: 62100000, market_cap: 558000000000, rsi: 42.1, sma50: 185.60, sma200: 210.30, sector: "Consumer Cyclical", recommendation: "SELL" },
  { symbol: "JPM", name: "JPMorgan Chase", exchange: "NYSE", close: 198.45, change: 1.20, change_pct: 0.61, volume: 8900000, market_cap: 572000000000, rsi: 56.8, sma50: 195.30, sma200: 182.40, sector: "Financial Services", recommendation: "BUY" },
  { symbol: "V", name: "Visa Inc", exchange: "NYSE", close: 282.30, change: 0.75, change_pct: 0.27, volume: 6200000, market_cap: 578000000000, rsi: 51.4, sma50: 280.10, sma200: 270.50, sector: "Financial Services", recommendation: "NEUTRAL" },
  { symbol: "WMT", name: "Walmart Inc", exchange: "NYSE", close: 168.92, change: 0.35, change_pct: 0.21, volume: 7100000, market_cap: 454000000000, rsi: 53.2, sma50: 166.80, sma200: 160.40, sector: "Consumer Defensive", recommendation: "NEUTRAL" },
  { symbol: "XOM", name: "Exxon Mobil", exchange: "NYSE", close: 112.85, change: 2.10, change_pct: 1.90, volume: 14500000, market_cap: 465000000000, rsi: 61.7, sma50: 108.90, sma200: 104.20, sector: "Energy", recommendation: "BUY" },
  { symbol: "LLY", name: "Eli Lilly", exchange: "NYSE", close: 782.40, change: 12.30, change_pct: 1.60, volume: 3200000, market_cap: 743000000000, rsi: 71.2, sma50: 760.50, sma200: 680.90, sector: "Healthcare", recommendation: "STRONG_BUY" },
];

const MOCK_CRYPTO = [
  { symbol: "BTCUSDT", name: "Bitcoin", exchange: "BINANCE", close: 67420, change: 1250, change_pct: 1.89, volume: 28500000000, market_cap: 1320000000000, rsi: 62.5, recommendation: "BUY" },
  { symbol: "ETHUSDT", name: "Ethereum", exchange: "BINANCE", close: 3520, change: 85, change_pct: 2.47, volume: 14200000000, market_cap: 423000000000, rsi: 58.3, recommendation: "BUY" },
  { symbol: "SOLUSDT", name: "Solana", exchange: "BINANCE", close: 148.50, change: 8.20, change_pct: 5.85, volume: 3200000000, market_cap: 65000000000, rsi: 72.1, recommendation: "STRONG_BUY" },
  { symbol: "BNBUSDT", name: "BNB", exchange: "BINANCE", close: 598, change: 12, change_pct: 2.05, volume: 1800000000, market_cap: 89000000000, rsi: 55.8, recommendation: "BUY" },
  { symbol: "XRPUSDT", name: "XRP", exchange: "BINANCE", close: 0.625, change: 0.015, change_pct: 2.46, volume: 2100000000, market_cap: 34000000000, rsi: 54.2, recommendation: "NEUTRAL" },
  { symbol: "ADAUSDT", name: "Cardano", exchange: "BINANCE", close: 0.458, change: -0.012, change_pct: -2.55, volume: 420000000, market_cap: 16200000000, rsi: 38.6, recommendation: "SELL" },
  { symbol: "DOGEUSDT", name: "Dogecoin", exchange: "BINANCE", close: 0.162, change: 0.008, change_pct: 5.19, volume: 1500000000, market_cap: 23000000000, rsi: 65.4, recommendation: "BUY" },
  { symbol: "AVAXUSDT", name: "Avalanche", exchange: "BINANCE", close: 38.20, change: 1.45, change_pct: 3.95, volume: 580000000, market_cap: 14200000000, rsi: 59.8, recommendation: "BUY" },
];

const MOCK_FOREX = [
  { symbol: "EURUSD", name: "EUR/USD", exchange: "FX", close: 1.0856, change: 0.0012, change_pct: 0.11, volume: 0, rsi: 52.3, recommendation: "NEUTRAL" },
  { symbol: "GBPUSD", name: "GBP/USD", exchange: "FX", close: 1.2645, change: 0.0025, change_pct: 0.20, volume: 0, rsi: 55.8, recommendation: "BUY" },
  { symbol: "USDJPY", name: "USD/JPY", exchange: "FX", close: 151.42, change: 0.35, change_pct: 0.23, volume: 0, rsi: 64.1, recommendation: "BUY" },
  { symbol: "AUDUSD", name: "AUD/USD", exchange: "FX", close: 0.6542, change: -0.0018, change_pct: -0.27, volume: 0, rsi: 44.5, recommendation: "SELL" },
  { symbol: "USDCAD", name: "USD/CAD", exchange: "FX", close: 1.3572, change: -0.0008, change_pct: -0.06, volume: 0, rsi: 48.9, recommendation: "NEUTRAL" },
];

const MOCK_ETF = [
  { symbol: "SPY", name: "SPDR S&P 500", exchange: "NYSE", close: 512.40, change: 3.20, change_pct: 0.63, volume: 68500000, market_cap: 510000000000, rsi: 57.2, recommendation: "BUY" },
  { symbol: "QQQ", name: "Invesco QQQ", exchange: "NASDAQ", close: 438.75, change: 5.10, change_pct: 1.18, volume: 42300000, market_cap: 220000000000, rsi: 61.5, recommendation: "BUY" },
  { symbol: "IWM", name: "iShares Russell 2000", exchange: "NYSE", close: 205.30, change: 1.85, change_pct: 0.91, volume: 25100000, market_cap: 62000000000, rsi: 52.8, recommendation: "NEUTRAL" },
  { symbol: "DIA", name: "SPDR Dow Jones", exchange: "NYSE", close: 392.15, change: 1.40, change_pct: 0.36, volume: 3800000, market_cap: 33000000000, rsi: 54.6, recommendation: "NEUTRAL" },
  { symbol: "XLK", name: "Technology Select", exchange: "NYSE", close: 210.85, change: 2.95, change_pct: 1.42, volume: 8200000, market_cap: 65000000000, rsi: 63.4, recommendation: "BUY" },
];

function getDataForUniverse(universe: string) {
  switch (universe) {
    case "crypto": return MOCK_CRYPTO;
    case "forex": return MOCK_FOREX;
    case "etf": return MOCK_ETF;
    default: return MOCK_STOCKS;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { universe = "stocks", filters, sort_by, sort_order = "desc", limit = 20 } = body;

    let data = getDataForUniverse(universe);

    // Apply basic filters
    if (filters && Array.isArray(filters)) {
      for (const f of filters) {
        data = data.filter((row: Record<string, unknown>) => {
          const val = row[f.field];
          if (val === undefined || val === null) return true;
          switch (f.operator) {
            case "greater": return (val as number) > (f.value as number);
            case "less": return (val as number) < (f.value as number);
            case "equal": return val === f.value;
            case "in_range": return Array.isArray(f.value) && (val as number) >= (f.value[0] as number) && (val as number) <= (f.value[1] as number);
            default: return true;
          }
        });
      }
    }

    // Sort
    if (sort_by) {
      data = [...data].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const av = (a[sort_by] as number) ?? 0;
        const bv = (b[sort_by] as number) ?? 0;
        return sort_order === "asc" ? av - bv : bv - av;
      });
    }

    // Limit
    data = data.slice(0, limit);

    return NextResponse.json({
      rows: data,
      universe,
      total: data.length,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
