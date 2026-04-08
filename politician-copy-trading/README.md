# Politician Copy Trader

Automated copy-trading bot that monitors [Capitol Trades](https://www.capitoltrades.com/) for politician stock disclosures and mirrors them on your Alpaca account.

## How it works

1. **Ranks politicians** by 30-day buy win-rate and average return using yfinance price data
2. **Auto-selects** the top performer (or follows a pinned politician you choose)
3. **Polls Capitol Trades every 15 minutes** for new disclosures
4. **Copies each new trade** to your Alpaca account at a configurable dollar size
5. **Tracks everything** in a local SQLite database so no trade is duplicated
6. **Re-ranks daily** and switches target if someone overtakes the current leader

---

## Quick start

### 1. Prerequisites

- Python 3.11+
- Alpaca account (paper or live) — credentials in `backend/.env`
- Internet access to Capitol Trades

### 2. Install

```bash
cd politician-copy-trading
pip install -r requirements.txt
```

### 3. Configure

Credentials are read automatically from `backend/.env`:

```env
visanu_alpaca_endpoint_url=https://paper-api.alpaca.markets
visanu_alpaca_api_key=YOUR_KEY
visanu_alpaca_secret_key=YOUR_SECRET
```

Optional overrides in `politician-copy-trading/.env`:

```env
COPY_TRADE_AMOUNT=300    # USD per trade
DRY_RUN=true             # false = real orders
TARGET_POLITICIAN=       # blank = auto-select best
POLL_INTERVAL_MIN=15
```

### 4. Preview rankings (no trades placed)

```bash
python main.py --rank-only
```

Sample output:
```
Rank  Politician                     Trades   Win%     Avg Ret%   Recent   Score
---------------------------------------------------------------------------------
1     Nancy Pelosi                   18       72       +4.2       3        82.1
2     Michael Burgess                12       67       +3.1       2        71.4
3     Dan Crenshaw                   9        61       +2.8       1        58.3
      Best trades: NVDA +18.2%, MSFT +9.4%, AAPL +6.1%
```

### 5. Start the bot (dry run — safe default)

```bash
python main.py
```

No real orders are placed. All trades are logged to `bot.log` and `trade_history.db`.

### 6. Go live with real money

```bash
python main.py --live
```

You'll be prompted to confirm before anything executes.

---

## CLI flags

| Flag | Description |
|------|-------------|
| `--rank-only` | Print rankings and exit |
| `--summary` | Print portfolio P/L + recent copied trades |
| `--dry-run` | Force dry-run for this session |
| `--live` | Force live trading (prompts confirmation) |
| `--politician <slug>` | Pin a specific politician, e.g. `nancy-pelosi` |

---

## Scheduler

| Job | Schedule | What it does |
|-----|----------|--------------|
| Poll trades | Every 15 min | Check for new disclosures and copy them |
| Re-rank | Every 24 hrs | Re-score politicians; switch if better found |
| Morning summary | 8:00 AM ET Mon–Fri | Print Alpaca P/L + copy trade log |

---

## File structure

```
politician-copy-trading/
├── config.py              # Env var loader (backend/.env + local .env)
├── capitol_scraper.py     # Scrapes capitoltrades.com
├── politician_ranker.py   # Scores politicians by buy performance
├── copy_trader.py         # Alpaca order execution
├── trade_tracker.py       # SQLite deduplication + history
├── scheduler.py           # APScheduler jobs
├── main.py                # CLI entry point
├── setup.py               # One-time install helper
├── requirements.txt
├── .env                   # Local overrides (gitignored)
├── CLAUDE.md              # AI assistant context
└── trade_history.db       # Created at runtime (gitignored)
```

---

## Trade copying rules

- **Stocks & ETFs** — market order at `COPY_TRADE_AMOUNT` USD (fractional shares supported)
- **Options** — tries to reconstruct the contract from the disclosure comment; falls back to buying the underlying stock if the contract can't be identified
- **Sells** — only executed if you already hold the position; otherwise logged and skipped
- **Deduplication** — each Capitol Trades disclosure ID is copied at most once, forever

---

## Adjusting trade size

Set `COPY_TRADE_AMOUNT` in `.env`. This is independent of the politician's reported amount (which is just a range like `$15,001–$50,000`).

```env
COPY_TRADE_AMOUNT=500   # $500 per trade
```

---

## Logs

- `bot.log` — full timestamped log of every poll, copy attempt, and order result
- `trade_history.db` — SQLite with tables: `copied_trades`, `ranking_history`, `bot_state`

---

## Disclaimer

This bot copies **public disclosure data** from Capitol Trades (sourced from STOCK Act filings). Disclosures can be filed up to 45 days after the actual trade, so you may be copying trades that are already priced in. Past performance of any politician's trades does not guarantee future results. Use at your own risk. Start with dry-run mode and small amounts.
