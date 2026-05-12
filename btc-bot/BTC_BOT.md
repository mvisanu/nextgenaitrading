# BTC Trailing Stop Bot

Standalone script: [`btc_trailing_bot.py`](./btc_trailing_bot.py) (repo root).
Executes BTC/USD against Alpaca paper trading via `alpaca-py`.

This file is the authoritative spec — the script, this doc, `CLAUDE.md`, and `README.md` are aligned on the 3-level ladder.

---

## Rules

### 1. FLOOR — hard stop-loss
Sell **all** holdings if price drops **10% below the blended entry price**.

- Initial floor = `entry_price * 0.90`
- After each ladder buy, floor is recomputed against the new blended entry, but **only moves up — never down**.

### 2. TRAILING FLOOR
Activates after **+10% gain** from blended entry.

- On activation: `floor = current_price * 0.95`
- Advances every additional **+5%** move from the last trailing high.
- Never moves down. Replaces (but does not destroy) the original FLOOR.

### 3. LADDER IN — 3-level DCA re-entry

Each level fires **once per session** when price reaches the trigger.
Floor never moves down after a fill.

Default initial buy: **$10,000** (`BTC_USD=10000`). Ladder amounts assume this default; if you override `BTC_USD`, the ladder still uses the fixed dollar values below — they are **not** auto-scaled.

| Level | Trigger (from original entry) | Buy     | Notes                          |
|-------|------------------------------|---------|--------------------------------|
| L1    | entry × 0.80 (−20%)          | $10,000 | Normal correction              |
| L2    | entry × 0.70 (−30%)          | $15,000 | Standard pullback              |
| L3    | entry × 0.60 (−40%)          | $20,000 | Deep pullback, max conviction  |

**Max capital deployed:** $10k initial + $10k + $15k + $20k = **$55,000**.

Triggers are computed against the **original entry**, not the blended entry — this prevents the ladder from chasing itself lower after a partial fill.

After each ladder fill:
1. `blended_entry = weighted_avg(prior_position, new_buy)`
2. `new_floor = blended_entry * 0.90`
3. `current_floor = max(current_floor, new_floor)` (up-only)

---

## State machine

```
            buy(BTC_USD)
                │
                ▼
         ┌────────────┐  price ≤ floor   ┌──────┐
         │  HOLDING   │ ───────────────▶ │ EXIT │
         └────────────┘                  └──────┘
            │     ▲
   +10%     │     │  ladder Lx fills
   gain     │     │  (floor recomputed, up-only)
            ▼     │
         ┌────────────┐  price ≤ floor   ┌──────┐
         │ TRAILING   │ ───────────────▶ │ EXIT │
         └────────────┘                  └──────┘
            │     ▲
            └─────┘  every +5% from trailing high → floor steps up
```

A single position lifecycle ends on EXIT (FLOOR hit). The script does not auto-restart — re-run manually or rely on the remote scheduled agent (see below).

---

## Usage

```bash
cd backend && source .venv/Scripts/activate
python ../btc_trailing_bot.py
```

### Environment variables

| Var                       | Required | Default                          | Purpose                                |
|---------------------------|----------|----------------------------------|----------------------------------------|
| `ALPACA_API_KEY`          | yes      | —                                | Alpaca API key (paper)                 |
| `ALPACA_SECRET_KEY`       | yes      | —                                | Alpaca secret                          |
| `VISANU_ALPACA_API_KEY`   | no       | —                                | Personal-account override; takes precedence over `ALPACA_API_KEY` |
| `VISANU_ALPACA_SECRET_KEY`| no       | —                                | Personal-account secret override       |
| `BTC_USD`                 | no       | `10000`                          | Dollar amount of the initial buy       |
| `POLL_INTERVAL_SEC`       | no       | `30`                             | Polling interval                       |

Paper trading endpoint is hard-coded: `https://paper-api.alpaca.markets`.

### Closing out

Run `python btc_close_now.py` from the repo root to market-sell any open BTC/USD paper position. Uses the same `VISANU_ALPACA_*` env vars. Safe to run when no position is open (it exits cleanly).

