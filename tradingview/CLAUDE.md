# CLAUDE.md — TradingView

This file provides guidance to Claude Code when working in the `tradingview/` directory.

## Files

- `btc_elite_strategies.pine` — Pine Script v5 indicator combining 5 traders' strategies (full version)
- `btc_elite_simple.pine` — simplified version: BB Squeeze + Fair Value Gaps + clean BUY/SELL signals only
- `rules.json` — full strategy rules, indicator settings, and entry/exit logic for each trader

## Launch TradingView Desktop from terminal

```bash
powershell -Command "Start-Process 'shell:appsFolder\TradingView.Desktop_n534cwy3pjxzj!TradingView.Desktop'"
```

## Push Pine Script to TradingView (automated paste)

```bash
powershell -Command "
  Get-Content 'tradingview/btc_elite_strategies.pine' -Raw | Set-Clipboard
  \$wsh = New-Object -ComObject WScript.Shell
  \$wsh.AppActivate('BTCUSD') | Out-Null
  Start-Sleep -Milliseconds 800
  \$wsh.SendKeys('^a'); Start-Sleep -Milliseconds 400
  \$wsh.SendKeys('^v'); Start-Sleep -Milliseconds 600
  \$wsh.SendKeys('^{ENTER}')
"
```

## Indicator contents (apply to BTCUSDT, 1H or 4H)

| Layer | Source | What it shows |
|---|---|---|
| EMA 9/21/50/200 | van de Poppe + Melker + Crypto Face | Trend stack |
| VWAP | Crypto Face | Session directional anchor |
| Golden Pocket zone (0.618–0.65) | van de Poppe | Primary buy zone on pullbacks |
| Fib 0.786 / 0.5 / 0.382 | van de Poppe / Credible Crypto | Invalidation + wave levels |
| TD Sequential counts 1–9 | Tone Vays | Reversal exhaustion signal |
| RSI divergence labels | Melker + Tone Vays + Credible Crypto | Momentum divergence |
| EMA 50/200 Golden/Death Cross | Melker | Major trend change |
| EMA 9/21 ribbon cross | Crypto Face | Intraday momentum shift |
| Confluence star | All traders | 3-signal alignment (VWAP + EMA bull + Golden Pocket) |
| Top-right table | — | Live status of all signals |

## Pine Script coding rules

These rules are derived from repeated debugging — follow them exactly to avoid compile errors.

- **No duplicate `title=` args:** Never pass `title=` as both a positional arg and a named arg to `plotshape()` — Pine rejects duplicates.
- **`var table` on one line:** `var table t = table.new(...)` must be on a single line — multi-line `var` declarations fail.
- **`ta.valuewhen()` at global scope:** All `ta.valuewhen()` calls must be at global scope — never inside `if` blocks.
- **Hide plots via `color=na`:** Use `color=na` to hide a plot line — do not use `show_fib ? series : na` in the plot source; always pass the series and control via `color=`.
- **Persistent variables:** `var float x = na` + `:=` inside `if` blocks is correct — never use bare `=` inside an `if` for a persistent variable.
- **Session VWAP syntax:** `ta.vwap` (no parentheses) is the correct Pine v5 syntax for session VWAP.
- **No `simple bool AND series bool` in `plotshape()`:** Pine v5 rejects it. Move the `simple bool` toggle to `color=show_x ? ... : na` instead.
- **Single-line `box.new()` inside `if` blocks:** Multi-line function calls inside `if` blocks cause "continuation line" errors — collapse all arguments to a single line.
- **`shape.star` does not exist:** Use `shape.diamond` or another valid Pine v5 shape constant.
- **Always use `//@version=5`:** Do not use Pine Script v4 syntax.