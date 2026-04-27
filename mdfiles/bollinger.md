# Claude Code Prompt — Add Bollinger Band Squeeze Detection to NextGenTAI

You are a senior full-stack engineer, quantitative trading engineer, backend architect, frontend engineer, and product-minded implementation lead working in Claude Code.

Before making any code changes:
1. Inspect the existing codebase and understand the current architecture, indicator engine, market data flow, alert system, strategy logic, database models, API structure, and UI patterns.
2. Create a short execution plan.
3. Then execute the plan.
4. Validate the implementation locally as much as possible.
5. Do not break existing trading, alerting, watchlist, or chart functionality.

## Objective

Add a **Bollinger Band Squeeze** feature to the existing NextGenTAI stock app.

This feature should:
- detect when a stock is in a Bollinger Band squeeze
- show the squeeze clearly in the UI
- track squeeze strength and breakout direction
- optionally trigger alerts when a squeeze begins or when price breaks out of the squeeze
- fit into the current app architecture and code style
- be configurable, testable, and production-ready

The implementation must adapt to the existing project structure rather than forcing a new architecture.

---

## What the feature means

A **Bollinger Band Squeeze** happens when volatility contracts and the Bollinger Bands become unusually narrow compared with recent history.

This usually signals:
- low volatility
- price compression
- potential for a future breakout move

The feature should not claim that a breakout is guaranteed.
It should present the squeeze as a **volatility compression setup**.

---

## Core feature requirements

### 1) Bollinger Band calculation
Implement Bollinger Bands using configurable parameters:
- default length: `20`
- default standard deviation multiplier: `2`

Compute:
- middle band = SMA(close, length)
- upper band = middle band + (stddev * multiplier)
- lower band = middle band - (stddev * multiplier)

Also compute:
- band width = `(upper - lower) / middle * 100`
- optional normalized width for ranking/comparison

### 2) Squeeze detection logic
Implement at least one primary squeeze detection method and support configuration for thresholds.

Preferred default logic:
- a squeeze is active when current Bollinger Band width is in the lowest percentile of the last N bars

Suggested defaults:
- `lookbackBars = 120`
- `squeezePercentile = 15`

So by default:
- mark squeeze active when current band width is at or below the 15th percentile of the last 120 bars

Also support a simpler threshold mode if the codebase already prefers explicit thresholds:
- example: squeeze is active when `bandWidth <= configuredThreshold`

The system should expose:
- `isSqueeze`
- `bandWidth`
- `bandWidthPercentile`
- `squeezeStrengthScore`

### 3) Breakout detection after squeeze
Track breakout events after a squeeze.

Suggested breakout rules:
- bullish breakout: close above upper Bollinger Band after active squeeze
- bearish breakout: close below lower Bollinger Band after active squeeze

Optional confirmation filters:
- breakout candle volume above moving average volume
- trend confirmation using EMA 20 vs EMA 50
- optional ADX confirmation
- optional close above recent swing high for bullish breakouts
- optional close below recent swing low for bearish breakouts

Expose:
- `breakoutState`: `none | bullish | bearish`
- `breakoutConfirmed`: boolean
- `breakoutTimestamp`
- `barsSinceSqueezeStarted`

### 4) Chart and UI
Add squeeze data to the UI in a clear layman-friendly way.

Minimum UI elements:
- indicator card showing whether squeeze is active
- band width value
- percentile ranking
- squeeze strength score
- last breakout direction
- breakout confidence if available

Chart behavior:
- display Bollinger Bands on the chart if charts already support overlays
- visually highlight squeeze zones
- mark bullish and bearish breakout points
- do not clutter the interface

Use simple wording such as:
- “Squeeze active: volatility is unusually tight”
- “Possible breakout setup forming”
- “Bullish breakout after squeeze”
- “Bearish breakout after squeeze”

Avoid jargon-heavy wording unless the app already uses it.

### 5) Alerts
Integrate with the existing alert system.

Support alerts for:
- squeeze started
- squeeze ended
- bullish breakout after squeeze
- bearish breakout after squeeze

Alert payload should include:
- ticker
- timeframe
- current price
- band width
- squeeze percentile
- breakout direction if applicable
- timestamp

### 6) Timeframe support
Support multiple timeframes if the app already supports them, such as:
- daily
- weekly
- intraday

The implementation should be consistent across timeframes and should not assume only daily candles.

### 7) Strategy / scanner integration
If the app already has scanners or strategy filters, allow Bollinger Band squeeze to be used as a filter.

Examples:
- “show stocks currently in squeeze”
- “show stocks that broke out of squeeze in last 3 bars”
- “show strongest squeeze candidates ranked by narrowest band width percentile”

### 8) Database and persistence
If indicator results are stored or cached, add the required schema changes cleanly.

Possible fields:
- ticker
- timeframe
- band_width
- band_width_percentile
- is_squeeze
- squeeze_strength_score
- breakout_state
- breakout_confirmed
- calculated_at

Do not over-engineer storage if the existing codebase computes indicators on demand.

---

## Backend requirements

Implement or extend backend services to:
- calculate Bollinger Bands
- calculate band width and percentile
- detect squeeze state
- detect breakout state
- expose results via existing API patterns
- keep functions modular and testable

Preferred backend design:
- pure calculation utilities separated from API handlers
- easy to unit test
- clear typing
- input validation
- safe handling of missing / partial candle data

If the project uses FastAPI:
- follow existing router/service/schema conventions
- add or extend endpoints instead of creating inconsistent patterns

Possible API outputs:
- current squeeze status for a symbol/timeframe
- historical squeeze events
- latest breakout events
- ranked scanner results

---

## Frontend requirements

If the project uses Next.js or a similar frontend:
- follow the existing component structure and design system
- create reusable indicator display components where appropriate
- avoid introducing a parallel styling system
- make the UI mobile-friendly

Suggested frontend views:
1. Symbol detail page
   - show Bollinger Band squeeze status card
   - show chart overlays and recent breakout markers

2. Scanner page
   - filter and rank symbols currently in squeeze
   - filter recent bullish breakout after squeeze
   - filter recent bearish breakout after squeeze

3. Alert settings
   - allow user to enable squeeze alerts and breakout alerts

---

## Calculation details

Implement the math carefully and consistently.

### Bollinger Band formulas
- `middle = SMA(close, length)`
- `std = standardDeviation(close, length)`
- `upper = middle + (std * multiplier)`
- `lower = middle - (std * multiplier)`

### Band width
- `bandWidth = ((upper - lower) / middle) * 100`

Handle edge cases safely:
- avoid divide-by-zero issues
- return stable results for insufficient history
- do not produce misleading signals with too few bars

### Percentile ranking
Given the last `lookbackBars` band width values:
- compute where the current band width ranks relative to recent history
- lower percentile = tighter squeeze

Example:
- percentile 8 means current width is tighter than most recent values
- percentile 50 means average compression
- percentile 90 means bands are wide, not a squeeze

---

## Product behavior and messaging rules

Do not describe the feature as:
- guaranteed breakout
- guaranteed buy signal
- guaranteed profit

Instead describe it as:
- volatility compression
- possible breakout setup
- low-volatility condition
- technical setup that may precede expansion

Use user-friendly explanations where possible.

Good examples:
- “The stock is trading in an unusually tight range.”
- “This can sometimes happen before a larger move.”
- “Wait for breakout confirmation before treating this as a directional signal.”

---

## Testing requirements

Create comprehensive tests.

### Unit tests
Test:
- Bollinger Band calculations
- band width calculations
- percentile ranking logic
- squeeze detection
- breakout detection
- edge cases with insufficient data
- flat price series
- highly volatile series
- missing values if relevant

### Integration tests
Test:
- API returns correct squeeze fields
- alerts trigger correctly
- scanner filters work
- symbol detail page renders correct values

### UI validation
Check:
- squeeze card displays correctly
- chart markers appear in expected places
- no broken layouts
- no duplicated alerts
- no confusion between squeeze-active and breakout-active states

---

## Acceptance criteria

The implementation is complete when:

1. Bollinger Bands are calculated correctly using configurable inputs.
2. The app can detect when a Bollinger Band squeeze is active.
3. The app can detect and label bullish or bearish breakout attempts after a squeeze.
4. Users can see squeeze state clearly in the UI.
5. Users can filter for squeeze setups in scanners if scanning already exists.
6. Alerts can notify users when a squeeze starts or breaks out.
7. The feature is fully tested.
8. Existing functionality remains intact.
9. Messaging does not overpromise results.
10. The code follows the current project structure and style.

---

## Deliverables

At the end, provide:
1. a short summary of what was added
2. the files changed
3. any database migrations added
4. any new API endpoints or schema changes
5. any new environment variables or config settings
6. follow-up suggestions for future improvements

---

## Optional enhancements

Implement these only if they fit naturally into the current architecture:

- Squeeze ranking score across watchlist symbols
- compare current squeeze against symbol’s 1-year historical squeezes
- combine squeeze with volume breakout confirmation
- combine squeeze with EMA trend filter
- add backtesting support for squeeze breakout setups
- add dry-run mode for alert evaluation
- add explainability text such as:
  - “Band width is tighter than 92% of the last 120 bars”

Do not add speculative features unless they are clearly separated as optional.

---

## Implementation style rules

- Keep the code clean, modular, typed, and easy to test
- Reuse existing utilities where appropriate
- Do not rewrite unrelated parts of the system
- Do not create dead code
- Prefer small, composable functions
- Follow the existing naming conventions
- Prefer explicit, readable logic over clever shortcuts
- Validate locally as much as possible before finishing