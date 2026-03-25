import { NextResponse } from "next/server";

export async function GET() {
  const squeezes = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "DOTUSDT", "ATOMUSDT", "NEARUSDT"].map(sym => ({
    symbol: sym,
    exchange: "BINANCE",
    close: +(1 + Math.random() * 500).toFixed(4),
    change: +((Math.random() - 0.5) * 3).toFixed(2),
    change_pct: +((Math.random() - 0.5) * 4).toFixed(2),
    volume: Math.floor(Math.random() * 100000000),
    bbw: +(0.01 + Math.random() * 0.03).toFixed(4),
    rsi: +(40 + Math.random() * 20).toFixed(2),
  }));
  return NextResponse.json(squeezes);
}
