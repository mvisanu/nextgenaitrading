import type { StrategyMode, Timeframe } from "@/types";
export interface ParsedStrategy {
  name: string;
  mode: StrategyMode;
  symbol: string;
  timeframe: Timeframe;
  indicators: string[];
  leverage: number;
  riskLevel: string;
  description: string;
  pineScript: string;
}

const MODE_DEFAULT_LEVERAGE: Record<StrategyMode, number> = {
  conservative: 2.5,
  aggressive: 4.0,
  "ai-pick": 2.5,
  "buy-low-sell-high": 2.5,
  squeeze: 2.5,
};

export const MODE_LABELS: Record<StrategyMode, string> = {
  conservative: "Conservative",
  aggressive: "Aggressive",
  "ai-pick": "AI Pick",
  "buy-low-sell-high": "Buy Low Sell High",
  squeeze: "BB Squeeze",
};

// ─── Strategy Parser ──────────────────────────────────────────────────────────

const INDICATOR_KEYWORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /\brsi\b/i, label: "RSI" },
  { pattern: /\bmacd\b/i, label: "MACD" },
  { pattern: /\bema\b/i, label: "EMA" },
  { pattern: /bollinger|bband|bb\b/i, label: "Bollinger Bands" },
  { pattern: /stochastic|stoch\b/i, label: "Stochastic" },
  { pattern: /\badx\b/i, label: "ADX" },
  { pattern: /\bcci\b/i, label: "CCI" },
  { pattern: /\bvwap\b/i, label: "VWAP" },
  { pattern: /williams|%r\b/i, label: "Williams %R" },
  { pattern: /donchian/i, label: "Donchian Channel" },
  { pattern: /\batr\b/i, label: "ATR" },
  { pattern: /volume/i, label: "Volume" },
  { pattern: /sma|moving average/i, label: "SMA" },
  { pattern: /supertrend/i, label: "Supertrend" },
  { pattern: /ichimoku/i, label: "Ichimoku" },
];

export function parseStrategy(message: string): ParsedStrategy {
  const lower = message.toLowerCase();

  // Determine mode — default to ai-pick (optimizer) which runs multiple
  // variants and is far more likely to find trades than the strict HMM modes
  let mode: StrategyMode = "ai-pick";
  if (
    lower.includes("buy low") ||
    lower.includes("sell high") ||
    lower.includes("mean reversion") ||
    lower.includes("dip") ||
    lower.includes("cycle") ||
    lower.includes("oversold")
  ) {
    mode = "buy-low-sell-high";
  } else if (/\bconservative\b/.test(lower)) {
    // Only use HMM modes if user explicitly names them
    mode = "conservative";
  } else if (/\baggressive\b/.test(lower) && !lower.includes("nnfx")) {
    mode = "aggressive";
  }

  // Extract indicators
  const indicators: string[] = [];
  for (const { pattern, label } of INDICATOR_KEYWORDS) {
    if (pattern.test(message)) {
      indicators.push(label);
    }
  }
  if (indicators.length === 0) {
    indicators.push("EMA", "RSI");
  }

  // Extract timeframe
  let timeframe: Timeframe = "1d";
  if (/\b5\s?min|\b5m\b/i.test(message)) timeframe = "5m";
  else if (/\b15\s?min|\b15m\b/i.test(message)) timeframe = "15m";
  else if (/\b30\s?min|\b30m\b/i.test(message)) timeframe = "30m";
  else if (/\b1h\b|\b1-?hour/i.test(message)) timeframe = "1h";
  else if (/\b4h\b|\b4-?hour/i.test(message)) timeframe = "4h";
  else if (/\bweekly\b|\b1wk\b|\b1w\b/i.test(message)) timeframe = "1wk";
  else if (/\bmonthly\b|\b1mo\b/i.test(message)) timeframe = "1mo";

  // Extract symbol
  let symbol = "BTC-USD";
  const symMatch = message.match(/\b([A-Z]{2,5}-USD[T]?)\b/);
  if (symMatch) symbol = symMatch[1];
  else if (/\baapl\b/i.test(message)) symbol = "AAPL";
  else if (/\btsla\b/i.test(message)) symbol = "TSLA";
  else if (/\bnvda\b/i.test(message)) symbol = "NVDA";
  else if (/\bspy\b/i.test(message)) symbol = "SPY";
  else if (/\beth\b/i.test(message)) symbol = "ETH-USD";
  else if (/\bsol\b/i.test(message)) symbol = "SOL-USD";
  else if (/\bdoge\b/i.test(message)) symbol = "DOGE-USD";
  else if (/\bxrp\b/i.test(message)) symbol = "XRP-USD";
  else if (/forex|eur.*usd/i.test(message)) symbol = "EURUSD=X";
  else if (/gbp/i.test(message)) symbol = "GBPUSD=X";
  else if (/stock|equity/i.test(message)) symbol = "SPY";
  else if (/gold/i.test(message)) symbol = "GC=F";
  else if (/oil|crude/i.test(message)) symbol = "CL=F";

  const leverage = MODE_DEFAULT_LEVERAGE[mode];

  // Generate name
  const words = message
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const name = (words.join(" ") || "Custom Strategy").slice(0, 50);

  const riskMap: Record<StrategyMode, string> = {
    conservative: "Low",
    aggressive: "High",
    "ai-pick": "Medium",
    "buy-low-sell-high": "Medium",
    squeeze: "Medium",
  };

  const pineScript = generatePineScript(name, mode, indicators, leverage);

  return {
    name,
    mode,
    symbol,
    timeframe,
    indicators,
    leverage,
    riskLevel: riskMap[mode],
    description: message.slice(0, 200),
    pineScript,
  };
}

// ─── Pine Script Generator ────────────────────────────────────────────────────

interface Snippets {
  inputs: string[];
  calculations: string[];
  longConditions: string[];
  shortConditions: string[];
  plots: string[];
}

function buildSnippets(indicators: string[]): Snippets {
  const s: Snippets = { inputs: [], calculations: [], longConditions: [], shortConditions: [], plots: [] };
  const lower = indicators.map((i) => i.toLowerCase());

  if (lower.some((i) => i.includes("rsi"))) {
    s.inputs.push('rsiLength = input.int(14, "RSI Length", minval = 2)');
    s.inputs.push('rsiOversold = input.int(30, "RSI Oversold", minval = 10, maxval = 45)');
    s.inputs.push('rsiOverbought = input.int(70, "RSI Overbought", minval = 55, maxval = 90)');
    s.calculations.push("rsiVal = ta.rsi(close, rsiLength)");
    s.longConditions.push("rsiVal < rsiOverbought and rsiVal > rsiOversold");
    s.shortConditions.push("rsiVal > rsiOversold and rsiVal < rsiOverbought");
  }
  if (lower.some((i) => i.includes("macd"))) {
    s.inputs.push('macdFast = input.int(12, "MACD Fast", minval = 3)');
    s.inputs.push('macdSlow = input.int(26, "MACD Slow", minval = 10)');
    s.inputs.push('macdSig = input.int(9, "MACD Signal", minval = 3)');
    s.calculations.push("[macdLine, macdSignal, macdHist] = ta.macd(close, macdFast, macdSlow, macdSig)");
    s.longConditions.push("macdLine > macdSignal and macdHist > 0");
    s.shortConditions.push("macdLine < macdSignal and macdHist < 0");
  }
  if (lower.some((i) => i.includes("ema"))) {
    s.inputs.push('emaFast = input.int(21, "EMA Fast", minval = 5)');
    s.inputs.push('emaSlow = input.int(89, "EMA Slow", minval = 20)');
    s.calculations.push("emaFastVal = ta.ema(close, emaFast)");
    s.calculations.push("emaSlowVal = ta.ema(close, emaSlow)");
    s.longConditions.push("emaFastVal > emaSlowVal and close > emaFastVal");
    s.shortConditions.push("emaFastVal < emaSlowVal and close < emaFastVal");
    s.plots.push('plot(emaFastVal, "EMA Fast", color = color.new(color.blue, 0), linewidth = 1)');
    s.plots.push('plot(emaSlowVal, "EMA Slow", color = color.new(color.orange, 0), linewidth = 2)');
  }
  if (lower.some((i) => i.includes("bollinger") || i.includes("bb"))) {
    s.inputs.push('bbLen = input.int(20, "BB Length", minval = 5)');
    s.inputs.push('bbMult = input.float(2.0, "BB Mult", minval = 0.5, step = 0.1)');
    s.calculations.push("[bbMid, bbUpper, bbLower] = ta.bb(close, bbLen, bbMult)");
    s.longConditions.push("close <= bbLower * 1.01");
    s.shortConditions.push("close >= bbUpper * 0.99");
    s.plots.push('p1 = plot(bbUpper, "BB Upper", color = color.new(color.blue, 50))');
    s.plots.push('p3 = plot(bbLower, "BB Lower", color = color.new(color.blue, 50))');
    s.plots.push("fill(p1, p3, color = color.new(color.blue, 92))");
  }
  if (lower.some((i) => i.includes("stochastic") || i.includes("stoch"))) {
    s.inputs.push('stochLen = input.int(14, "Stoch %K Length", minval = 3)');
    s.inputs.push('stochSmooth = input.int(3, "Stoch %D Smooth", minval = 1)');
    s.calculations.push("stochK = ta.stoch(close, high, low, stochLen)");
    s.calculations.push("stochD = ta.sma(stochK, stochSmooth)");
    s.longConditions.push("stochK < 30 and ta.crossover(stochK, stochD)");
    s.shortConditions.push("stochK > 70 and ta.crossunder(stochK, stochD)");
  }
  if (lower.some((i) => i.includes("adx"))) {
    s.inputs.push('adxLen = input.int(14, "ADX Length", minval = 5)');
    s.inputs.push('adxThresh = input.int(25, "ADX Threshold", minval = 10, maxval = 50)');
    s.calculations.push("[diPlus, diMinus, adxVal] = ta.dmi(adxLen, adxLen)");
    s.longConditions.push("adxVal > adxThresh and diPlus > diMinus");
    s.shortConditions.push("adxVal > adxThresh and diMinus > diPlus");
  }
  if (lower.some((i) => i.includes("vwap"))) {
    s.calculations.push("vwapVal = ta.vwap(close)");
    s.longConditions.push("close > vwapVal");
    s.shortConditions.push("close < vwapVal");
    s.plots.push('plot(vwapVal, "VWAP", color = color.new(color.purple, 0), linewidth = 2)');
  }
  if (lower.some((i) => i.includes("sma"))) {
    s.inputs.push('smaLen = input.int(50, "SMA Length", minval = 5)');
    s.calculations.push("smaVal = ta.sma(close, smaLen)");
    s.longConditions.push("close > smaVal");
    s.shortConditions.push("close < smaVal");
    s.plots.push('plot(smaVal, "SMA", color = color.new(color.yellow, 0), linewidth = 1)');
  }

  // Always include volume + ATR
  s.calculations.push("volSma = ta.sma(volume, 20)");
  s.calculations.push("atrVal = ta.atr(14)");
  s.longConditions.push("volume > volSma * 0.8");
  s.shortConditions.push("volume > volSma * 0.8");

  return s;
}

export function generatePineScript(name: string, mode: StrategyMode, indicators: string[], leverage: number): string {
  const snippets = buildSnippets(indicators);
  const longConds = snippets.longConditions.map((c, i) => `c${i + 1}L = ${c}`).join("\n");
  const shortConds = snippets.shortConditions.map((c, i) => `c${i + 1}S = ${c}`).join("\n");
  const longCount = snippets.longConditions.map((_, i) => `(c${i + 1}L ? 1 : 0)`).join(" + ");
  const shortCount = snippets.shortConditions.map((_, i) => `(c${i + 1}S ? 1 : 0)`).join(" + ");
  const minConfirms = Math.max(1, snippets.longConditions.length - 1);

  return `//@version=5
strategy(
  title            = "${name}",
  shorttitle       = "NGS-AI",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
leverage      = input.float(${leverage}, "Leverage", minval = 1.0, step = 0.5)
signalSpacing = input.int(4, "Min Bars Between Signals", minval = 1)
${snippets.inputs.join("\n")}

// === INDICATOR CALCULATIONS ===
${snippets.calculations.join("\n")}

// === CONFIRMATION LOGIC ===
${longConds}

${shortConds}

longConfirms  = ${longCount || "0"}
shortConfirms = ${shortCount || "0"}

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and longConfirms  >= ${minConfirms} and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and shortConfirms >= ${minConfirms} and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
longStop  = close - atrVal * 2.0
shortStop = close + atrVal * 2.0

// === STRATEGY ORDERS ===
qtyLevered = (strategy.equity * leverage) / close

if longEntry
    strategy.entry("Long", strategy.long, qty = qtyLevered)
if shortEntry
    strategy.entry("Short", strategy.short, qty = qtyLevered)

if strategy.position_size > 0
    strategy.exit("Long Exit", "Long", stop = longStop)
if strategy.position_size < 0
    strategy.exit("Short Exit", "Short", stop = shortStop)

// === PLOTS ===
plotshape(longEntry,  title = "Long",  style = shape.triangleup,   location = location.belowbar, color = color.green, size = size.small)
plotshape(shortEntry, title = "Short", style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.small)
${snippets.plots.join("\n")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
