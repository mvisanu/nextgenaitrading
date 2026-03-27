"use client";

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clipboard,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Shield,
  Zap,
  TrendingUp,
  Target,
  Play,
  Loader2,
  MessageSquare,
  X,
  Send,
  ExternalLink,
} from "lucide-react";
import { backtestApi, strategyApi } from "@/lib/api";
import type {
  BacktestSummary,
  RunStrategyRequest,
  Timeframe,
} from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type StrategyMode = "conservative" | "aggressive" | "ai-pick" | "buy-low-sell-high";
type RiskLevel = "Low" | "Medium" | "High";

interface StrategySample {
  id: string;
  name: string;
  mode: StrategyMode;
  description: string;
  bestFor: string;
  timeframe: string;
  indicators: string[];
  riskLevel: RiskLevel;
  score: number;
  code: string;
}

// ─── Pine Script Code ─────────────────────────────────────────────────────────

const CONSERVATIVE_EMA_RSI_CODE = `//@version=5
strategy(
  title            = "NGS Conservative — EMA + RSI Confluence",
  shorttitle       = "NGS-CON",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
emaFast        = input.int(50,  "Fast EMA Length",   minval = 1)
emaSlow        = input.int(200, "Slow EMA Length",   minval = 1)
rsiLength      = input.int(14,  "RSI Length",        minval = 1)
rsiOversold    = input.int(35,  "RSI Oversold",      minval = 1,  maxval = 49)
rsiOverbought  = input.int(65,  "RSI Overbought",    minval = 51, maxval = 99)
atrLength      = input.int(14,  "ATR Length",        minval = 1)
atrMult        = input.float(2.5, "ATR Trail Mult",  minval = 0.1, step = 0.1)
leverage       = input.float(2.5, "Leverage",        minval = 1.0, step = 0.5)
minConfirms    = input.int(7,   "Min Confirmations (of 8)", minval = 1, maxval = 8)
signalSpacing  = input.int(5,   "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
emaFastVal  = ta.ema(close, emaFast)
emaSlowVal  = ta.ema(close, emaSlow)
rsiVal      = ta.rsi(close, rsiLength)
atrVal      = ta.atr(atrLength)
macdLine    = ta.ema(close, 12) - ta.ema(close, 26)
macdSignal  = ta.ema(macdLine, 9)
volSma      = ta.sma(volume, 20)

// === TREND LOGIC ===
bullTrend = emaFastVal > emaSlowVal
bearTrend = emaFastVal < emaSlowVal

// === CONFIRMATION LOGIC ===
// Long confirmations (8 total)
c1Long = bullTrend                             // EMA alignment
c2Long = close > emaFastVal                    // price above fast EMA
c3Long = rsiVal < rsiOverbought                // RSI not overbought
c4Long = rsiVal > rsiOversold                  // RSI not oversold
c5Long = macdLine > macdSignal                 // MACD bullish
c6Long = volume > volSma                       // above-avg volume
c7Long = close > close[1]                      // price rising
c8Long = ta.ema(close, 9) > ta.ema(close, 21) // short-term momentum

longConfirmCount = (c1Long ? 1 : 0) + (c2Long ? 1 : 0) + (c3Long ? 1 : 0) +
                  (c4Long ? 1 : 0) + (c5Long ? 1 : 0) + (c6Long ? 1 : 0) +
                  (c7Long ? 1 : 0) + (c8Long ? 1 : 0)

// Short confirmations (8 total)
c1Short = bearTrend
c2Short = close < emaFastVal
c3Short = rsiVal > rsiOversold
c4Short = rsiVal < rsiOverbought
c5Short = macdLine < macdSignal
c6Short = volume > volSma
c7Short = close < close[1]
c8Short = ta.ema(close, 9) < ta.ema(close, 21)

shortConfirmCount = (c1Short ? 1 : 0) + (c2Short ? 1 : 0) + (c3Short ? 1 : 0) +
                   (c4Short ? 1 : 0) + (c5Short ? 1 : 0) + (c6Short ? 1 : 0) +
                   (c7Short ? 1 : 0) + (c8Short ? 1 : 0)

// === VOLATILITY GATE ===
// Avoid entries when ATR is unusually high (> 2x its own 50-bar average)
atrAvg    = ta.sma(atrVal, 50)
volGateOk = atrVal < atrAvg * 2.0

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk     = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and volGateOk and longConfirmCount  >= minConfirms and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and volGateOk and shortConfirmCount >= minConfirms and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index

if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
// ATR-based trailing stop
longStop  = close - atrVal * atrMult
shortStop = close + atrVal * atrMult

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

// === PLOTS AND LABELS ===
plot(emaFastVal, "EMA Fast", color = color.new(color.blue, 0),  linewidth = 1)
plot(emaSlowVal, "EMA Slow", color = color.new(color.orange, 0), linewidth = 2)

plotshape(longEntry,  title = "Long",  style = shape.triangleup,   location = location.belowbar, color = color.green, size = size.small)
plotshape(shortEntry, title = "Short", style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.small)

bgcolor(longEntry  ? color.new(color.green, 90) : na)
bgcolor(shortEntry ? color.new(color.red,   90) : na)`;

const AGGRESSIVE_MOMENTUM_CODE = `//@version=5
strategy(
  title            = "NGS Aggressive — Momentum Breakout",
  shorttitle       = "NGS-AGG",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
donchianLen     = input.int(20,  "Donchian Channel Length", minval = 1)
macdFast        = input.int(12,  "MACD Fast",               minval = 1)
macdSlowLen     = input.int(26,  "MACD Slow",               minval = 1)
macdSignalLen   = input.int(9,   "MACD Signal",             minval = 1)
adxLen          = input.int(14,  "ADX Length",              minval = 1)
adxThreshold    = input.int(25,  "ADX Trend Threshold",     minval = 10, maxval = 50)
trailPct        = input.float(5.0, "Trailing Stop %",       minval = 0.1, step = 0.1)
leverage        = input.float(4.0, "Leverage",              minval = 1.0, step = 0.5)
minConfirms     = input.int(5,   "Min Confirmations (of 8)", minval = 1, maxval = 8)
signalSpacing   = input.int(3,   "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
// Donchian Channel
dcHigh = ta.highest(high, donchianLen)
dcLow  = ta.lowest(low,  donchianLen)
dcMid  = (dcHigh + dcLow) / 2

// MACD
[macdLine, macdSig, macdHist] = ta.macd(close, macdFast, macdSlowLen, macdSignalLen)

// ADX / DMI
[diPlus, diMinus, adxVal] = ta.dmi(adxLen, adxLen)

// Volume
volSma  = ta.sma(volume, 20)
volRatio = volume / volSma

// RSI for additional filter
rsiVal = ta.rsi(close, 14)

// === TREND LOGIC ===
// Donchian breakout — price closes above/below previous channel high/low
longBreakout  = close > dcHigh[1]
shortBreakout = close < dcLow[1]

trendBull = diPlus  > diMinus and adxVal > adxThreshold
trendBear = diMinus > diPlus  and adxVal > adxThreshold

// === CONFIRMATION LOGIC ===
// Long (8 confirmations)
c1L = longBreakout
c2L = trendBull
c3L = macdLine > macdSig
c4L = macdHist > 0
c5L = macdHist > macdHist[1]       // histogram expanding
c6L = volRatio > 1.2               // volume surge
c7L = rsiVal > 50 and rsiVal < 80  // momentum without overbought
c8L = close > dcMid                // price above midpoint

longConfirms = (c1L ? 1 : 0) + (c2L ? 1 : 0) + (c3L ? 1 : 0) + (c4L ? 1 : 0) +
               (c5L ? 1 : 0) + (c6L ? 1 : 0) + (c7L ? 1 : 0) + (c8L ? 1 : 0)

// Short (8 confirmations)
c1S = shortBreakout
c2S = trendBear
c3S = macdLine < macdSig
c4S = macdHist < 0
c5S = macdHist < macdHist[1]
c6S = volRatio > 1.2
c7S = rsiVal < 50 and rsiVal > 20
c8S = close < dcMid

shortConfirms = (c1S ? 1 : 0) + (c2S ? 1 : 0) + (c3S ? 1 : 0) + (c4S ? 1 : 0) +
                (c5S ? 1 : 0) + (c6S ? 1 : 0) + (c7S ? 1 : 0) + (c8S ? 1 : 0)

// === VOLATILITY GATE ===
atrVal   = ta.atr(14)
atrAvg   = ta.sma(atrVal, 50)
// Aggressive mode requires some volatility — gate fires only when ATR is meaningful
volGate  = atrVal > atrAvg * 0.5 and atrVal < atrAvg * 3.0

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and volGate and longConfirms  >= minConfirms and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and volGate and shortConfirms >= minConfirms and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
// 5% trailing stop from entry price
longTrailStop  = strategy.position_avg_price * (1 - trailPct / 100)
shortTrailStop = strategy.position_avg_price * (1 + trailPct / 100)

// Momentum exit — when MACD histogram flips against position
longMomExit  = macdHist < 0 and macdHist[1] >= 0
shortMomExit = macdHist > 0 and macdHist[1] <= 0

// === STRATEGY ORDERS ===
qtyLevered = (strategy.equity * leverage) / close

if longEntry
    strategy.entry("Long", strategy.long, qty = qtyLevered)
if shortEntry
    strategy.entry("Short", strategy.short, qty = qtyLevered)

if strategy.position_size > 0
    strategy.exit("Long Trail", "Long", stop = longTrailStop)
    if longMomExit
        strategy.close("Long", comment = "Mom Exit")

if strategy.position_size < 0
    strategy.exit("Short Trail", "Short", stop = shortTrailStop)
    if shortMomExit
        strategy.close("Short", comment = "Mom Exit")

// === PLOTS AND LABELS ===
plot(dcHigh, "DC High", color = color.new(color.teal, 40), linewidth = 1)
plot(dcLow,  "DC Low",  color = color.new(color.teal, 40), linewidth = 1)
plot(dcMid,  "DC Mid",  color = color.new(color.gray, 60), linewidth = 1, style = plot.style_linebr)

plotshape(longEntry,  style = shape.triangleup,   location = location.belowbar, color = color.green, size = size.normal, title = "Long")
plotshape(shortEntry, style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.normal, title = "Short")`;

const AI_PICK_CODE = `//@version=5
strategy(
  title            = "NGS AI Pick — MACD + RSI + EMA Scanner",
  shorttitle       = "NGS-AIP",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
// These represent the "winning" parameters selected by the AI Pick optimizer.
// In the full platform, the optimizer backtests all combinations and injects
// the best-performing values here automatically.
emaFastLen    = input.int(21,   "EMA Fast",          minval = 5,   maxval = 100)
emaSlowLen    = input.int(89,   "EMA Slow",          minval = 20,  maxval = 500)
rsiLen        = input.int(14,   "RSI Length",        minval = 2,   maxval = 50)
rsiLow        = input.int(40,   "RSI Entry Low",     minval = 20,  maxval = 49)
rsiHigh       = input.int(60,   "RSI Entry High",    minval = 51,  maxval = 80)
macdFastLen   = input.int(12,   "MACD Fast",         minval = 3,   maxval = 50)
macdSlowLen   = input.int(26,   "MACD Slow",         minval = 10,  maxval = 100)
macdSigLen    = input.int(9,    "MACD Signal",       minval = 3,   maxval = 30)
riskScore     = input.float(8.5, "Optimizer Score",  minval = 0.0, maxval = 10.0, step = 0.1, tooltip = "Risk-adjusted score assigned by AI Pick optimizer")
signalSpacing = input.int(4,    "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
emaFast = ta.ema(close, emaFastLen)
emaSlow = ta.ema(close, emaSlowLen)
rsiVal  = ta.rsi(close, rsiLen)

[macdLine, macdSig, macdHist] = ta.macd(close, macdFastLen, macdSlowLen, macdSigLen)

// Slope of EMAs
emaFastSlope = emaFast - emaFast[3]
emaSlowSlope = emaSlow - emaSlow[3]

// Composite momentum score
momentumScore = (rsiVal - 50) / 50 + macdHist / ta.highest(math.abs(macdHist), 20)

// Volume filter
volSma   = ta.sma(volume, 20)
volOk    = volume > volSma * 0.8

// === TREND LOGIC ===
emaBullAlign = emaFast > emaSlow and emaFastSlope > 0 and emaSlowSlope > 0
emaBearAlign = emaFast < emaSlow and emaFastSlope < 0 and emaSlowSlope < 0

// EMA crossover signals
emaCrossUp   = ta.crossover(emaFast,  emaSlow)
emaCrossDown = ta.crossunder(emaFast, emaSlow)

// === CONFIRMATION LOGIC ===
// Long setup
c1L = emaBullAlign
c2L = rsiVal > rsiLow and rsiVal < rsiHigh + 10   // RSI in buy zone, not overbought
c3L = macdLine > macdSig
c4L = macdHist > 0
c5L = momentumScore > 0
c6L = volOk
c7L = close > emaFast
c8L = emaFastSlope > emaFastSlope[2]               // slope accelerating

longConfirms = (c1L ? 1 : 0) + (c2L ? 1 : 0) + (c3L ? 1 : 0) + (c4L ? 1 : 0) +
               (c5L ? 1 : 0) + (c6L ? 1 : 0) + (c7L ? 1 : 0) + (c8L ? 1 : 0)

// Short setup
c1S = emaBearAlign
c2S = rsiVal < rsiHigh and rsiVal > rsiLow - 10
c3S = macdLine < macdSig
c4S = macdHist < 0
c5S = momentumScore < 0
c6S = volOk
c7S = close < emaFast
c8S = emaFastSlope < emaFastSlope[2]

shortConfirms = (c1S ? 1 : 0) + (c2S ? 1 : 0) + (c3S ? 1 : 0) + (c4S ? 1 : 0) +
                (c5S ? 1 : 0) + (c6S ? 1 : 0) + (c7S ? 1 : 0) + (c8S ? 1 : 0)

// Min confirms scales with optimizer score — higher scored variants need fewer confirms
minConfirms = math.round(9 - riskScore)

// === VOLATILITY GATE ===
atrVal = ta.atr(14)
atrAvg = ta.sma(atrVal, 50)
volGate = atrVal > atrAvg * 0.3 and atrVal < atrAvg * 2.5

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and volGate and longConfirms  >= minConfirms and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and volGate and shortConfirms >= minConfirms and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
atrStop   = atrVal * 2.0
longStop  = close - atrStop
shortStop = close + atrStop

// Take profit at 3x ATR
longTP  = strategy.position_avg_price + atrVal * 3.0
shortTP = strategy.position_avg_price - atrVal * 3.0

// === STRATEGY ORDERS ===
if longEntry
    strategy.entry("Long", strategy.long)
if shortEntry
    strategy.entry("Short", strategy.short)

if strategy.position_size > 0
    strategy.exit("Long Exit", "Long", stop = longStop, limit = longTP)

if strategy.position_size < 0
    strategy.exit("Short Exit", "Short", stop = shortStop, limit = shortTP)

// === PLOTS AND LABELS ===
plot(emaFast, "EMA Fast", color = color.new(color.blue,   0), linewidth = 1)
plot(emaSlow, "EMA Slow", color = color.new(color.purple, 0), linewidth = 2)

plotshape(emaCrossUp,   title = "Cross Up",   style = shape.labelup,   location = location.belowbar, color = color.green, text = "AI↑", textcolor = color.white, size = size.small)
plotshape(emaCrossDown, title = "Cross Down", style = shape.labeldown, location = location.abovebar, color = color.red,   text = "AI↓", textcolor = color.white, size = size.small)

// Score label on last bar
if barstate.islast
    label.new(bar_index, high, "Score: " + str.tostring(riskScore, "#.#"), style = label.style_label_left, color = color.new(color.blue, 80), textcolor = color.white, size = size.small)`;

const DIP_BUYER_CODE = `//@version=5
strategy(
  title            = "NGS Buy Low Sell High — Dip Buyer Mean Reversion",
  shorttitle       = "NGS-BLSH",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
bbLen       = input.int(20,   "Bollinger Band Length",   minval = 5)
bbMult      = input.float(2.0, "BB Std Dev Multiplier",  minval = 0.5, step = 0.1)
rsiLen      = input.int(14,   "RSI Length",              minval = 2)
rsiOversold = input.int(30,   "RSI Oversold Threshold",  minval = 10, maxval = 45)
squeezeLen  = input.int(20,   "Squeeze Lookback",        minval = 5)
volConfirm  = input.float(1.1, "Volume Confirmation ×",  minval = 0.5, step = 0.1)
signalSpacing = input.int(5,  "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
// Bollinger Bands
[bbMid, bbUpper, bbLower] = ta.bb(close, bbLen, bbMult)
bbWidth    = (bbUpper - bbLower) / bbMid
bbWidthAvg = ta.sma(bbWidth, squeezeLen)

// RSI
rsiVal = ta.rsi(close, rsiLen)

// Volume
volSma   = ta.sma(volume, 20)
volSpike = volume > volSma * volConfirm

// Stochastic for additional timing
[stochK, stochD] = ta.stoch(close, high, low, 14), ta.sma(ta.stoch(close, high, low, 14), 3)

// ATR for stop placement
atrVal = ta.atr(14)

// === TREND LOGIC ===
// Detect BB squeeze — low volatility precedes expansion
squeeze = bbWidth < bbWidthAvg * 0.8

// Price relative to bands
nearLower = close <= bbLower * 1.01  // within 1% of lower band
nearUpper = close >= bbUpper * 0.99  // within 1% of upper band

// Mean reversion bias — prefer when price is below the midline
belowMid = close < bbMid
aboveMid = close > bbMid

// === CONFIRMATION LOGIC ===
// Dip buy (long) — 8 confirmations
c1L = nearLower                   // touching lower band
c2L = rsiVal < rsiOversold + 10   // RSI approaching oversold
c3L = rsiVal > 15                 // not in extreme crash
c4L = stochK < 25                 // stochastic oversold
c5L = volSpike                    // volume confirms the dip
c6L = close > close[1]            // current bar recovering (green candle)
c7L = belowMid                    // below the BB midline
c8L = rsiVal > rsiVal[1]          // RSI turning up

longConfirms = (c1L ? 1 : 0) + (c2L ? 1 : 0) + (c3L ? 1 : 0) + (c4L ? 1 : 0) +
               (c5L ? 1 : 0) + (c6L ? 1 : 0) + (c7L ? 1 : 0) + (c8L ? 1 : 0)

// Sell at upper band (short or exit) — 8 confirmations
c1S = nearUpper
c2S = rsiVal > 70
c3S = rsiVal < 90
c4S = stochK > 75
c5S = aboveMid
c6S = close < close[1]            // rejection candle
c7S = rsiVal < rsiVal[1]          // RSI rolling over
c8S = bbWidth > bbWidthAvg        // bands expanding after squeeze

shortConfirms = (c1S ? 1 : 0) + (c2S ? 1 : 0) + (c3S ? 1 : 0) + (c4S ? 1 : 0) +
                (c5S ? 1 : 0) + (c6S ? 1 : 0) + (c7S ? 1 : 0) + (c8S ? 1 : 0)

// === VOLATILITY GATE ===
// Mean reversion works best in low-to-moderate volatility
atrAvg  = ta.sma(atrVal, 50)
volGate = atrVal < atrAvg * 2.0 and atrVal > atrAvg * 0.2

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and volGate and longConfirms  >= 6 and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and volGate and shortConfirms >= 6 and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
// Long: target upper band, stop below lower band
longTarget = bbUpper
longStop   = bbLower - atrVal * 0.5

// Short: target lower band, stop above upper band
shortTarget = bbLower
shortStop   = bbUpper + atrVal * 0.5

// === STRATEGY ORDERS ===
if longEntry
    strategy.entry("DipBuy", strategy.long)
if shortEntry
    strategy.entry("BandSell", strategy.short)

if strategy.position_size > 0
    strategy.exit("DipBuy Exit", "DipBuy", limit = longTarget, stop = longStop)

if strategy.position_size < 0
    strategy.exit("BandSell Exit", "BandSell", limit = shortTarget, stop = shortStop)

// === PLOTS AND LABELS ===
p1 = plot(bbUpper, "BB Upper", color = color.new(color.blue, 50), linewidth = 1)
p2 = plot(bbMid,   "BB Mid",   color = color.new(color.gray, 50), linewidth = 1, style = plot.style_linebr)
p3 = plot(bbLower, "BB Lower", color = color.new(color.blue, 50), linewidth = 1)
fill(p1, p3, color = color.new(color.blue, 92))

plotshape(longEntry,  title = "Dip Buy",  style = shape.triangleup,   location = location.belowbar, color = color.green, size = size.small)
plotshape(shortEntry, title = "Band Sell",style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.small)

bgcolor(squeeze ? color.new(color.yellow, 92) : na, title = "Squeeze")`;

const NNFX_CODE = `//@version=5
strategy(
  title            = "NGS Aggressive — NNFX Composite Hybrid",
  shorttitle       = "NGS-NNFX",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
cciLen       = input.int(20,   "CCI Baseline Length",     minval = 5)
cciThresh    = input.int(100,  "CCI Trend Threshold",     minval = 50, maxval = 200)
stochKLen    = input.int(14,   "Stochastic %K Length",    minval = 3)
stochDLen    = input.int(3,    "Stochastic %D Smooth",    minval = 1)
adxLen       = input.int(14,   "ADX Length",              minval = 5)
adxGate      = input.int(20,   "ADX Minimum Threshold",   minval = 10, maxval = 40)
leverage     = input.float(4.0, "Leverage",               minval = 1.0, step = 0.5)
trailPct     = input.float(5.0, "Trailing Stop %",        minval = 0.5, step = 0.1)
minConfirms  = input.int(5,    "Min Confirmations (of 8)", minval = 1, maxval = 8)
signalSpacing = input.int(3,   "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
// CCI as trend baseline
cciVal = ta.cci(close, cciLen)

// Stochastic as confirmation
stochK = ta.stoch(close, high, low, stochKLen)
stochD = ta.sma(stochK, stochDLen)

// ADX / DMI as volatility gate
[diPlus, diMinus, adxVal] = ta.dmi(adxLen, adxLen)

// EMA for additional trend bias
ema50  = ta.ema(close, 50)
ema200 = ta.ema(close, 200)

// ATR for position sizing and stops
atrVal = ta.atr(14)

// Volume confirmation
volSma   = ta.sma(volume, 20)
volRatio = volume / volSma

// === TREND LOGIC ===
// CCI baseline: above +threshold = bullish, below -threshold = bearish
cciBull = cciVal > cciThresh
cciBear = cciVal < -cciThresh

// Long-term EMA filter
emaBull = ema50 > ema200
emaBear = ema50 < ema200

// DMI directional
dmiBull = diPlus > diMinus
dmiBear = diMinus > diPlus

// === CONFIRMATION LOGIC ===
// Long confirmations (full NNFX stack)
c1L = cciBull                           // CCI baseline bullish
c2L = emaBull                           // long-term trend aligned
c3L = dmiBull                           // DMI confirming direction
c4L = stochK > 50                       // stochastic momentum
c5L = ta.crossover(stochK, stochD)      // stochastic cross confirmation
c6L = volRatio > 1.0                    // adequate volume
c7L = close > ema50                     // price above medium EMA
c8L = cciVal > cciVal[2]               // CCI accelerating

longConfirms = (c1L ? 1 : 0) + (c2L ? 1 : 0) + (c3L ? 1 : 0) + (c4L ? 1 : 0) +
               (c5L ? 1 : 0) + (c6L ? 1 : 0) + (c7L ? 1 : 0) + (c8L ? 1 : 0)

// Short confirmations
c1S = cciBear
c2S = emaBear
c3S = dmiBear
c4S = stochK < 50
c5S = ta.crossunder(stochK, stochD)
c6S = volRatio > 1.0
c7S = close < ema50
c8S = cciVal < cciVal[2]

shortConfirms = (c1S ? 1 : 0) + (c2S ? 1 : 0) + (c3S ? 1 : 0) + (c4S ? 1 : 0) +
                (c5S ? 1 : 0) + (c6S ? 1 : 0) + (c7S ? 1 : 0) + (c8S ? 1 : 0)

// === VOLATILITY GATE ===
// ADX must confirm a trend is present
adxGateOk = adxVal >= adxGate
atrAvg    = ta.sma(atrVal, 50)
atrGateOk = atrVal > atrAvg * 0.4 and atrVal < atrAvg * 3.0

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and adxGateOk and atrGateOk and longConfirms  >= minConfirms and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and adxGateOk and atrGateOk and shortConfirms >= minConfirms and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
// Trailing stop percentage-based
longTrailStop  = strategy.position_avg_price * (1 - trailPct / 100)
shortTrailStop = strategy.position_avg_price * (1 + trailPct / 100)

// CCI baseline flip as momentum exit
longBaseExit  = cciVal < 0
shortBaseExit = cciVal > 0

// === STRATEGY ORDERS ===
qtyLevered = (strategy.equity * leverage) / close

if longEntry
    strategy.entry("Long", strategy.long, qty = qtyLevered)
if shortEntry
    strategy.entry("Short", strategy.short, qty = qtyLevered)

if strategy.position_size > 0
    strategy.exit("Long Trail", "Long", stop = longTrailStop)
    if longBaseExit
        strategy.close("Long", comment = "CCI Flip")

if strategy.position_size < 0
    strategy.exit("Short Trail", "Short", stop = shortTrailStop)
    if shortBaseExit
        strategy.close("Short", comment = "CCI Flip")

// === PLOTS AND LABELS ===
plot(ema50,  "EMA 50",  color = color.new(color.yellow, 20), linewidth = 1)
plot(ema200, "EMA 200", color = color.new(color.white,  20), linewidth = 2)

plotshape(longEntry,  title = "Long",  style = shape.triangleup,   location = location.belowbar, color = color.lime,  size = size.normal)
plotshape(shortEntry, title = "Short", style = shape.triangledown, location = location.abovebar, color = color.red,   size = size.normal)

bgcolor(longEntry  ? color.new(color.green, 88) : na)
bgcolor(shortEntry ? color.new(color.red,   88) : na)`;

const CYCLE_DETECTION_CODE = `//@version=5
strategy(
  title            = "NGS Buy Low Sell High — Cycle Detection",
  shorttitle       = "NGS-CYC",
  overlay          = true,
  default_qty_type = strategy.percent_of_equity,
  default_qty_value = 10,
  initial_capital  = 10000,
  commission_type  = strategy.commission.percent,
  commission_value = 0.05
)

// === INPUTS ===
dpoLen        = input.int(20,  "DPO Length",              minval = 5)
wrLen         = input.int(14,  "Williams %R Length",      minval = 3)
wrOversold    = input.int(-80, "Williams %R Oversold",    minval = -99, maxval = -51)
wrOverbought  = input.int(-20, "Williams %R Overbought",  minval = -49, maxval = -1)
haMaLen       = input.int(5,   "Heikin-Ashi MA Smooth",   minval = 1)
rsiLen        = input.int(14,  "RSI Length",              minval = 2)
cycleLookback = input.int(40,  "Cycle Lookback Period",   minval = 10)
signalSpacing = input.int(6,   "Min Bars Between Signals", minval = 1)

// === INDICATOR CALCULATIONS ===
// Detrended Price Oscillator
// DPO = close[n/2+1] - SMA(close, n)
dpoPeriod  = math.floor(dpoLen / 2) + 1
dpoSma     = ta.sma(close, dpoLen)
dpoVal     = close[dpoPeriod] - dpoSma

// Williams %R
wrVal = ta.wpr(wrLen)

// Heikin-Ashi smoothed values for cleaner signals
haClose = (open + high + low + close) / 4
haOpen  = ta.ema(open, haMaLen)
haDelta = haClose - haOpen
haBull  = haDelta > 0
haBear  = haDelta < 0

// RSI for trend bias
rsiVal = ta.rsi(close, rsiLen)

// Cycle phase detection using DPO zero crossings
dpoCrossUp   = ta.crossover(dpoVal,  0)
dpoCrossDown = ta.crossunder(dpoVal, 0)

// Identify cycle trough and peak
cycleHigh = ta.highest(dpoVal, cycleLookback)
cycleLow  = ta.lowest(dpoVal,  cycleLookback)
dpoNorm   = (dpoVal - cycleLow) / math.max(cycleHigh - cycleLow, 0.0001)

// ATR for stops
atrVal = ta.atr(14)

// Volume
volSma = ta.sma(volume, 20)
volOk  = volume > volSma * 0.8

// === TREND LOGIC ===
// Cycle bottom: DPO crossing up from below zero + Williams %R oversold
cycleBottom = dpoCrossUp and wrVal < wrOversold + 10
cycleTop    = dpoCrossDown and wrVal > wrOverbought - 10

// Normalized DPO position
nearBottom = dpoNorm < 0.25   // DPO in lower quartile of cycle
nearTop    = dpoNorm > 0.75   // DPO in upper quartile of cycle

// === CONFIRMATION LOGIC ===
// Long — buying into cycle trough (8 confirmations)
c1L = nearBottom or dpoCrossUp           // DPO near trough
c2L = wrVal < wrOversold + 20            // Williams %R oversold zone
c3L = wrVal > wrVal[1]                   // Williams %R turning up
c4L = haBull                             // Heikin-Ashi bullish
c5L = rsiVal > 30 and rsiVal < 55        // RSI recovering but not overbought
c6L = volOk                              // adequate volume
c7L = close > low[1]                     // not making lower lows
c8L = dpoVal > dpoVal[1]                 // DPO rising

longConfirms = (c1L ? 1 : 0) + (c2L ? 1 : 0) + (c3L ? 1 : 0) + (c4L ? 1 : 0) +
               (c5L ? 1 : 0) + (c6L ? 1 : 0) + (c7L ? 1 : 0) + (c8L ? 1 : 0)

// Short — selling into cycle peak (8 confirmations)
c1S = nearTop or dpoCrossDown
c2S = wrVal > wrOverbought - 20
c3S = wrVal < wrVal[1]
c4S = haBear
c5S = rsiVal > 50 and rsiVal < 80
c6S = volOk
c7S = close < high[1]
c8S = dpoVal < dpoVal[1]

shortConfirms = (c1S ? 1 : 0) + (c2S ? 1 : 0) + (c3S ? 1 : 0) + (c4S ? 1 : 0) +
                (c5S ? 1 : 0) + (c6S ? 1 : 0) + (c7S ? 1 : 0) + (c8S ? 1 : 0)

// === VOLATILITY GATE ===
// Cycle strategies prefer moderate, non-extreme volatility
atrAvg  = ta.sma(atrVal, 50)
volGate = atrVal > atrAvg * 0.2 and atrVal < atrAvg * 1.8

// === ENTRY CONDITIONS ===
var int lastSignalBar = na
barsSinceLast = na(lastSignalBar) ? signalSpacing + 1 : bar_index - lastSignalBar
spacingOk = barsSinceLast >= signalSpacing

longEntry  = barstate.isconfirmed and spacingOk and volGate and longConfirms  >= 6 and strategy.position_size == 0
shortEntry = barstate.isconfirmed and spacingOk and volGate and shortConfirms >= 6 and strategy.position_size == 0

if longEntry
    lastSignalBar := bar_index
if shortEntry
    lastSignalBar := bar_index

// === EXIT CONDITIONS ===
// Long: exit when DPO reaches upper quartile or Williams %R overbought
longExitCond  = nearTop or wrVal > wrOverbought
// Short: exit when DPO reaches lower quartile or Williams %R oversold
shortExitCond = nearBottom or wrVal < wrOversold

// ATR stop loss
longStop  = strategy.position_avg_price - atrVal * 1.5
shortStop = strategy.position_avg_price + atrVal * 1.5

// === STRATEGY ORDERS ===
if longEntry
    strategy.entry("CycleBottom", strategy.long)
if shortEntry
    strategy.entry("CycleTop", strategy.short)

if strategy.position_size > 0
    strategy.exit("CycleBottom Exit", "CycleBottom", stop = longStop)
    if longExitCond
        strategy.close("CycleBottom", comment = "Cycle Peak")

if strategy.position_size < 0
    strategy.exit("CycleTop Exit", "CycleTop", stop = shortStop)
    if shortExitCond
        strategy.close("CycleTop", comment = "Cycle Trough")

// === PLOTS AND LABELS ===
plotshape(longEntry,  title = "Cycle Bottom", style = shape.circle,       location = location.belowbar, color = color.new(color.green,  20), size = size.small)
plotshape(shortEntry, title = "Cycle Top",    style = shape.circle,       location = location.abovebar, color = color.new(color.red,    20), size = size.small)
plotshape(cycleBottom, title = "DPO Up X",   style = shape.triangleup,   location = location.belowbar, color = color.new(color.teal,   40), size = size.tiny)
plotshape(cycleTop,    title = "DPO Down X", style = shape.triangledown, location = location.abovebar, color = color.new(color.orange, 40), size = size.tiny)

bgcolor(nearBottom ? color.new(color.green, 94) : na, title = "Cycle Bottom Zone")
bgcolor(nearTop    ? color.new(color.red,   94) : na, title = "Cycle Top Zone")`;

// ─── Strategy Data ────────────────────────────────────────────────────────────

const INITIAL_STRATEGY_SAMPLES: StrategySample[] = [
  {
    id: "conservative-ema-rsi",
    name: "Conservative EMA + RSI Confluence",
    mode: "conservative",
    description:
      "EMA 50/200 crossover combined with RSI overbought/oversold filter and ATR-based trailing stop. Requires 7 of 8 confirmation signals before entry. Designed for patient, high-probability setups.",
    bestFor: "Trending markets, swing trades",
    timeframe: "1D, 4H",
    indicators: ["EMA 50/200", "RSI 14", "MACD", "ATR 14", "Volume SMA"],
    riskLevel: "Low",
    score: 8,
    code: CONSERVATIVE_EMA_RSI_CODE,
  },
  {
    id: "aggressive-momentum-breakout",
    name: "Aggressive Momentum Breakout",
    mode: "aggressive",
    description:
      "Donchian Channel breakout confirmed by MACD histogram expansion and ADX trend strength. Uses 4.0x leverage with a 5% trailing stop. Targets strong directional moves with volume surge confirmation.",
    bestFor: "Strong trending markets, breakouts",
    timeframe: "1H, 4H",
    indicators: ["Donchian Channel", "MACD", "ADX/DMI", "RSI 14", "Volume"],
    riskLevel: "High",
    score: 7,
    code: AGGRESSIVE_MOMENTUM_CODE,
  },
  {
    id: "ai-pick-macd-rsi-ema",
    name: "MACD + RSI + EMA Variant Scanner (AI Pick)",
    mode: "ai-pick",
    description:
      "Backtests multiple MACD/RSI/EMA parameter combinations and deploys the best-performing variant by risk-adjusted score. Min confirmations scale dynamically with the optimizer score.",
    bestFor: "Any market, automated parameter optimization",
    timeframe: "1D",
    indicators: ["EMA (variable)", "RSI (variable)", "MACD (variable)", "ATR", "Volume"],
    riskLevel: "Medium",
    score: 9,
    code: AI_PICK_CODE,
  },
  {
    id: "blsh-dip-buyer",
    name: "Dip Buyer Mean Reversion (Buy Low Sell High)",
    mode: "buy-low-sell-high",
    description:
      "Bollinger Band squeeze detection with RSI oversold dip entry and Stochastic timing confirmation. Buys price touching the lower band, exits at the upper band. Requires volume spike to validate the dip.",
    bestFor: "Ranging markets, mean-reverting assets",
    timeframe: "1D, 4H",
    indicators: ["Bollinger Bands", "RSI 14", "Stochastic", "ATR 14", "Volume"],
    riskLevel: "Medium",
    score: 8,
    code: DIP_BUYER_CODE,
  },
  {
    id: "aggressive-nnfx-composite",
    name: "NNFX Composite Hybrid",
    mode: "aggressive",
    description:
      "Full NNFX (No Nonsense Forex) framework: CCI as trend baseline, Stochastic as layered confirmation, ADX as volatility gate. 4.0x leverage with percentage trailing stop and CCI-flip momentum exit.",
    bestFor: "Forex, crypto — strong directional trends",
    timeframe: "4H, 1D",
    indicators: ["CCI 20", "Stochastic", "ADX/DMI", "EMA 50/200", "ATR"],
    riskLevel: "High",
    score: 9,
    code: NNFX_CODE,
  },
  {
    id: "blsh-cycle-detection",
    name: "Cycle Detection Buy Low Sell High",
    mode: "buy-low-sell-high",
    description:
      "Detrended Price Oscillator identifies market cycle troughs and peaks, confirmed by Williams %R and Heikin-Ashi smoothing. Buys into cycle bottoms and sells into cycle tops for systematic timing.",
    bestFor: "Cyclical assets, ranging markets",
    timeframe: "1D",
    indicators: ["DPO 20", "Williams %R", "Heikin-Ashi", "RSI 14", "Volume"],
    riskLevel: "Low",
    score: 7,
    code: CYCLE_DETECTION_CODE,
  },
];

// ─── Helper maps ──────────────────────────────────────────────────────────────

const MODE_LABELS: Record<StrategyMode, string> = {
  conservative: "Conservative",
  aggressive: "Aggressive",
  "ai-pick": "AI Pick",
  "buy-low-sell-high": "Buy Low Sell High",
};

const MODE_BADGE_CLASSES: Record<StrategyMode, string> = {
  conservative: "bg-green-500/15 text-green-400 border-green-500/30",
  aggressive: "bg-red-500/15 text-red-400 border-red-500/30",
  "ai-pick": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "buy-low-sell-high": "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const MODE_ICONS: Record<StrategyMode, React.ElementType> = {
  conservative: Shield,
  aggressive: Zap,
  "ai-pick": Target,
  "buy-low-sell-high": TrendingUp,
};

const RISK_BADGE_CLASSES: Record<RiskLevel, string> = {
  Low: "bg-green-500/15 text-green-400 border-green-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  High: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SCORE_COLOR = (score: number): string => {
  if (score >= 9) return "text-green-400";
  if (score >= 7) return "text-yellow-400";
  return "text-red-400";
};

// Default leverage per mode
const MODE_DEFAULT_LEVERAGE: Record<StrategyMode, number> = {
  conservative: 2.5,
  aggressive: 4.0,
  "ai-pick": 2.5,
  "buy-low-sell-high": 2.5,
};

// Default timeframe per strategy (parsed from the timeframe string to the first value)
function parseDefaultTimeframe(timeframeStr: string): Timeframe {
  const lower = timeframeStr.toLowerCase();
  if (lower.includes("1h")) return "1h";
  if (lower.includes("4h")) return "4h";
  return "1d";
}

type ModeFilter = "all" | StrategyMode;
type RiskFilter = "all" | RiskLevel;

// ─── Pine Script snippet builder (for chat-generated strategies) ───────────────

interface IndicatorSnippets {
  inputs: string[];
  calculations: string[];
  longConditions: string[];
  shortConditions: string[];
  plots: string[];
}

function buildIndicatorSnippets(indicators: string[]): IndicatorSnippets {
  const snippets: IndicatorSnippets = {
    inputs: [],
    calculations: [],
    longConditions: [],
    shortConditions: [],
    plots: [],
  };

  const lower = indicators.map((i) => i.toLowerCase());

  if (lower.some((i) => i.includes("rsi"))) {
    snippets.inputs.push('rsiLength = input.int(14, "RSI Length", minval = 2)');
    snippets.inputs.push('rsiOversold = input.int(30, "RSI Oversold", minval = 10, maxval = 45)');
    snippets.inputs.push('rsiOverbought = input.int(70, "RSI Overbought", minval = 55, maxval = 90)');
    snippets.calculations.push("rsiVal = ta.rsi(close, rsiLength)");
    snippets.longConditions.push("rsiVal < rsiOverbought and rsiVal > rsiOversold");
    snippets.shortConditions.push("rsiVal > rsiOversold and rsiVal < rsiOverbought");
    snippets.plots.push('// RSI plotted on separate pane in TradingView');
  }

  if (lower.some((i) => i.includes("macd"))) {
    snippets.inputs.push('macdFast = input.int(12, "MACD Fast", minval = 3)');
    snippets.inputs.push('macdSlow = input.int(26, "MACD Slow", minval = 10)');
    snippets.inputs.push('macdSig = input.int(9, "MACD Signal", minval = 3)');
    snippets.calculations.push("[macdLine, macdSignal, macdHist] = ta.macd(close, macdFast, macdSlow, macdSig)");
    snippets.longConditions.push("macdLine > macdSignal and macdHist > 0");
    snippets.shortConditions.push("macdLine < macdSignal and macdHist < 0");
  }

  if (lower.some((i) => i.includes("ema"))) {
    snippets.inputs.push('emaFast = input.int(21, "EMA Fast", minval = 5)');
    snippets.inputs.push('emaSlow = input.int(89, "EMA Slow", minval = 20)');
    snippets.calculations.push("emaFastVal = ta.ema(close, emaFast)");
    snippets.calculations.push("emaSlowVal = ta.ema(close, emaSlow)");
    snippets.longConditions.push("emaFastVal > emaSlowVal and close > emaFastVal");
    snippets.shortConditions.push("emaFastVal < emaSlowVal and close < emaFastVal");
    snippets.plots.push('plot(emaFastVal, "EMA Fast", color = color.new(color.blue, 0), linewidth = 1)');
    snippets.plots.push('plot(emaSlowVal, "EMA Slow", color = color.new(color.orange, 0), linewidth = 2)');
  }

  if (lower.some((i) => i.includes("bollinger") || i.includes("bb"))) {
    snippets.inputs.push('bbLen = input.int(20, "BB Length", minval = 5)');
    snippets.inputs.push('bbMult = input.float(2.0, "BB Mult", minval = 0.5, step = 0.1)');
    snippets.calculations.push("[bbMid, bbUpper, bbLower] = ta.bb(close, bbLen, bbMult)");
    snippets.longConditions.push("close <= bbLower * 1.01");
    snippets.shortConditions.push("close >= bbUpper * 0.99");
    snippets.plots.push('p1 = plot(bbUpper, "BB Upper", color = color.new(color.blue, 50))');
    snippets.plots.push('p3 = plot(bbLower, "BB Lower", color = color.new(color.blue, 50))');
    snippets.plots.push("fill(p1, p3, color = color.new(color.blue, 92))");
  }

  if (lower.some((i) => i.includes("stochastic") || i.includes("stoch"))) {
    snippets.inputs.push('stochLen = input.int(14, "Stoch %K Length", minval = 3)');
    snippets.inputs.push('stochSmooth = input.int(3, "Stoch %D Smooth", minval = 1)');
    snippets.calculations.push("stochK = ta.stoch(close, high, low, stochLen)");
    snippets.calculations.push("stochD = ta.sma(stochK, stochSmooth)");
    snippets.longConditions.push("stochK < 30 and ta.crossover(stochK, stochD)");
    snippets.shortConditions.push("stochK > 70 and ta.crossunder(stochK, stochD)");
  }

  if (lower.some((i) => i.includes("adx"))) {
    snippets.inputs.push('adxLen = input.int(14, "ADX Length", minval = 5)');
    snippets.inputs.push('adxThresh = input.int(25, "ADX Threshold", minval = 10, maxval = 50)');
    snippets.calculations.push("[diPlus, diMinus, adxVal] = ta.dmi(adxLen, adxLen)");
    snippets.longConditions.push("adxVal > adxThresh and diPlus > diMinus");
    snippets.shortConditions.push("adxVal > adxThresh and diMinus > diPlus");
  }

  if (lower.some((i) => i.includes("cci"))) {
    snippets.inputs.push('cciLen = input.int(20, "CCI Length", minval = 5)');
    snippets.inputs.push('cciThresh = input.int(100, "CCI Threshold", minval = 50, maxval = 200)');
    snippets.calculations.push("cciVal = ta.cci(close, cciLen)");
    snippets.longConditions.push("cciVal > cciThresh");
    snippets.shortConditions.push("cciVal < -cciThresh");
  }

  if (lower.some((i) => i.includes("vwap"))) {
    snippets.calculations.push("vwapVal = ta.vwap(close)");
    snippets.longConditions.push("close > vwapVal");
    snippets.shortConditions.push("close < vwapVal");
    snippets.plots.push('plot(vwapVal, "VWAP", color = color.new(color.purple, 0), linewidth = 2)');
  }

  // Always include volume and ATR
  snippets.calculations.push("volSma = ta.sma(volume, 20)");
  snippets.calculations.push("atrVal = ta.atr(14)");
  snippets.longConditions.push("volume > volSma * 0.8");
  snippets.shortConditions.push("volume > volSma * 0.8");

  return snippets;
}

function generatePineScript(
  name: string,
  mode: StrategyMode,
  indicators: string[],
  leverage: number
): string {
  const shorttitle = `NGS-${mode.toUpperCase().slice(0, 3)}`;
  const snippets = buildIndicatorSnippets(indicators);

  const longConds = snippets.longConditions
    .map((c, i) => `c${i + 1}L = ${c}`)
    .join("\n");
  const shortConds = snippets.shortConditions
    .map((c, i) => `c${i + 1}S = ${c}`)
    .join("\n");

  const longCount = snippets.longConditions
    .map((_, i) => `(c${i + 1}L ? 1 : 0)`)
    .join(" + ");
  const shortCount = snippets.shortConditions
    .map((_, i) => `(c${i + 1}S ? 1 : 0)`)
    .join(" + ");

  const minConfirms = Math.max(1, snippets.longConditions.length - 1);

  return `//@version=5
strategy(
  title            = "${name}",
  shorttitle       = "${shorttitle}",
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

// === TREND LOGIC ===
// Long and short conditions derived from detected indicators

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

// ─── Chat strategy parser ─────────────────────────────────────────────────────

function parseStrategyFromChat(message: string): StrategySample {
  const lower = message.toLowerCase();

  // Determine mode
  let mode: StrategyMode = "conservative";
  if (
    lower.includes("aggressive") ||
    lower.includes("breakout") ||
    lower.includes("momentum") ||
    lower.includes("high leverage")
  ) {
    mode = "aggressive";
  } else if (
    lower.includes("ai pick") ||
    lower.includes("optimize") ||
    lower.includes("scan") ||
    lower.includes("variant")
  ) {
    mode = "ai-pick";
  } else if (
    lower.includes("buy low") ||
    lower.includes("sell high") ||
    lower.includes("mean reversion") ||
    lower.includes("dip") ||
    lower.includes("cycle")
  ) {
    mode = "buy-low-sell-high";
  } else if (
    lower.includes("conservative") ||
    lower.includes("safe") ||
    lower.includes("low risk") ||
    lower.includes("patient")
  ) {
    mode = "conservative";
  }

  // Extract indicators
  const INDICATOR_KEYWORDS: { pattern: RegExp; label: string }[] = [
    { pattern: /\brsi\b/i, label: "RSI 14" },
    { pattern: /\bmacd\b/i, label: "MACD" },
    { pattern: /\bema\b/i, label: "EMA" },
    { pattern: /bollinger|bband|bb\b/i, label: "Bollinger Bands" },
    { pattern: /stochastic|stoch\b/i, label: "Stochastic" },
    { pattern: /\badx\b/i, label: "ADX/DMI" },
    { pattern: /\bcci\b/i, label: "CCI" },
    { pattern: /\bvwap\b/i, label: "VWAP" },
    { pattern: /williams|%r\b/i, label: "Williams %R" },
    { pattern: /donchian/i, label: "Donchian Channel" },
    { pattern: /\batr\b/i, label: "ATR 14" },
    { pattern: /volume/i, label: "Volume" },
  ];

  const indicators: string[] = [];
  for (const { pattern, label } of INDICATOR_KEYWORDS) {
    if (pattern.test(message)) {
      indicators.push(label);
    }
  }
  if (indicators.length === 0) {
    // Default to EMA + RSI if nothing detected
    indicators.push("EMA", "RSI 14");
  }

  // Extract timeframe
  let timeframe: Timeframe = "1d";
  if (/\b4h\b|\b4-?hour/i.test(message)) timeframe = "4h";
  else if (/\b1h\b|\b1-?hour/i.test(message)) timeframe = "1h";
  else if (/\b1d\b|\bdaily\b|\b1-?day/i.test(message)) timeframe = "1d";

  // Extract symbol
  let symbol = "BTC-USD";
  const symMatch = message.match(/\b([A-Z]{2,5}-?USD[T]?|[A-Z]{1,5}\/USD)\b/);
  if (symMatch) symbol = symMatch[1];
  else if (/stock|equity|spy|qqq/i.test(message)) symbol = "SPY";
  else if (/forex|eur|gbp|jpy/i.test(message)) symbol = "EURUSD=X";

  // Risk level based on mode
  const riskMap: Record<StrategyMode, RiskLevel> = {
    conservative: "Low",
    aggressive: "High",
    "ai-pick": "Medium",
    "buy-low-sell-high": "Medium",
  };

  // Generate name from message — extract first meaningful phrase
  const wordsRaw = message
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const nameBase = wordsRaw.join(" ") || "Custom Strategy";
  const name = nameBase.length > 50 ? nameBase.slice(0, 47) + "..." : nameBase;

  const leverage = MODE_DEFAULT_LEVERAGE[mode];
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    name,
    mode,
    description: message.slice(0, 200),
    bestFor: mode === "conservative"
      ? "Trending markets, swing trades"
      : mode === "aggressive"
      ? "Strong trending markets, breakouts"
      : mode === "ai-pick"
      ? "Any market, automated optimization"
      : "Ranging markets, mean-reverting assets",
    timeframe: timeframe.toUpperCase(),
    indicators,
    riskLevel: riskMap[mode],
    score: 7,
    code: generatePineScript(name, mode, indicators, leverage),
  };
}

// ─── Chat message type ────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

// ─── Backtest run panel (per card) ────────────────────────────────────────────

interface BacktestPanelProps {
  sample: StrategySample;
  isGloballyRunning: boolean;
  onRunStart: () => void;
  onRunEnd: () => void;
}

function BacktestPanel({
  sample,
  isGloballyRunning,
  onRunStart,
  onRunEnd,
}: BacktestPanelProps) {
  const [symbol, setSymbol] = useState("BTC-USD");
  const [timeframe, setTimeframe] = useState<Timeframe>(
    parseDefaultTimeframe(sample.timeframe)
  );
  const [leverage, setLeverage] = useState<string>(
    String(MODE_DEFAULT_LEVERAGE[sample.mode])
  );
  interface RunResult {
    runId: number;
    modeName: string;
    symbol: string;
    totalReturnPct: number;
    maxDrawdownPct: number;
    tradeCount: number;
    sharpeLike: number;
  }

  const [result, setResult] = useState<RunResult | null>(null);

  const mutation = useMutation<RunResult, Error, RunStrategyRequest>({
    mutationFn: async (req) => {
      // All three endpoints return a flat BacktestOut: { id, user_id, mode_name, ... }
      let run: { id: number; mode_name: string; symbol: string; error_message: string | null };
      if (sample.mode === "ai-pick") run = await strategyApi.runAiPick(req) as any;
      else if (sample.mode === "buy-low-sell-high") run = await strategyApi.runBuyLowSellHigh(req) as any;
      else run = await backtestApi.run(req) as any;

      if (run.error_message) throw new Error(run.error_message);

      // Fetch trades to compute stats
      const trades = await backtestApi.trades(run.id).catch(() => []);
      const totalReturnPct = trades.reduce((sum, t) => sum + (t.leveraged_return_pct ?? t.return_pct ?? 0), 0);
      const maxDrawdownPct = trades.length > 0
        ? Math.min(...trades.map((t) => t.leveraged_return_pct ?? t.return_pct ?? 0))
        : 0;
      const avgReturn = trades.length > 0 ? totalReturnPct / trades.length : 0;
      const stdDev = trades.length > 1
        ? Math.sqrt(trades.reduce((sum, t) => sum + Math.pow((t.leveraged_return_pct ?? t.return_pct ?? 0) - avgReturn, 2), 0) / (trades.length - 1))
        : 1;
      const sharpeLike = stdDev > 0 ? avgReturn / stdDev : 0;

      return {
        runId: run.id,
        modeName: run.mode_name,
        symbol: run.symbol,
        totalReturnPct,
        maxDrawdownPct,
        tradeCount: trades.length,
        sharpeLike,
      };
    },
    onMutate: () => {
      onRunStart();
    },
    onSuccess: (data) => {
      setResult(data);
      onRunEnd();
      toast.success("Backtest completed successfully");
    },
    onError: (err) => {
      onRunEnd();
      toast.error(`Backtest failed: ${err.message}`);
    },
  });

  function handleRun() {
    const parsedLeverage = parseFloat(leverage);
    mutation.mutate({
      symbol: symbol.trim() || "BTC-USD",
      timeframe,
      mode: sample.mode,
      leverage: isNaN(parsedLeverage) ? undefined : parsedLeverage,
      dry_run: true,
    });
  }

  const isPending = mutation.isPending;
  const canRun = !isPending && !isGloballyRunning;

  return (
    <div className="mt-1 rounded-sm border border-border/10 bg-surface-lowest">
      <div className="px-4 py-3 border-b border-border/10">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Run Backtest</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Parameters for {sample.name}
        </p>
      </div>

      {/* Input fields */}
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Symbol</label>
          <Input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="h-8 text-xs"
            placeholder="BTC-USD"
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Timeframe</label>
          <Select
            value={timeframe}
            onValueChange={(v) => setTimeframe(v as Timeframe)}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="4h">4H</SelectItem>
              <SelectItem value="1h">1H</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Leverage</label>
          <Input
            value={leverage}
            onChange={(e) => setLeverage(e.target.value)}
            className="h-8 text-xs"
            type="number"
            step="0.5"
            min="1"
            disabled={isPending}
          />
        </div>
      </div>

      <div className="px-4 pb-3">
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-primary text-primary-foreground font-bold uppercase tracking-widest gap-2 hover:bg-primary/90"
          onClick={handleRun}
          disabled={!canRun}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              Run
            </>
          )}
        </Button>
        {isGloballyRunning && !isPending && (
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            Another backtest is running — please wait
          </p>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          <Separator className="border-border/10" />
          <div className="px-4 py-3 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Results</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                label="Total Return"
                value={`${result.totalReturnPct >= 0 ? "+" : ""}${result.totalReturnPct.toFixed(2)}%`}
                positive={result.totalReturnPct >= 0}
              />
              <StatCard
                label="Max Drawdown"
                value={`${result.maxDrawdownPct.toFixed(2)}%`}
                positive={false}
                neutral
              />
              <StatCard
                label="Trades"
                value={String(result.tradeCount)}
                positive={result.tradeCount > 0}
              />
              <StatCard
                label="Sharpe-like"
                value={result.sharpeLike.toFixed(2)}
                positive={result.sharpeLike >= 1}
              />
            </div>
            <Link
              href="/backtests"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              View full results on Backtests page (Run #{result.runId})
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  positive,
  neutral = false,
}: {
  label: string;
  value: string;
  positive: boolean;
  neutral?: boolean;
}) {
  const valueClass = neutral
    ? "text-foreground"
    : positive
    ? "text-primary"
    : "text-destructive";

  return (
    <div className="rounded-sm border border-border/10 bg-surface-low px-3 py-2">
      <p className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums mt-0.5 ${valueClass}`}>{value}</p>
    </div>
  );
}

// ─── Strategy Chatbox ─────────────────────────────────────────────────────────

interface StrategyChatboxProps {
  onStrategyAdded: (sample: StrategySample) => void;
}

function StrategyChatbox({ onStrategyAdded }: StrategyChatboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: 'Describe a trading strategy in natural language and I\'ll add it to your samples list.\n\nExample: "Create a momentum breakout strategy using Bollinger Bands and RSI for crypto on 4H timeframe"',
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isThinking]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    // Simulate brief "thinking" delay then generate
    setTimeout(() => {
      const generated = parseStrategyFromChat(trimmed);
      onStrategyAdded(generated);

      const indicatorList = generated.indicators.join(", ");
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: `Added "${generated.name}" to your strategy samples!\n\nMode: ${MODE_LABELS[generated.mode]}\nRisk: ${generated.riskLevel}\nIndicators: ${indicatorList}\nTimeframe: ${generated.timeframe}\n\nYou can now view the code and run a backtest from the card above.`,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 900);
  }, [input, isThinking, onStrategyAdded]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-20 lg:bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all"
        aria-label="Open Strategy Builder"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <MessageSquare className="h-5 w-5" />
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-3 sm:right-6 z-50 flex flex-col w-[calc(100vw-1.5rem)] max-w-[400px] h-[500px] rounded-sm border border-border/10 bg-surface-low shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/10 bg-surface-low shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Strategy Builder</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat area */}
          <ScrollArea className="flex-1 px-4 py-3">
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={[
                      "max-w-[80%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    ].join(" ")}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="shrink-0 border-t border-border/10 px-3 py-3 bg-surface-low">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a strategy..."
                className="flex-1 min-h-[60px] max-h-[120px] resize-none rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={isThinking}
              />
              <Button
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || isThinking}
                aria-label="Send"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Press Enter to send, Shift+Enter for newline
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function StrategySamplesPage() {
  const [samples, setSamples] = useState<StrategySample[]>(INITIAL_STRATEGY_SAMPLES);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  // expandedId controls the code panel; backtestOpenId controls the run backtest panel
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [backtestOpenId, setBacktestOpenId] = useState<string | null>(null);
  // Track whether any backtest is currently running (only one at a time)
  const [isAnyRunning, setIsAnyRunning] = useState(false);
  // Ref to the newly added card for scrolling
  const newCardRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return samples.filter((s) => {
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.indicators.some((i) => i.toLowerCase().includes(q));
      const matchesMode = modeFilter === "all" || s.mode === modeFilter;
      const matchesRisk = riskFilter === "all" || s.riskLevel === riskFilter;
      return matchesSearch && matchesMode && matchesRisk;
    });
  }, [samples, search, modeFilter, riskFilter]);

  function handleToggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    // Closing code panel should not affect backtest panel
  }

  function handleToggleBacktest(id: string) {
    setBacktestOpenId((prev) => (prev === id ? null : id));
  }

  async function handleCopy(sample: StrategySample) {
    try {
      await navigator.clipboard.writeText(sample.code);
      toast.success(`"${sample.name}" copied to clipboard`);
    } catch {
      toast.error("Clipboard access denied — please copy manually");
    }
  }

  function handleDownload(sample: StrategySample) {
    const blob = new Blob([sample.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sample.id}.pine`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${sample.id}.pine`);
  }

  function handleStrategyAdded(sample: StrategySample) {
    setSamples((prev) => [sample, ...prev]);
    // Clear filters so the new card is visible
    setSearch("");
    setModeFilter("all");
    setRiskFilter("all");
    // Scroll to top where the new card will appear
    setTimeout(() => {
      newCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    toast.success(`"${sample.name}" added to your strategy samples`);
  }

  const modeFilterOptions: { value: ModeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "conservative", label: "Conservative" },
    { value: "aggressive", label: "Aggressive" },
    { value: "ai-pick", label: "AI Pick" },
    { value: "buy-low-sell-high", label: "Buy Low Sell High" },
  ];

  const riskFilterOptions: { value: RiskFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "Low", label: "Low" },
    { value: "Medium", label: "Medium" },
    { value: "High", label: "High" },
  ];

  return (
    <AppShell title="Strategy Samples">
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-4 w-4 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Strategy Samples</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Ready-to-use Pine Script v5 strategies. Copy and paste directly into
          TradingView — or run a backtest directly from each card.
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search strategies or indicators..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-surface-low border-border/20"
          />
        </div>

        {/* Mode filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Mode:
          </span>
          {modeFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setModeFilter(opt.value)}
              className={[
                "px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors",
                modeFilter === opt.value
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-surface-high/50",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Risk filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
            Risk:
          </span>
          {riskFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRiskFilter(opt.value)}
              className={[
                "px-2.5 py-1 rounded-sm text-xs font-medium border transition-colors",
                riskFilter === opt.value
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "border-border/20 text-muted-foreground hover:text-foreground hover:border-border/40 hover:bg-surface-high/50",
              ].join(" ")}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Separator className="mb-6 border-border/10" />

      {/* ── Results count ── */}
      <p className="text-2xs text-muted-foreground mb-4 tabular-nums">
        {filtered.length} of {samples.length} strategies
      </p>

      {/* ── Strategy grid ── */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="h-8 w-8 mx-auto text-primary/20 mb-3" />
          <p className="text-sm text-muted-foreground">No strategies match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sample, idx) => {
            const ModeIcon = MODE_ICONS[sample.mode];
            const isExpanded = expandedId === sample.id;
            const isBacktestOpen = backtestOpenId === sample.id;
            const isFirstItem = idx === 0;

            return (
              <div
                key={sample.id}
                className="flex flex-col"
                ref={isFirstItem && sample.id.startsWith("chat-") ? newCardRef : undefined}
              >
                <div className="flex flex-col h-full bg-surface-low border border-border/10 rounded-sm">
                  <div className="p-4 pb-3">
                    {/* Mode + Risk badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={[
                          "text-3xs font-bold px-2 py-0.5 rounded-sm flex items-center gap-1",
                          MODE_BADGE_CLASSES[sample.mode],
                        ].join(" ")}
                      >
                        <ModeIcon className="h-2.5 w-2.5" />
                        {MODE_LABELS[sample.mode]}
                      </span>
                      <span
                        className={[
                          "text-3xs font-bold px-2 py-0.5 rounded-sm",
                          RISK_BADGE_CLASSES[sample.riskLevel],
                        ].join(" ")}
                      >
                        {sample.riskLevel} Risk
                      </span>
                    </div>

                    <h3 className="text-sm font-bold leading-snug text-foreground mb-1">
                      {sample.name}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {sample.description}
                    </p>
                  </div>

                  <div className="flex-1 px-4 pb-4 space-y-3">
                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-muted-foreground">Best for: </span>
                        <span className="text-foreground">{sample.bestFor}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Timeframe: </span>
                        <span className="text-foreground">{sample.timeframe}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Score: </span>
                        <span
                          className={[
                            "font-semibold",
                            SCORE_COLOR(sample.score),
                          ].join(" ")}
                        >
                          {sample.score}/10
                        </span>
                        {/* Score bar */}
                        <div className="flex gap-px ml-1">
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div
                              key={i}
                              className={[
                                "h-1.5 w-1.5 rounded-sm",
                                i < sample.score
                                  ? sample.score >= 9
                                    ? "bg-green-400"
                                    : sample.score >= 7
                                    ? "bg-yellow-400"
                                    : "bg-red-400"
                                  : "bg-muted",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Indicator tags */}
                    <div className="flex flex-wrap gap-1">
                      {sample.indicators.map((ind) => (
                        <span
                          key={ind}
                          className="bg-surface-highest text-muted-foreground text-3xs px-1.5 py-0.5 rounded-sm"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>

                    {/* Action buttons row */}
                    <div className="flex gap-2">
                      {/* View Code toggle */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-7 border-border/20 hover:bg-surface-high/50"
                        onClick={() => handleToggleExpand(sample.id)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3" />
                            Hide Code
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            View Code
                          </>
                        )}
                      </Button>

                      {/* Run Backtest toggle */}
                      <Button
                        variant={isBacktestOpen ? "secondary" : "outline"}
                        size="sm"
                        className="flex-1 gap-1.5 text-xs h-7 border-border/20 hover:bg-surface-high/50"
                        onClick={() => handleToggleBacktest(sample.id)}
                        disabled={isAnyRunning && backtestOpenId !== sample.id}
                      >
                        <Play className="h-3 w-3" />
                        {isBacktestOpen ? "Hide Run" : "Run Backtest"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Run Backtest panel ── */}
                {isBacktestOpen && (
                  <BacktestPanel
                    sample={sample}
                    isGloballyRunning={isAnyRunning && backtestOpenId !== sample.id}
                    onRunStart={() => setIsAnyRunning(true)}
                    onRunEnd={() => setIsAnyRunning(false)}
                  />
                )}

                {/* ── Expanded code panel ── */}
                {isExpanded && (
                  <div className="mt-2 rounded-sm border border-border/10 bg-surface-lowest">
                    {/* Code panel header */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-border/10">
                      <span className="text-xs font-mono text-muted-foreground/60">
                        {sample.id}.pine
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-surface-high hover:bg-surface-highest"
                          onClick={() => handleCopy(sample)}
                        >
                          <Clipboard className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-surface-high hover:bg-surface-highest"
                          onClick={() => handleDownload(sample)}
                        >
                          <Download className="h-3 w-3" />
                          .pine
                        </Button>
                      </div>
                    </div>

                    {/* Code viewer */}
                    <ScrollArea className="max-h-[480px]">
                      <pre className="bg-surface-lowest p-4 text-xs font-mono leading-relaxed whitespace-pre overflow-x-auto text-foreground/80">
                        {sample.code}
                      </pre>
                    </ScrollArea>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Strategy Chatbox ── */}
      <StrategyChatbox onStrategyAdded={handleStrategyAdded} />
    </AppShell>
  );
}
