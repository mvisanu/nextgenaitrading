import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([
    { key: "quality_stocks", name: "Quality Stocks", description: "High-quality low-volatility stocks" },
    { key: "value_stocks", name: "Value Stocks", description: "Undervalued stocks with low P/E and P/B" },
    { key: "dividend_stocks", name: "Dividend Stocks", description: "High dividend yield with consistent payout" },
    { key: "momentum_stocks", name: "Momentum Stocks", description: "Strong recent performance and technical momentum" },
    { key: "growth_stocks", name: "Growth Stocks", description: "High-growth companies with expanding revenue" },
  ]);
}
