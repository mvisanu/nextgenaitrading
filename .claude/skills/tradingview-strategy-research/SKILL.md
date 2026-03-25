---
name: tradingview-strategy-research
description: Use this skill whenever the user wants to find, research, compare, convert, backtest, or port TradingView trading strategies. Triggers include any mention of TradingView strategies, Pine Script, swing trading setups, breakout/pullback/momentum/mean-reversion/hybrid strategies, strategy conversion to Python or other platforms, backtesting a TradingView idea, oscillator or indicator-based entry/exit logic, NNFX frameworks, composite multi-indicator systems, divergence detection, or requests like "find me the best strategies right now", "convert this TradingView strategy", "write Pine Script for this system", or "build a backtestable strategy script". Always use this skill even if the user only partially describes a strategy or says something like "I saw this on TradingView" — treat that as a full trigger.
---

# TradingView Strategy Research and Conversion Skill

## MCP usage rules

1. Always check what MCP tools are available before starting.
2. When the user asks for trading strategies, look for strategies from TradingView first.
3. Use these two TradingView MCP servers whenever they are available and relevant:
   - `fiale-plus/tradingview-mcp-server` — market screening, discovery, presets, candidate strategy research
   - `atilaahmettaner/tradingview-mcp` — technical-analysis scanning, indicator confirmation, multi-timeframe validation
4. If the user has their own custom MCP server that overlaps with the above, prioritize the user's MCP first.
5. Never invent MCP tool names. Inspect available tools first, then use only what exists.
6. If an MCP lacks the needed data, say so clearly and continue with the best available source.

---

## Core principles

- TradingView strategy logic is the source of truth.
- Preserve original strategy behavior as closely as possible.
- Do not invent features not in the original unless clearly labeled as optional improvements.
- If strategy logic is incomplete or ambiguous, explain what is missing and state conservative explicit assumptions.
- Never present anything as guaranteed profit.
- Keep reasoning concise, concrete, and testable.
- This skill covers research and coding support only — not trade execution or financial advice.

---

## Workflow

### Step 1 — Inspect tools
Before doing anything else, determine what tools are available from:
- the user's MCP server (if any)
- `fiale-plus/tradingview-mcp-server`
- `atilaahmettaner/tradingview-mcp`

Map each available tool to one of these roles:
- strategy discovery
- market screening
- indicator calculation
- multi-timeframe analysis
- market movers / momentum
- pattern detection
- code conversion support

### Step 2 — Discover TradingView strategy logic first
When the user asks for a strategy or provides a description:
- Search TradingView-related MCP sources first
- Identify the closest matching public or described strategy logic
- Capture the original logic faithfully
- Note if the strategy is partially described rather than fully specified

### Step 3 — Summarize before coding
Before writing any code, always produce a structured summary (see Required Output Format below). Do not skip this step.

### Step 4 — Build or convert the code
- Write Pine Script first by default unless the user specifies another language
- Preserve original behavior
- Label any optional improvements separately
- Do not silently add filters, pyramiding rules, trailing stops, or alerts unless they are already present in the source logic or explicitly requested

### Step 5 — Validate logic quality
Check the completed code for:
- Contradictory entry/exit conditions
- Repainting risk (using `security()` or future bars)
- Pivot lookback ambiguity
- Missing or broken risk management
- Bar-gap or minimum signal-spacing logic
- Multi-timeframe dependency issues

### Step 6 — Return the final deliverable
Use the Required Output Format exactly.

---

## Required output format

Always return in this order:

### 1. Strategy summary
- Strategy name
- Core logic
- Entry conditions
- Exit conditions
- Risk management rules
- Indicators and parameters used

### 2. Assumptions and clarifications
- Missing pieces in the source logic
- Conservative assumptions made
- Anything approximated because the original strategy was incomplete

### 3. Full code
- Pine Script first unless the user specifies otherwise
- Clean, working, organized, and commented
- Ready for backtesting in TradingView

### 4. Testing and modification notes
- Suggested symbol and timeframe
- Inputs worth tuning
- How to validate the logic
- Safe optional improvements (labeled clearly)

---

## Strategy research mode

When the user asks for "best strategies" rather than code:
- Use the user's MCP first, then TradingView MCP sources
- Rank strategies by current market fit
- Explain when each strategy is suitable and when it fails
- Prefer robust, repeatable setups over hype

For each strategy, return:

| Field | Content |
|---|---|
| Strategy name | Name or label |
| Best market condition | Trending, ranging, volatile, etc. |
| Why it works now | Current market context fit |
| Failure conditions | When it breaks down |
| Ideal timeframe | 1D, 4H, 1H, etc. |
| Score | 1–10 |
| Confidence | High / Medium / Low |

---

## Default research assumptions

Unless the user specifies otherwise:
- Market: US stocks
- Style: swing trading
- Timeframes: 1D, 4H, 1H
- Favor liquid instruments, exclude penny stocks
- Return top 5 setups and top 3 strategy types

---

## Composite and hybrid strategy handling

When the user combines multiple indicators into one system:
- Identify the role of each indicator (trend, confirmation, timing, volatility, exit)
- Map each one to a layer in the framework
- Ensure no entry fires unless all required layers agree
- Preserve gating logic exactly as described
- If one layer is underspecified, state the missing logic before writing code

### Composite build template

When given a hybrid system, structure the summary as:

```
Strategy name:
Trend filter:
Confirmation layer 1:
Confirmation layer 2:
Volatility gate:
Entry trigger:
Exit trigger:
Risk logic:
Known ambiguities:
```

Then build the Pine Script in this modular order:
1. `// === INPUTS ===`
2. `// === INDICATOR CALCULATIONS ===`
3. `// === TREND LOGIC ===`
4. `// === CONFIRMATION LOGIC ===`
5. `// === VOLATILITY GATE ===`
6. `// === ENTRY CONDITIONS ===`
7. `// === EXIT CONDITIONS ===`
8. `// === PLOTS AND LABELS ===`
9. `// === STRATEGY ORDERS ===`

---

## Pine Script coding rules

1. Use Pine Script v5 (`//@version=5`) unless the user requests v4.
2. Use `strategy()` declaration for backtestable scripts, `indicator()` for signal-only scripts.
3. Every input must have a clear label and a safe default value.
4. Add a comment above each logical block explaining what it does.
5. Use `barstate.isconfirmed` or close-of-bar logic to avoid repainting unless the strategy explicitly requires intra-bar signals.
6. Minimum bar spacing between signals must be enforced with a `var int lastSignalBar = na` pattern when specified.
7. When translating indicator logic from a description, preserve default thresholds, smoothing periods, signal spacing, and trigger logic exactly.
8. If a parameter is unknown, expose it as a labeled input with a safe default and add a comment: `// ASSUMPTION: default chosen conservatively — tune as needed`.

---

## Platform conversion rules

When the user asks to convert Pine Script to Python (or another platform):
- Complete the Pine Script version first
- Then translate it faithfully — same logic, same parameters
- Use `pandas`, `pandas_ta`, and `numpy` for Python conversions by default
- Map each Pine Script function to its closest Python equivalent
- Note any behavioral differences (e.g. Pine's `ta.ema()` vs `pandas_ta.ema()` initialization)
- Label any approximations

---

## Example: composite Pine Script scaffold

This is the structural template to follow for hybrid multi-indicator systems:

```pinescript
//@version=5
strategy("Hybrid Strategy Name", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// === INPUTS ===
atr_len         = input.int(14, "ATR Length")
adx_threshold   = input.int(20, "ADX Threshold")
signal_spacing  = input.int(3,  "Min Bars Between Signals")

// === INDICATOR CALCULATIONS ===
[di_plus, di_minus, adx_val] = ta.dmi(14, 14)
atr_val = ta.atr(atr_len)

// === TREND LOGIC ===
trend_bull = // define here
trend_bear = // define here

// === CONFIRMATION LOGIC ===
confirm_bull = // define here
confirm_bear = // define here

// === VOLATILITY GATE ===
volatility_ok = adx_val >= adx_threshold

// === SIGNAL SPACING ===
var int last_entry_bar = na
spacing_ok = na(last_entry_bar) or (bar_index - last_entry_bar >= signal_spacing)

// === ENTRY CONDITIONS ===
long_entry  = trend_bull and confirm_bull and volatility_ok and spacing_ok
short_entry = trend_bear and confirm_bear and volatility_ok and spacing_ok

// === EXIT CONDITIONS ===
long_exit  = // define here
short_exit = // define here

// === STRATEGY ORDERS ===
if long_entry
    strategy.entry("Long", strategy.long)
    last_entry_bar := bar_index

if short_entry
    strategy.entry("Short", strategy.short)
    last_entry_bar := bar_index

if long_exit
    strategy.close("Long")

if short_exit
    strategy.close("Short")

// === PLOTS ===
plotshape(long_entry,  "Buy",  shape.triangleup,   location.belowbar, color.green, size=size.small)
plotshape(short_entry, "Sell", shape.triangledown,  location.abovebar, color.red,   size=size.small)
```

---

## Example invocation prompts

- "Find the best swing strategies in US stocks right now"
- "Rank the best crypto momentum setups today"
- "Convert this TradingView strategy into Pine Script"
- "Build a backtestable hybrid strategy for ETH using CJDX + God Hunter + CCI trend"
- "Port this Pine Script strategy to Python"
- "I saw a stochastic momentum strategy on TradingView, help me recreate it"