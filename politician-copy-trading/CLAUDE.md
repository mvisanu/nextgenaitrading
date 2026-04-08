# CLAUDE.md - Politician Copy Trader

Standalone Python bot inside the NextGenStock monorepo.
Watches Quiver Quantitative's congressional trading API and mirrors
new disclosures on Alpaca (Visanu's paper account by default).

## Directory layout

```
politician-copy-trading/
├── config.py              # Loads env vars; credentials from backend/.env
├── capitol_scraper.py     # Quiver Quant API client (replaces Capitol Trades scraping)
├── politician_ranker.py   # Ranks politicians: quality-weighted score (win rate + excess return)
├── copy_trader.py         # Alpaca order execution (stocks + options fallback)
├── trade_tracker.py       # SQLite — deduplication, seeding, history
├── scheduler.py           # APScheduler: poll / rerank / morning summary / seed
├── main.py                # CLI entry point
├── setup.py               # One-time pip install helper
├── run_bot.bat            # Restart-loop launcher (used by Windows Startup shortcut)
├── requirements.txt
├── .env                   # Local overrides (gitignored)
├── bot.log                # Full runtime log (created at runtime)
└── trade_history.db       # SQLite DB (created at runtime, gitignored)
```

## Data source

Trades come from **Quiver Quantitative's free API**, not Capitol Trades HTML:
```
GET https://api.quiverquant.com/beta/live/congresstrading
```
Returns up to 1000 most recent congressional trades with pre-calculated
`ExcessReturn` (vs SPY) and `PriceChange` fields — no yfinance needed for ranking.

## Credential convention

Alpaca credentials live in `backend/.env` under Visanu's keys:
```
visanu_alpaca_endpoint_url=https://paper-api.alpaca.markets
visanu_alpaca_api_key=...
visanu_alpaca_secret_key=...
```
`config.py` loads `backend/.env` first, then `politician-copy-trading/.env` as override.
The local `.env` must NOT contain the `visanu_alpaca_*` keys — they would
override the real credentials with placeholders.

## Running the bot

```bash
cd politician-copy-trading
pip install -r requirements.txt

python main.py --rank-only      # Show rankings and exit (no trades)
python main.py                  # Start bot (DRY_RUN from .env)
python main.py --live           # Force live trading (prompts confirmation)
python main.py --dry-run        # Force dry-run for this session
python main.py --politician J000309   # Pin a specific politician by BioGuideID
python main.py --summary        # Print portfolio + trade log
```

## Scheduler jobs

| Job | Trigger | What it does |
|-----|---------|--------------|
| `job_poll_trades` | Every 15 min | Check Quiver for new disclosures; copy any new ones |
| `job_rerank` | Every 24 hrs | Re-score all politicians; switch target if better found |
| `job_morning_summary` | 8:00 AM ET Mon-Fri | Print Alpaca portfolio P/L + recent copied trades |
| `_seed_existing_trades` | Once on startup | Mark all current politician trades as pre-existing so old history is never bulk-copied |

## Scoring formula (quality over quantity)

```python
import math
recency_bonus = math.log1p(recent_count) * 3.0
score = (win_rate * 1.5) + (avg_excess_return * 5.0) + recency_bonus
```

- `win_rate`: % of buy trades that beat SPY (ExcessReturn > 0)
- `avg_excess_return`: average % outperformance vs SPY across all buys
- `recency_bonus`: log-scaled so high-volume traders don't dominate
- `avg_excess_return` has the highest weight (x5) — beating the market is the goal

**Why this formula:** The old linear recency bonus (x2.5 per trade) caused Cisneros
(83 trades, 42% win rate, -0.5% excess) to outscore Jackson (14 trades, 92% win rate,
+8.3% excess). Log-scaling recency fixed this.

## Current target

**Jonathan Jackson** (BioGuideID: `J000309`)
- 92% buy win rate, +8.3% avg excess return vs SPY
- Best picks: GEV +30.1%, VSAT +26.2%, BK +8.4%, WMT +6.8%
- Last disclosure batch: March 12, 2026 (trades from Feb 17)
- Next disclosure expected: mid-April 2026 (45-day STOCK Act window)

Pinned via `TARGET_POLITICIAN=J000309` in `.env`.
Remove that line to revert to auto-ranking.

## Startup seeding (critical design decision)

On every startup, `_seed_existing_trades()` runs before the first poll.
It marks all existing trades for the current politician as `status=pre-existing`
in `copied_trades` with no Alpaca order. This prevents the bot from bulk-copying
weeks of historical trades when it first starts watching a politician.

Only trades that appear in Quiver Quant AFTER the seed run will trigger real orders.

## Trade copying rules

- **Stocks & ETFs** -- market order at `COPY_TRADE_AMOUNT` USD (fractional shares)
- **Options** -- tries to reconstruct contract symbol from disclosure comment;
  falls back to buying the underlying stock if contract can't be identified
- **Sells** -- only executed if position exists in Alpaca; otherwise logged and skipped
- **Deduplication** -- each trade_id copied at most once ever (enforced by SQLite UNIQUE)

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `visanu_alpaca_endpoint_url` | paper URL | From backend/.env |
| `visanu_alpaca_api_key` | - | From backend/.env |
| `visanu_alpaca_secret_key` | - | From backend/.env |
| `COPY_TRADE_AMOUNT` | 300 | USD per copied trade |
| `DRY_RUN` | true | false = real orders |
| `TARGET_POLITICIAN` | J000309 | BioGuideID to pin; blank = auto-rank |
| `RANK_LOOKBACK_DAYS` | 90 | Days of history for scoring |
| `MIN_TRADES_TO_QUALIFY` | 5 | Min trades to appear in rankings |
| `POLL_INTERVAL_MIN` | 15 | Minutes between Quiver checks |
| `RERANK_INTERVAL_HOURS` | 24 | Hours between re-ranking runs |

## Auto-start (Windows)

A shortcut at:
```
C:\Users\Bruce\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\PoliticianCopyTrader.lnk
```
launches `run_bot.bat` on login. The bat file has a 30-second restart loop
so if the bot crashes it recovers automatically.

## Known limitations

- Quiver Quant free API returns up to 1000 trades max (no pagination)
- STOCK Act allows 45-day filing delay -- trades may be old by the time they appear
- Options contract reconstruction from disclosure text is best-effort;
  specific strike/expiry often not reported, falls back to underlying stock
- Sells are skipped if no matching position -- bot is buy-focused by design
