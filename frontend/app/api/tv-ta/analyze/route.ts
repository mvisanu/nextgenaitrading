import { NextRequest, NextResponse } from "next/server";

function generateIndicators() {
  const rsi = 30 + Math.random() * 40;
  const macd = (Math.random() - 0.5) * 4;
  const adx = 15 + Math.random() * 35;
  const cci = -100 + Math.random() * 200;
  const stoch_k = 20 + Math.random() * 60;

  return {
    oscillators: [
      { name: "RSI (14)", value: +rsi.toFixed(2), signal: rsi < 30 ? "BUY" : rsi > 70 ? "SELL" : "NEUTRAL" },
      { name: "MACD (12,26)", value: +macd.toFixed(4), signal: macd > 0 ? "BUY" : "SELL" },
      { name: "Stochastic %K", value: +stoch_k.toFixed(2), signal: stoch_k < 20 ? "BUY" : stoch_k > 80 ? "SELL" : "NEUTRAL" },
      { name: "CCI (20)", value: +cci.toFixed(2), signal: cci < -100 ? "BUY" : cci > 100 ? "SELL" : "NEUTRAL" },
      { name: "ADX (14)", value: +adx.toFixed(2), signal: adx > 25 ? "BUY" : "NEUTRAL" },
      { name: "Williams %R", value: +(-20 - Math.random() * 60).toFixed(2), signal: "NEUTRAL" },
      { name: "Bull/Bear Power", value: +(Math.random() * 10 - 5).toFixed(4), signal: Math.random() > 0.5 ? "BUY" : "SELL" },
    ],
    moving_averages: [
      { name: "EMA (10)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.4 ? "BUY" : "SELL" },
      { name: "SMA (20)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.4 ? "BUY" : "SELL" },
      { name: "EMA (20)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.4 ? "BUY" : "SELL" },
      { name: "SMA (50)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.5 ? "BUY" : "SELL" },
      { name: "EMA (50)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.5 ? "BUY" : "SELL" },
      { name: "SMA (100)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.5 ? "BUY" : "SELL" },
      { name: "SMA (200)", value: +(100 + Math.random() * 50).toFixed(2), signal: Math.random() > 0.5 ? "BUY" : "SELL" },
    ],
  };
}

export async function POST(request: NextRequest) {
  try {
    const { symbol, exchange = "NASDAQ", timeframe = "1D" } = await request.json();

    const ind = generateIndicators();
    const allIndicators = [...ind.oscillators, ...ind.moving_averages];
    const buys = allIndicators.filter(i => i.signal === "BUY").length;
    const sells = allIndicators.filter(i => i.signal === "SELL").length;
    const neutrals = allIndicators.filter(i => i.signal === "NEUTRAL").length;

    let recommendation: string;
    const ratio = buys / (buys + sells + neutrals);
    if (ratio > 0.7) recommendation = "STRONG_BUY";
    else if (ratio > 0.5) recommendation = "BUY";
    else if (ratio < 0.2) recommendation = "STRONG_SELL";
    else if (ratio < 0.35) recommendation = "SELL";
    else recommendation = "NEUTRAL";

    return NextResponse.json({
      symbol,
      exchange,
      timeframe,
      recommendation,
      buy_count: buys,
      sell_count: sells,
      neutral_count: neutrals,
      indicators: allIndicators,
      oscillators: ind.oscillators,
      moving_averages: ind.moving_averages,
      volume_data: {
        volume_ratio: +(1 + Math.random() * 3).toFixed(2),
        price_change: +((Math.random() - 0.3) * 5).toFixed(2),
        confirmation: Math.random() > 0.5 ? "Volume confirms price action" : "Volume divergence detected",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
