# BTC Trailing Stop Bot

Four standalone scripts in `btc-bot/`, all trading BTC/USD against Alpaca paper:

| Script | Purpose |
|---|---|
| [`btc_trailing_bot.py`](./btc_trailing_bot.py) | Long-running monitor: initial buy, FLOOR, TRAILING FLOOR, LADDER IN |
| [`btc_execute_now.py`](./btc_execute_now.py)   | One-shot: place initial buy + stop-loss, print full strategy summary, exit |
| [`btc_close_now.py`](./btc_close_now.py)       | One-shot: cancel open BTC orders, market-sell entire position, report PnL |
| [`btc_status.py`](./btc_status.py)             | Read-only: account balances, current BTC position, last 20 BTC orders |

All four auto-load credentials from `../backend/.env` via `load_dotenv(Path(__file__).parent.parent / "backend" / ".env")` — you can run them from any working directory without pre-setting env vars.

This file is the authoritative spec — the scripts, this doc, `CLAUDE.md`, and `README.md` are aligned on the 3-level ladder.

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

A single position lifecycle ends on EXIT (FLOOR hit). The script does not auto-restart — re-run `python btc-bot/btc_trailing_bot.py` manually to start a new cycle.

---

## Usage

Activate the backend venv once, then run any of the four scripts from any directory:

```powershell
# Windows PowerShell — from repo root
.\backend\.venv\Scripts\Activate.ps1
python .\btc-bot\btc_trailing_bot.py     # start monitoring loop
python .\btc-bot\btc_execute_now.py      # one-shot initial buy
python .\btc-bot\btc_close_now.py        # one-shot close + cancel orders
python .\btc-bot\btc_status.py           # read-only: account + position + recent orders
```

```bash
# macOS / Linux — from repo root
source backend/.venv/bin/activate
python btc-bot/btc_trailing_bot.py
```

### Environment variables

Auto-loaded from `../backend/.env` (relative to this folder). Resolution order: `VISANU_*` takes precedence over `ALPACA_*` for the same key.

| Var                       | Required | Default                          | Purpose                                |
|---------------------------|----------|----------------------------------|----------------------------------------|
| `VISANU_ALPACA_API_KEY`   | yes¹     | —                                | Personal Alpaca paper key (preferred)  |
| `VISANU_ALPACA_SECRET_KEY`| yes¹     | —                                | Personal Alpaca paper secret (preferred) |
| `ALPACA_API_KEY`          | yes¹     | —                                | Fallback if `VISANU_*` not set         |
| `ALPACA_SECRET_KEY`       | yes¹     | —                                | Fallback if `VISANU_*` not set         |
| `BTC_USD`                 | no       | `10000`                          | Dollar amount of the initial buy       |
| `POLL_INTERVAL_SEC`       | no       | `30`                             | `btc_trailing_bot.py` polling interval |

¹ Either the `VISANU_*` pair or the `ALPACA_*` pair must be set. The scripts exit immediately if both pairs are missing/empty.

Paper trading endpoint is hard-coded: `https://paper-api.alpaca.markets`.

### Closing out

`btc_close_now.py` cancels any open BTC/USD orders first (stop-loss, GTC limits, ladder triggers) **then** market-sells the entire position. Safe to run when no position is open — it sweeps dangling orders and exits 0.

Expected output when flat:
```
Account: <id> (paper)
Buying power: $<n>

  No open BTC/USD position. Nothing to close.
```

