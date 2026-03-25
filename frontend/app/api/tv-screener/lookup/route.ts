import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { symbols } = await request.json();
    // In production, this would call TradingView API
    const results = (symbols as string[]).map((s: string) => ({
      symbol: s,
      name: s,
      close: 100 + Math.random() * 200,
      change: (Math.random() - 0.5) * 10,
      change_pct: (Math.random() - 0.5) * 5,
      volume: Math.floor(Math.random() * 50000000),
    }));
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
