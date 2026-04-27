# Claude Code Prompt — Gold Multi-Strategy Signal Engine (FastAPI + PostgreSQL + Dashboard + SMS Alerts)

You are a senior quantitative software engineer, Python backend architect, FastAPI engineer, data engineer, backtesting engineer, and risk systems designer working in Claude Code.

Before making any code changes:
1. Inspect the existing project/codebase and understand the current structure, dependencies, environment setup, database usage, schedulers, APIs, and UI.
2. Create a short execution plan.
3. Then execute the plan step by step.
4. Validate the implementation locally as much as possible.
5. Keep all secrets in environment variables only. Do not hardcode API keys, tokens, passwords, or phone numbers in source files.

## Objective

Build a production-ready **paper-trading signal platform for Gold (XAUUSD)** that:

- fetches and stores multi-timeframe market data in PostgreSQL
- evaluates 4 strategies on a recurring decision pipeline
- ranks strategies by recent performance
- applies strict risk management before allowing any signal
- sends approved signals by SMS
- exposes a lightweight dashboard for health, signals, equity curve, and system status
- includes robust backtesting, forward validation, and parameter optimization
- explicitly prevents lookahead bias and stale-signal errors

This system should start in **paper-trading / signal-only mode**.
Do **not** place live broker orders unless explicitly added later.

---

## Core Market Scope

Primary symbol:
- `XAUUSD`

Timeframes:
- `15min`
- `1h`
- `4h`
- `1d`

Minimum historical load:
- Fetch and store at least the latest 200 candlesticks per timeframe on startup
- Support continued incremental refreshes afterward

---

## Required Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy 2.x
- Alembic
- APScheduler or a similarly reliable scheduler
- Pydantic settings for config management
- Structured logging

### Database
- PostgreSQL

### Frontend / Dashboard
Use one of these, favoring the simplest maintainable option already compatible with the codebase:
- FastAPI server-rendered dashboard with Jinja templates
- or a lightweight separate frontend if one already exists

Dashboard should show:
- latest market data refresh status
- current system mode
- signal history
- strategy rankings
- rolling performance metrics
- current daily drawdown
- kill switch status
- equity curve
- recent errors / warnings

### Notifications
Implement SMS notification support.
Preferred implementation:
- Twilio SMS provider

Store the recipient phone number in environment variables, not source code:
- `ALERT_PHONE_NUMBER`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Design notifications behind an abstraction so Telegram can be added later if needed.

### Market Data Provider
Primary:
- Twelve Data API

Design the provider layer so another source can be swapped in later.

---

## Strategies to Implement

Implement these 4 strategies as separate, testable modules with clean interfaces.

### 1. Liquidity Sweep
Purpose:
- Detect stop hunts around key levels, then trade the reversal after confirmation

Logic guidelines:
- Identify recent swing highs / swing lows or locally significant liquidity levels
- Detect wick-through behavior beyond the key level
- Require confirmation of reversal / structure shift before signaling
- Avoid triggering on weak fake reversals without confirmation

Signal output must include:
- direction
- entry
- stop loss
- take profit
- confidence
- reason summary

### 2. Trend Continuation
Purpose:
- Trade pullbacks in a strong trend using EMAs

Logic guidelines:
- Detect trend bias using EMA alignment and slope
- Wait for retracement into a moving average zone
- Require confirmation candle or continuation behavior
- Reject weak or sideways conditions

### 3. Breakout Expansion
Purpose:
- Trade range compression followed by expansion

Logic guidelines:
- Detect consolidation / volatility compression
- Measure range tightness and breakout conditions
- Require breakout confirmation, ideally with range expansion and volume proxy if available
- Avoid chasing already-extended moves

### 4. EMA Momentum
Purpose:
- Trade clean directional momentum when EMAs align and price confirms

Logic guidelines:
- Use EMA stack alignment and strong candle confirmation
- Require minimum trend quality
- Filter out weak crossover noise in choppy conditions

---

## Signal Schema

Every candidate signal must produce a standardized output model with at least:

- `symbol`
- `timeframe`
- `strategy_name`
- `direction` (`long` or `short`)
- `timestamp`
- `entry_price`
- `stop_loss`
- `take_profit`
- `risk_reward_ratio`
- `confidence_score` (0 to 100)
- `reasoning_summary`
- `features_snapshot`
- `signal_expiry_time`
- `volatility_snapshot`
- `position_size_recommendation`
- `status` (`candidate`, `approved`, `blocked`, `expired`, `sent`, `invalidated`)

The reasoning summary must be concise, human-readable, and grounded in actual rule outcomes.

---

## Decision Pipeline

Run a main decision pipeline every 30 minutes.

Pipeline responsibilities:
1. Refresh required data
2. Validate data completeness and freshness
3. Expire stale signals
4. Run all 4 strategies on the latest fully closed bars only
5. Score and rank strategy outputs
6. Apply risk filters
7. Block overexposure
8. Size the position based on volatility
9. Approve or reject the signal
10. Send SMS only if all conditions pass
11. Persist everything to PostgreSQL
12. Update dashboard metrics

Important:
- Never generate signals from partially formed candles unless explicitly configured
- Use only closed historical bars for strategy decisions
- Do not allow duplicate alerts for the same setup unless materially changed

---

## Risk Management Rules

Implement strict risk controls.

### Daily Loss Cap
- Max daily loss: `2%`
- If breached, block new signals for the rest of the trading day

### Consecutive Stop-Loss Kill Switch
- If the system hits `8 stop-losses in a row`, activate a kill switch
- Kill switch duration: `24 hours`
- During kill switch:
  - no new signals are sent
  - dashboard clearly shows paused status
  - all events are logged

### Exposure Controls
Block signals when:
- too many open correlated exposures exist
- multiple strategies point in the same direction and exceed configured risk concentration
- current volatility implies oversized stop distance or unstable conditions

### Position Sizing
Size positions dynamically based on volatility:
- use ATR or equivalent
- reduce size during high volatility
- reject trades when required stop distance makes sizing unsafe

All thresholds should be configurable.

---

## Backtesting and Validation

Implement a separate validation engine.

### Re-Backtesting
Every 4 hours:
- backtest the system on rolling windows:
  - 7 days
  - 14 days
  - 30 days
  - 60 days

Track:
- win rate
- expectancy
- max drawdown
- profit factor
- average R multiple
- strategy-specific performance
- per-timeframe performance

### Forward Validation
Implement:
- 80% train / 20% test split
- clear reporting of in-sample vs out-of-sample performance
- overfitting warning if out-of-sample performance collapses materially

### Monte Carlo Robustness
Every 6 hours:
- run Monte Carlo parameter validation across ~80 parameter combinations
- shuffle / perturb trade order or sample paths appropriately
- reject parameter sets that do not beat randomness or are too fragile

### Walk-Forward Improvement
Add a basic walk-forward evaluation mode if reasonable within scope.
Prefer realistic robustness over over-optimized performance.

---

## Critical Anti-Bug Requirement: No Lookahead Bias

A previous version had a fatal simulation bug caused by using the wrong bar / future data, producing fake performance and live losses.

You must explicitly defend against this.

Requirements:
- Use only information available at the time of the signal
- Entries, exits, and strategy features must be computed from closed bars only
- Backtests must simulate trade evaluation in correct chronological order
- No future bar high/low/close may leak into signal generation
- Add unit tests specifically designed to catch lookahead bias
- Add comments in code explaining how the simulator avoids this bug

This is a hard requirement.

---

## Data Model Requirements

Create PostgreSQL tables for at least:

- instruments
- candlesticks
- strategy_runs
- candidate_signals
- approved_signals
- signal_notifications
- trades_simulated
- trade_outcomes
- strategy_metrics
- risk_events
- system_health_events
- scheduler_runs
- optimization_runs
- kill_switch_events

Use Alembic migrations.

Candlestick storage should support:
- symbol
- timeframe
- open time
- open/high/low/close
- volume if available
- source provider
- ingestion timestamp
- uniqueness constraints to prevent duplicates

---

## Scheduling Requirements

Implement reliable schedulers for:
- market data refresh
- 30-minute decision pipeline
- 4-hour backtesting
- 6-hour Monte Carlo / robustness checks
- health checks / stale data checks

If you include faster polling for data freshness, isolate it clearly from the 30-minute decision engine.

Every scheduled task must:
- log start/end
- log duration
- log errors
- persist run status
- fail gracefully without crashing the whole app

---

## Dashboard Requirements

Build a lightweight dashboard showing:

### Overview
- service health
- last successful data update per timeframe
- last pipeline run
- current mode: active, paused, or kill switch
- daily PnL
- daily drawdown
- current open paper positions
- blocked signal count

### Signals
- recent candidate and approved signals
- strategy used
- confidence
- status
- risk/reward
- reason summary

### Performance
- equity curve
- win rate
- drawdown
- strategy ranking
- per-timeframe performance
- rolling 7d / 14d / 30d / 60d stats

### Risk
- kill switch events
- consecutive losses
- exposure blocks
- stale data warnings

Keep the UI simple, fast, and readable.

---

## Project Structure

Use a clean structure similar to:

- `app/main.py`
- `app/api/`
- `app/core/`
- `app/config/`
- `app/db/`
- `app/models/`
- `app/schemas/`
- `app/services/data_providers/`
- `app/services/strategies/`
- `app/services/risk/`
- `app/services/backtesting/`
- `app/services/optimization/`
- `app/services/notifications/`
- `app/services/dashboard/`
- `app/schedulers/`
- `app/tests/`
- `alembic/`
- `.env.example`
- `README.md`

---

## Testing Requirements

Add meaningful automated tests for:

- candlestick ingestion and deduplication
- closed-bar only signal generation
- strategy rule correctness
- risk filters
- stale signal expiry
- kill switch activation
- daily loss cap enforcement
- simulator chronology correctness
- lookahead bias prevention
- notification gating
- strategy ranking logic

Mock all external APIs in tests.

---

## Deliverables

Produce:

1. A working FastAPI backend
2. PostgreSQL persistence with Alembic migrations
3. Multi-strategy signal engine for XAUUSD
4. 30-minute decision pipeline
5. Risk management engine with:
   - 2% max daily loss
   - overexposure blocking
   - volatility-based sizing
   - 8-loss kill switch for 24 hours
6. SMS notification integration
7. Lightweight dashboard
8. Backtesting + forward validation + Monte Carlo module
9. Clear README with setup and run instructions
10. `.env.example`
11. Tests covering the most failure-prone logic
12. Safe defaults for paper-trading only

---

## Implementation Priorities

Build in this order unless the existing codebase suggests a better dependency flow:

1. config + database + migrations
2. candlestick ingestion
3. strategy interfaces and feature pipeline
4. risk engine
5. decision pipeline
6. notification layer
7. backtesting engine
8. dashboard
9. tests and hardening
10. docs and cleanup

---

## Non-Negotiable Engineering Standards

- No hardcoded secrets
- No live trading by default
- No lookahead bias
- Strong logging and failure visibility
- Idempotent schedulers where possible
- Small, modular, testable services
- Clear comments where financial logic could be misunderstood
- Favor correctness and safety over cleverness
- If something is ambiguous, make conservative assumptions and document them

---

## Final Output Expectations

At the end:
- summarize what you built
- list all files created or modified
- explain how to run the app locally
- explain how to run tests
- explain how to configure SMS alerts
- explain exactly how the simulator avoids future-data leakage
- call out any assumptions or remaining TODOs clearly