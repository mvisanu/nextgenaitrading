import { NextResponse } from "next/server";

export async function GET() {
  const breakouts = ["SOLUSDT", "INJUSDT", "FETUSDT", "RENDERUSDT", "SUIUSDT", "JUPUSDT", "TAOUSDT"].map(sym => ({
    symbol: sym,
    exchange: "BINANCE",
    close: +(5 + Math.random() * 200).toFixed(4),
    change: +((Math.random() * 8) + 2).toFixed(2),
    change_pct: +((Math.random() * 12) + 3).toFixed(2),
    volume: Math.floor(Math.random() * 200000000),
    volume_ratio: +(2 + Math.random() * 5).toFixed(2),
    bb_rating: Math.floor(Math.random() * 3) + 1,
  }));
  return NextResponse.json(breakouts);
}
