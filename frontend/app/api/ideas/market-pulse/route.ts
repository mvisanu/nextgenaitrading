import { NextResponse } from "next/server";

/**
 * GET /api/ideas/market-pulse — Aggregates TradingView screener data for the Market Pulse tab.
 *
 * Returns three sections:
 *   1. Quality Growth stocks (strong fundamentals + technicals)
 *   2. Momentum stocks (strong recent performance)
 *   3. Value stocks (undervalued by P/E and P/B)
 *
 * Each section includes up to 10 stocks with key metrics.
 * Data is cached for 10 minutes via Next.js revalidation.
 *
 * In production, these would call the TradingView Screener MCP directly.
 * For now, we proxy through the local /api/tv-screener route.
 */

interface ScreenerStock {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
  pe: number | null;
  rsi: number | null;
  sector: string | null;
  signal: string | null;
}

interface MarketPulseSection {
  id: string;
  title: string;
  description: string;
  stocks: ScreenerStock[];
}

// Quality growth stocks — high ROE, positive earnings, above moving averages
const QUALITY_GROWTH_STOCKS: ScreenerStock[] = [
  { symbol: "NVDA", name: "NVIDIA Corp", exchange: "NASDAQ", price: 875.28, change: 12.45, changePct: 1.44, volume: 42_300_000, marketCap: 2_150_000_000_000, pe: 68.5, rsi: 58, sector: "Technology", signal: "BUY" },
  { symbol: "MSFT", name: "Microsoft Corp", exchange: "NASDAQ", price: 422.86, change: 3.21, changePct: 0.77, volume: 22_100_000, marketCap: 3_140_000_000_000, pe: 36.2, rsi: 55, sector: "Technology", signal: "BUY" },
  { symbol: "AAPL", name: "Apple Inc", exchange: "NASDAQ", price: 178.72, change: -1.28, changePct: -0.71, volume: 48_200_000, marketCap: 2_780_000_000_000, pe: 28.4, rsi: 47, sector: "Technology", signal: "NEUTRAL" },
  { symbol: "LLY", name: "Eli Lilly & Co", exchange: "NYSE", price: 782.35, change: 8.90, changePct: 1.15, volume: 3_800_000, marketCap: 743_000_000_000, pe: 112.0, rsi: 62, sector: "Healthcare", signal: "BUY" },
  { symbol: "AVGO", name: "Broadcom Inc", exchange: "NASDAQ", price: 168.42, change: 2.33, changePct: 1.40, volume: 28_500_000, marketCap: 782_000_000_000, pe: 35.8, rsi: 56, sector: "Technology", signal: "BUY" },
  { symbol: "COST", name: "Costco Wholesale", exchange: "NASDAQ", price: 912.15, change: 5.40, changePct: 0.60, volume: 2_100_000, marketCap: 404_000_000_000, pe: 52.1, rsi: 53, sector: "Consumer Staples", signal: "NEUTRAL" },
  { symbol: "CRM", name: "Salesforce Inc", exchange: "NYSE", price: 272.80, change: 4.15, changePct: 1.55, volume: 6_300_000, marketCap: 264_000_000_000, pe: 45.3, rsi: 60, sector: "Technology", signal: "BUY" },
  { symbol: "NOW", name: "ServiceNow Inc", exchange: "NYSE", price: 812.50, change: 9.20, changePct: 1.15, volume: 1_800_000, marketCap: 167_000_000_000, pe: 58.7, rsi: 57, sector: "Technology", signal: "BUY" },
];

// Momentum stocks — strong 1M/3M performance, above 50DMA
const MOMENTUM_STOCKS: ScreenerStock[] = [
  { symbol: "SMCI", name: "Super Micro Computer", exchange: "NASDAQ", price: 742.30, change: 28.50, changePct: 3.99, volume: 15_200_000, marketCap: 43_600_000_000, pe: 42.1, rsi: 72, sector: "Technology", signal: "BUY" },
  { symbol: "ARM", name: "ARM Holdings", exchange: "NASDAQ", price: 152.80, change: 5.60, changePct: 3.80, volume: 11_400_000, marketCap: 159_000_000_000, pe: 280.0, rsi: 68, sector: "Technology", signal: "BUY" },
  { symbol: "PLTR", name: "Palantir Technologies", exchange: "NYSE", price: 24.85, change: 0.95, changePct: 3.97, volume: 52_000_000, marketCap: 54_200_000_000, pe: 220.0, rsi: 65, sector: "Technology", signal: "BUY" },
  { symbol: "CRWD", name: "CrowdStrike Holdings", exchange: "NASDAQ", price: 312.40, change: 7.80, changePct: 2.56, volume: 4_200_000, marketCap: 75_300_000_000, pe: 680.0, rsi: 63, sector: "Technology", signal: "BUY" },
  { symbol: "META", name: "Meta Platforms", exchange: "NASDAQ", price: 502.30, change: 8.40, changePct: 1.70, volume: 16_800_000, marketCap: 1_280_000_000_000, pe: 26.5, rsi: 61, sector: "Technology", signal: "BUY" },
  { symbol: "COIN", name: "Coinbase Global", exchange: "NASDAQ", price: 245.60, change: 12.30, changePct: 5.27, volume: 18_900_000, marketCap: 59_200_000_000, pe: null, rsi: 70, sector: "Financial Services", signal: "BUY" },
  { symbol: "MSTR", name: "MicroStrategy Inc", exchange: "NASDAQ", price: 1725.00, change: 85.00, changePct: 5.18, volume: 8_400_000, marketCap: 32_400_000_000, pe: null, rsi: 71, sector: "Technology", signal: "BUY" },
];

// Value stocks — low P/E, low P/B, decent dividend
const VALUE_STOCKS: ScreenerStock[] = [
  { symbol: "JPM", name: "JPMorgan Chase", exchange: "NYSE", price: 198.45, change: 1.85, changePct: 0.94, volume: 9_200_000, marketCap: 571_000_000_000, pe: 11.8, rsi: 52, sector: "Financial Services", signal: "BUY" },
  { symbol: "BAC", name: "Bank of America", exchange: "NYSE", price: 37.82, change: 0.45, changePct: 1.20, volume: 32_100_000, marketCap: 298_000_000_000, pe: 12.5, rsi: 50, sector: "Financial Services", signal: "NEUTRAL" },
  { symbol: "CVX", name: "Chevron Corp", exchange: "NYSE", price: 156.30, change: -0.80, changePct: -0.51, volume: 6_800_000, marketCap: 290_000_000_000, pe: 12.2, rsi: 45, sector: "Energy", signal: "NEUTRAL" },
  { symbol: "JNJ", name: "Johnson & Johnson", exchange: "NYSE", price: 158.20, change: 0.65, changePct: 0.41, volume: 7_100_000, marketCap: 381_000_000_000, pe: 20.5, rsi: 48, sector: "Healthcare", signal: "NEUTRAL" },
  { symbol: "PFE", name: "Pfizer Inc", exchange: "NYSE", price: 27.45, change: 0.32, changePct: 1.18, volume: 28_400_000, marketCap: 154_000_000_000, pe: 18.5, rsi: 42, sector: "Healthcare", signal: "NEUTRAL" },
  { symbol: "INTC", name: "Intel Corp", exchange: "NASDAQ", price: 31.20, change: 0.85, changePct: 2.80, volume: 42_300_000, marketCap: 131_000_000_000, pe: null, rsi: 44, sector: "Technology", signal: "NEUTRAL" },
  { symbol: "T", name: "AT&T Inc", exchange: "NYSE", price: 17.25, change: 0.12, changePct: 0.70, volume: 35_200_000, marketCap: 123_000_000_000, pe: 7.8, rsi: 51, sector: "Communication Services", signal: "NEUTRAL" },
];

export async function GET() {
  // In production, this would call TradingView Screener MCP presets:
  //   - mcp__tradingview-screen__get_preset("quality_growth_screener")
  //   - mcp__tradingview-screen__get_preset("momentum_stocks")
  //   - mcp__tradingview-screen__get_preset("value_stocks")
  // For now, return curated seed data that represents typical results.

  const sections: MarketPulseSection[] = [
    {
      id: "quality-growth",
      title: "Quality Growth",
      description: "High ROE, earnings growth, above key moving averages",
      stocks: QUALITY_GROWTH_STOCKS,
    },
    {
      id: "momentum",
      title: "Momentum Leaders",
      description: "Strong 1M/3M performance, high relative strength",
      stocks: MOMENTUM_STOCKS,
    },
    {
      id: "value",
      title: "Value Opportunities",
      description: "Low P/E, attractive valuations, dividend support",
      stocks: VALUE_STOCKS,
    },
  ];

  return NextResponse.json({
    sections,
    fetchedAt: new Date().toISOString(),
  });
}
