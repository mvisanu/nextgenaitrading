import { NextRequest, NextResponse } from "next/server";

const COINS = ["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","ADAUSDT","DOGEUSDT","AVAXUSDT","DOTUSDT","MATICUSDT","LINKUSDT","UNIUSDT","ATOMUSDT","NEARUSDT","APTUSDT","ARBUSDT","OPUSDT","SUIUSDT","SEIUSDT","TIAUSDT","INJUSDT","FETUSDT","RENDERUSDT","TAOUSDT","JUPUSDT"];

function generateMovers(direction: string, limit: number) {
  return COINS.slice(0, limit).map(sym => {
    const changePct = direction === "gainers"
      ? 2 + Math.random() * 15
      : -(2 + Math.random() * 15);
    const price = 0.5 + Math.random() * 500;
    return {
      symbol: sym,
      exchange: "BINANCE",
      close: +price.toFixed(4),
      change: +(price * changePct / 100).toFixed(4),
      change_pct: +changePct.toFixed(2),
      volume: Math.floor(Math.random() * 500000000),
      bb_rating: direction === "gainers" ? Math.floor(Math.random() * 3) + 1 : -(Math.floor(Math.random() * 3) + 1),
      rsi: direction === "gainers" ? 55 + Math.random() * 25 : 20 + Math.random() * 25,
    };
  }).sort((a, b) => direction === "gainers" ? b.change_pct - a.change_pct : a.change_pct - b.change_pct);
}

export async function GET(request: NextRequest) {
  const direction = request.nextUrl.searchParams.get("direction") ?? "gainers";
  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "25");
  return NextResponse.json(generateMovers(direction, limit));
}
