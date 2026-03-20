"""
Pine Script v5 generator for winning strategy variants.

Generates valid Pine Script v5 code from optimizer variant parameters.
Includes inline comments for any Python-to-Pine approximation differences.
"""
from __future__ import annotations

from app.optimizers.base import VariantResult


def generate_pine_script(variant: VariantResult, symbol: str) -> str:
    """
    Generate a complete Pine Script v5 strategy from a VariantResult.
    Dispatches to the correct generator based on family_name.
    """
    if variant.family_name == "ai_pick":
        return _generate_ai_pick_pine(variant, symbol)
    elif variant.family_name == "buy_low_sell_high":
        return _generate_blsh_pine(variant, symbol)
    else:
        raise ValueError(f"Unsupported variant family for Pine Script generation: {variant.family_name!r}")


def _generate_ai_pick_pine(variant: VariantResult, symbol: str) -> str:
    p = variant.parameters
    macd_fast = p.get("macd_fast", 12)
    macd_slow = p.get("macd_slow", 26)
    rsi_window = p.get("rsi_window", 14)
    ema_short = p.get("ema_short", 20)
    ema_long = p.get("ema_long", 50)
    rsi_oversold = p.get("rsi_oversold", 30)
    val_score = variant.backtest.validation_score
    val_return = variant.backtest.validation_return
    max_dd = variant.backtest.max_drawdown

    return f"""\
// ============================================================
// NextGenStock — AI Pick Strategy (Pine Script v5)
// Variant: {variant.variant_name}
// Symbol optimized for: {symbol}
// Validation score: {val_score:.4f}
// Validation return: {val_return:.2f}%
// Max drawdown: {max_dd:.2f}%
//
// NOTE: This Pine Script approximates the Python backtesting logic.
// Differences from Python implementation:
//   - Python uses a live OHLCV DataFrame; Pine recalculates on each new bar
//   - RSI/MACD/EMA calculations are equivalent but Pine uses built-ins
//   - No HMM regime detection in Pine (HMM is Python-only); regime is
//     approximated by EMA alignment (short > long = bull)
//   - Cooldown is approximated by barssince() checks
// ============================================================
//@version=5
strategy(
    title = "NextGenStock AI Pick — {variant.variant_name}",
    overlay = true,
    default_qty_type = strategy.percent_of_equity,
    default_qty_value = 100,
    commission_type = strategy.commission.percent,
    commission_value = 0.1
)

// ── Inputs ──────────────────────────────────────────────────
macd_fast   = input.int({macd_fast},  title="MACD Fast Length",   minval=2)
macd_slow   = input.int({macd_slow},  title="MACD Slow Length",   minval=5)
macd_signal = input.int(9,           title="MACD Signal Length",  minval=1)
rsi_length  = input.int({rsi_window}, title="RSI Length",         minval=2)
ema_short   = input.int({ema_short},  title="EMA Short",          minval=5)
ema_long    = input.int({ema_long},   title="EMA Long",           minval=20)
rsi_buy_max = input.int({rsi_oversold + 20},
                         title="RSI Max for Buy (not overbought)", minval=40, maxval=90)
cooldown_bars = input.int(3, title="Cooldown bars after exit", minval=0)

// ── Indicators ───────────────────────────────────────────────
[macdLine, signalLine, _] = ta.macd(close, macd_fast, macd_slow, macd_signal)
rsiValue = ta.rsi(close, rsi_length)
emaShortVal = ta.ema(close, ema_short)
emaLongVal  = ta.ema(close, ema_long)

// Plot EMAs
plot(emaShortVal, color=color.new(color.green, 0),  title="EMA Short", linewidth=1)
plot(emaLongVal,  color=color.new(color.orange, 0), title="EMA Long",  linewidth=1)

// ── Signal Logic ─────────────────────────────────────────────
// NOTE: Approximates Python's indicator gate without HMM regime
bullTrend = emaShortVal > emaLongVal
macdBull  = macdLine > signalLine
rsiNotOverbought = rsiValue < rsi_buy_max

buySignal  = bullTrend and macdBull and rsiNotOverbought
sellSignal = not bullTrend or not macdBull or rsiValue > 70

// Cooldown logic (approximate Python cooldown_bars)
barsInTrade = strategy.position_size != 0 ? 0 : ta.barssince(strategy.position_size[1] != 0)
cooldownOk  = na(barsInTrade) or barsInTrade >= cooldown_bars

// ── Strategy Entries / Exits ─────────────────────────────────
if buySignal and cooldownOk
    strategy.entry("Long", strategy.long)

if sellSignal and strategy.position_size > 0
    strategy.close("Long", comment="Exit Signal")

// ── Signals on chart ─────────────────────────────────────────
plotshape(buySignal  and cooldownOk and strategy.position_size == 0,
          style=shape.arrowup,   color=color.new(color.green, 0),
          location=location.belowbar, title="Buy",  size=size.small)
plotshape(sellSignal and strategy.position_size > 0,
          style=shape.arrowdown, color=color.new(color.red, 0),
          location=location.abovebar, title="Sell", size=size.small)
"""


def _generate_blsh_pine(variant: VariantResult, symbol: str) -> str:
    p = variant.parameters
    rsi_oversold = p.get("rsi_oversold", 30)
    bb_window = p.get("bb_window", 20)
    cycle_hold_bars = p.get("cycle_hold_bars", 5)
    val_score = variant.backtest.validation_score
    val_return = variant.backtest.validation_return
    max_dd = variant.backtest.max_drawdown

    return f"""\
// ============================================================
// NextGenStock — Buy Low / Sell High Strategy (Pine Script v5)
// Variant: {variant.variant_name}
// Symbol optimized for: {symbol}
// Validation score: {val_score:.4f}
// Validation return: {val_return:.2f}%
// Max drawdown: {max_dd:.2f}%
//
// NOTE: This Pine Script approximates the Python backtesting logic.
// Differences from Python implementation:
//   - Python tracks 'hold_remaining' bars with a counter; Pine uses
//     barssince() to approximate the minimum holding period
//   - Bollinger Band calculations are identical (SMA + 2*std)
//   - No per-bar cooldown state machine — Pine uses barssince() instead
// ============================================================
//@version=5
strategy(
    title = "NextGenStock Buy Low Sell High — {variant.variant_name}",
    overlay = true,
    default_qty_type = strategy.percent_of_equity,
    default_qty_value = 100,
    commission_type = strategy.commission.percent,
    commission_value = 0.1
)

// ── Inputs ──────────────────────────────────────────────────
rsiLength     = input.int(14,           title="RSI Length",         minval=2)
rsiOversold   = input.int({rsi_oversold}, title="RSI Oversold Level", minval=10, maxval=50)
rsiOverbought = input.int(65,           title="RSI Overbought Level",minval=55, maxval=90)
bbWindow      = input.int({bb_window},  title="Bollinger Window",   minval=5)
bbStdMult     = input.float(2.0,        title="BB Std Multiplier",  minval=0.5, step=0.1)
minHoldBars   = input.int({cycle_hold_bars}, title="Min Hold Bars (cycle)", minval=1)

// ── Indicators ───────────────────────────────────────────────
rsiValue    = ta.rsi(close, rsiLength)
bbBasis     = ta.sma(close, bbWindow)
bbDev       = bbStdMult * ta.stdev(close, bbWindow)
bbUpper     = bbBasis + bbDev
bbLower     = bbBasis - bbDev

// Plot Bollinger Bands
plot(bbBasis, color=color.new(color.gray,  40), title="BB Mid")
plot(bbUpper, color=color.new(color.blue,  30), title="BB Upper")
plot(bbLower, color=color.new(color.blue,  30), title="BB Lower")

// ── Signal Logic ─────────────────────────────────────────────
// NOTE: Python 'hold_remaining' counter → Pine barssince() approximation
barsHeld    = strategy.position_size > 0 ? ta.barssince(strategy.position_size[1] == 0) : 0
holdOk      = na(barsHeld) or barsHeld >= minHoldBars

dipEntry    = rsiValue < rsiOversold and close < bbLower
cycleExit   = rsiValue > rsiOverbought or close > bbUpper

// ── Strategy Entries / Exits ─────────────────────────────────
if dipEntry and strategy.position_size == 0
    strategy.entry("Long", strategy.long, comment="Dip Entry")

if cycleExit and strategy.position_size > 0 and holdOk
    strategy.close("Long", comment="Cycle Top Exit")

// ── Signals on chart ─────────────────────────────────────────
plotshape(dipEntry  and strategy.position_size == 0,
          style=shape.arrowup,   color=color.new(color.green, 0),
          location=location.belowbar, title="Buy (Dip)",  size=size.small)
plotshape(cycleExit and strategy.position_size > 0 and holdOk,
          style=shape.arrowdown, color=color.new(color.red, 0),
          location=location.abovebar, title="Sell (Top)", size=size.small)

// ── Background shading ───────────────────────────────────────
bgcolor(close < bbLower and rsiValue < rsiOversold
        ? color.new(color.green, 90) : na, title="Dip Zone")
bgcolor(close > bbUpper and rsiValue > rsiOverbought
        ? color.new(color.red, 90) : na, title="Top Zone")
"""
