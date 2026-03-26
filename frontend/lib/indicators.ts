/**
 * Technical indicator calculations for chart overlays.
 * All functions accept arrays of close prices and return computed values.
 */

export interface MAPoint {
  time: string | number;
  value: number;
}

export interface MACDPoint {
  time: string | number;
  macd: number;
  signal: number;
  histogram: number;
}

export interface RSIPoint {
  time: string | number;
  value: number;
}

/** Simple Moving Average */
export function computeSMA(
  closes: { time: string | number; close: number }[],
  period: number
): MAPoint[] {
  const result: MAPoint[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j].close;
    }
    result.push({ time: closes[i].time, value: sum / period });
  }
  return result;
}

/** Exponential Moving Average */
export function computeEMA(
  closes: { time: string | number; close: number }[],
  period: number
): MAPoint[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result: MAPoint[] = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i].close;
  let ema = sum / period;
  result.push({ time: closes[period - 1].time, value: ema });

  for (let i = period; i < closes.length; i++) {
    ema = closes[i].close * k + ema * (1 - k);
    result.push({ time: closes[i].time, value: ema });
  }
  return result;
}

/** MACD (12, 26, 9) */
export function computeMACD(
  closes: { time: string | number; close: number }[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDPoint[] {
  const fastEMA = computeEMA(closes, fastPeriod);
  const slowEMA = computeEMA(closes, slowPeriod);

  // Align by time
  const slowTimeSet = new Set(slowEMA.map((p) => p.time));
  const alignedFast = fastEMA.filter((p) => slowTimeSet.has(p.time));
  const slowMap = new Map(slowEMA.map((p) => [p.time, p.value]));

  const macdLine: { time: string | number; close: number }[] = alignedFast.map((p) => ({
    time: p.time,
    close: p.value - (slowMap.get(p.time) ?? 0),
  }));

  const signalLine = computeEMA(macdLine, signalPeriod);
  const signalMap = new Map(signalLine.map((p) => [p.time, p.value]));

  return macdLine
    .filter((p) => signalMap.has(p.time))
    .map((p) => {
      const sig = signalMap.get(p.time) ?? 0;
      return {
        time: p.time,
        macd: p.close,
        signal: sig,
        histogram: p.close - sig,
      };
    });
}

/** RSI (Wilder's smoothing) */
export function computeRSI(
  closes: { time: string | number; close: number }[],
  period = 14
): RSIPoint[] {
  if (closes.length < period + 1) return [];

  const result: RSIPoint[] = [];
  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const diff = closes[i].close - closes[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result.push({
    time: closes[period].time,
    value: 100 - 100 / (1 + rs0),
  });

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i].close - closes[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({
      time: closes[i].time,
      value: 100 - 100 / (1 + rs),
    });
  }

  return result;
}
