import { NextRequest, NextResponse } from "next/server";

const STOCK_FIELDS = ["close", "change", "change_pct", "volume", "market_cap", "RSI", "SMA50", "SMA200", "sector", "exchange", "return_on_equity", "dividends_yield_current", "price_earnings_ttm", "EMA20", "MACD.macd", "BB.upper", "BB.lower", "ATR", "ADX", "Perf.W", "Perf.1M", "Perf.3M", "Perf.6M", "Perf.YTD", "Perf.Y"];
const CRYPTO_FIELDS = ["close", "change", "change_pct", "volume", "market_cap", "RSI", "SMA50", "SMA200", "MACD.macd", "BB.upper", "BB.lower", "Perf.1M", "Perf.3M", "Volatility.M"];
const FOREX_FIELDS = ["close", "change", "change_pct", "volume", "RSI", "SMA50", "SMA200", "ATR", "ADX", "Perf.W", "Perf.1M"];
const ETF_FIELDS = ["close", "change", "change_pct", "volume", "market_cap", "RSI", "SMA50", "SMA200", "Perf.W", "Perf.1M", "Perf.3M", "Perf.YTD"];

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") ?? "stock";
  switch (type) {
    case "crypto": return NextResponse.json(CRYPTO_FIELDS);
    case "forex": return NextResponse.json(FOREX_FIELDS);
    case "etf": return NextResponse.json(ETF_FIELDS);
    default: return NextResponse.json(STOCK_FIELDS);
  }
}
