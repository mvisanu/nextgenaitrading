# LEDGER

## Trade Session — 2026-04-01

### Environment
- Mode: PAPER (dry_run=true)
- Broker credential ID: 604 (Alpaca, paper_trading=true, paper-api.alpaca.markets)
- Backend user: paper-trader@nextgenstock.io (user_id: 1106)
- All orders status: `simulated` — no real money at risk

---

### Order Log

| # | DB Order ID | Symbol | Type | Side | Qty | Entry Price | Total Est. | Status | Reason |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 87 | LRCX | Stock (Equity) | BUY | 4 shares | $224.69 | ~$898.76 | SIMULATED | Golden Cross (EMA50>EMA200), daily RSI 50.9 (healthy pullback zone), weekly trend Very Strong bullish, price well above all EMAs |
| 2 | 88 | BTC-USD | Crypto | BUY | 0.01453 BTC | $68,844 | $1,000.00 | SIMULATED | Weekly price above 200 EMA, RSI recovering from oversold (31→35, rising), confirmed uptrend resumption |
| 3 | 89 | LRCX | Gold ETF (Equity) | BUY | 2 shares | $439.94 | ~$879.88 | SIMULATED | Gold in strong macro uptrend (+6.1% today), GLD is the supported gold proxy (direct futures not available via Alpaca equity account), price near 52-week high confirming momentum |
| 4 | N/A | LRCX CALL | Option | SKIP | — | — | — | SKIPPED | System risk gate blocked: IV rank = 0.0 on all scanner symbols (no IV history populated in local DB). Conservative rule: never force an option trade when signal is blocked |

---

### Dry Run Results

#### Stock — LRCX (Lam Research Corp, NASDAQ)
- **Selected:** LRCX over INTC because INTC 1H RSI was 76.76 (overbought short-term) and 15M RSI 79.95, indicating near-term exhaustion. LRCX had RSI 50.9 daily (clean pullback zone) with stronger weekly structure.
- **Signal values:**
  - Weekly RSI: 61.3 (bullish, rising)
  - Daily RSI: 50.9 (neutral/pullback zone — ideal entry)
  - EMA20: $221.16, EMA50: $218.08, EMA200: $169.85 — all rising, Golden Cross confirmed
  - Weekly trend strength: Very Strong
  - MACD daily: Bearish crossover (normal consolidation after breakout — not a reversal signal given weekly structure)
- **Conservative check:** PASS — price above all EMAs, RSI not overbought, large-cap ($279B market cap), high liquidity (4.3M avg daily volume)
- **Order payload:** `{ symbol: LRCX, side: buy, quantity: 4, dry_run: true, credential_id: 604 }`
- **Estimated spend:** 4 × $224.69 = **$898.76**

#### Bitcoin — BTC-USD
- **Selected:** BTC-USD (only supported crypto instrument for this trade slot)
- **Signal values:**
  - Price: $68,844 (+0.9% today)
  - Weekly: price ($68,770) above 200 EMA ($68,052) — barely above, bullish edge
  - Weekly RSI: 35.45, rising from 31.85 — recovering from oversold, trend resumption signal
  - 52-week range: $60,074 – $126,198 (currently near the lower third — reasonable value entry)
- **Conservative check:** PASS — fractional notional order ($1,000), long-only, RSI recovering not overbought, price supported at 200 EMA
- **Order payload:** `{ symbol: BTC-USD, side: buy, notional_usd: 1000, dry_run: true, credential_id: 604 }`
- **Estimated spend:** $1,000 notional → **0.01453 BTC**

#### Gold — GLD (SPDR Gold Shares ETF)
- **Selected:** GLD ETF — gold direct futures (GC=F) not tradeable via Alpaca equity account; GLD is the configured gold proxy in the project (symbol map in market_data.py)
- **Signal values:**
  - GLD price: $439.94 (+6.12% today)
  - GC=F (gold futures): $4,818 (+3.67%) — confirms macro gold strength
  - 52-week range: $272.58 – $509.70 — strong uptrend year-over-year
- **Conservative check:** PASS — strong macro tailwind, liquid ETF (NYSE: GLD), no leverage, long-only
- **Order payload:** `{ symbol: GLD, side: buy, quantity: 2, dry_run: true, credential_id: 604 }`
- **Estimated spend:** 2 × $439.94 = **$879.88**

#### Options — LRCX CALL
- **Selected:** LRCX was the best stock candidate; CALL was the intended strategy (bullish trend)
- **System check result:** ALL 10 scanner symbols blocked — `IV rank 0.0 below minimum 30.0`
- **Root cause:** `iv_history` table has no data in this local DB instance; IV rank/percentile calculation returns 0.0; system's own risk gate correctly blocks the trade
- **Decision:** SKIPPED — conservative rule requires passing all system gates; no naked or forced options
- **No order submitted**

---

### Summary

| Asset | Symbol | Submitted | DB Order ID | Est. Spend |
|---|---|---|---|---|
| Stock | LRCX | YES (paper) | 87 | ~$898.76 |
| Bitcoin | BTC-USD | YES (paper) | 88 | ~$1,000.00 |
| Gold | GLD | YES (paper) | 89 | ~$879.88 |
| Option | LRCX CALL | SKIPPED | — | — |

**Total paper capital deployed: ~$2,778.64**

### Warnings and Assumptions
1. All orders are `dry_run=true` — `broker_order_id: "dry-run"`, `status: "simulated"`. No real Alpaca paper account connection was made (placeholder API keys used for credential creation). Orders are recorded in the local PostgreSQL DB only.
2. Entry prices are estimates based on Yahoo Finance quotes at time of screening (2026-04-01 ~17:14 UTC). Actual fill prices would vary at market open.
3. GLD is used as the gold proxy per project configuration (direct commodity futures not supported via Alpaca equity account).
4. Options trade skipped because the system's IV rank risk gate blocked all signals — this is the correct conservative behavior per the testbuy.md rules ("Never force a trade that does not pass validation").
5. INTC was evaluated and rejected (1H RSI 76.76, 15M RSI 79.95 — short-term overbought) in favor of LRCX with cleaner technical structure.
