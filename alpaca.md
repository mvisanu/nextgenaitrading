You are a senior full-stack engineer working in Claude Code.

Before making any code changes:
1. Inspect the existing project/codebase and understand the current stack, folder structure, routing, state management, API layer, and dashboard components.
2. Create a short execution plan.
3. Then execute the plan.
4. Validate the implementation locally as much as possible.

## Objective

Integrate Alpaca Market Data into this project and build a live dashboard that displays real-time market data safely and reliably.

Use the official Alpaca docs as the source of truth:
- https://docs.alpaca.markets/docs/getting-started-with-alpaca-market-data
- https://docs.alpaca.markets/docs/streaming-market-data
- https://docs.alpaca.markets/docs/real-time-stock-pricing-data
- https://docs.alpaca.markets/docs/real-time-crypto-pricing-data
- https://docs.alpaca.markets/docs/market-data-faq

## Core Requirements

## Render Memory Constraint (Hard Requirement)

This app must be designed to run on Render within a strict 512 MB RAM limit.

Assume the deployment target is Render Free or Starter with only 512 MB available memory.

### Memory rules
- Keep total runtime memory usage comfortably below the limit, targeting a normal steady-state budget of ~250–350 MB and avoiding spikes near 512 MB.
- Do not load large historical datasets into memory.
- Do not keep unbounded in-memory caches.
- Do not store raw websocket message history indefinitely.
- Do not create one websocket connection per widget/card/component.
- Use a single shared websocket connection manager for market data.
- Subscribe only to symbols currently needed by the visible dashboard.
- Cap the default watchlist size to a small number unless explicitly overridden.
- Trim or evict old chart points aggressively.
- Use lightweight normalized in-memory state only.
- Avoid memory-heavy charting libraries if a lighter option works.
- Avoid large logging buffers and verbose debug logging in production.
- Clean up timers, subscriptions, listeners, and stale references on unmount/shutdown.
- Prevent duplicate polling plus websocket fanout from running at the same time unless absolutely required.

### Implementation guidance
- Prefer server-side initial fetch with a compact response shape.
- Return only the fields required by the UI.
- Downsample mini-chart/sparkline data before sending it to the client.
- Keep recent points per symbol capped to a small fixed window.
- Use pagination or lazy loading for any expanded symbol/history views.
- If background polling fallback is needed, use a slow interval and only for subscribed symbols.
- Avoid loading optional libraries at startup if they are not required for first paint.
- Use production mode settings appropriate for Render deployment.
- If the current stack includes memory-heavy dependencies, replace them with lighter alternatives when practical.

### Required safeguards
Implement:
- a small in-app memory-conscious symbol limit
- stale data cleanup
- bounded caches
- bounded retry queues
- bounded reconnect state
- protection against repeated watchlist expansion
- graceful degradation when memory pressure is suspected

### Validation requirements
Add a lightweight diagnostics mode that:
- logs connection counts
- logs subscribed symbol counts
- logs cache sizes / retained point counts
- makes it easy to verify the app is not retaining data indefinitely

### Deliverable requirement
After implementation, report:
1. estimated memory-sensitive areas
2. what was done to reduce memory usage
3. which caches/queues are bounded and how
4. what defaults were chosen to stay within Render 512 MB

Build and update the live dashboard that:

1. Loads initial market data for a configurable watchlist
2. Streams live updates after the initial load
3. Shows clear connection status
4. Handles reconnects automatically
5. Never exposes Alpaca API credentials in browser/client code
6. Works with the project’s existing stack and code style
7. Includes clear setup instructions and environment variables

## Functional Requirements

Implement the following:

### 1. Initial dashboard data load
On first page load, fetch initial data server-side or through a backend API layer.

Support:
- watchlist symbols from config or existing app state
- latest price data
- bid/ask if available
- daily change / percent change if available
- minute bar or recent candle data for small charts if the UI already supports charting
- last updated timestamp

### 2. Live streaming updates
After initial data is loaded, connect to Alpaca’s market data websocket and subscribe only to the symbols needed by the dashboard.

Requirements:
- centralize websocket connection management
- do not open duplicate websocket connections
- support subscribe/unsubscribe when symbols change
- merge streaming updates into dashboard state cleanly
- keep UI responsive and avoid unnecessary rerenders

### 3. Dashboard UI
Create or update a dashboard view to display:
- symbol
- last price
- absolute change
- percent change
- bid
- ask
- spread
- volume if available
- last update time
- websocket status badge: connecting / live / reconnecting / error / disconnected

If charts exist already, wire real data into them.
If no charts exist, add a minimal clean sparkline or recent-candle view only if it fits the current stack naturally.

### 4. Reliability
Implement:
- exponential backoff reconnect logic
- safe handling of auth failures
- safe handling of subscription failures
- stale-data detection in the UI
- loading states
- empty states
- rate-conscious symbol subscription management
- proper cleanup on unmount/shutdown

### 5. Security
Important:
- Alpaca keys must remain server-side only
- do not place secrets in frontend code
- do not expose secrets through browser network calls
- if this project is frontend-only, add a secure backend/proxy layer for Alpaca access
- read credentials from environment variables only

Use env vars like:
- APCA_API_KEY_ID
- APCA_API_SECRET_KEY
- ALPACA_DATA_MODE=stocks|crypto
- ALPACA_FEED=auto
- ALPACA_WATCHLIST=AAPL,MSFT,NVDA,SPY,BTC/USD,ETH/USD

### 6. Configurability
Allow easy configuration for:
- stock mode
- crypto mode
- default watchlist
- feed selection or auto mode
- sandbox/test mode
- max subscribed symbols
- polling fallback if websocket is unavailable

### 7. Validation
Add a test path for validating websocket behavior without depending entirely on market hours.

Include:
- a simple validation mode using Alpaca’s documented test stream / test symbol where appropriate
- logs that clearly show connect, auth, subscribe, message receive, reconnect, and disconnect flow
- defensive error messages that help diagnose subscription/feed/permission issues

## Architecture Expectations

Claude Code should implement the best architecture for the current stack, but prefer this pattern:

- UI/dashboard components
- market data service layer
- websocket connection manager
- backend/server route or API endpoint for initial fetch
- normalized data model for dashboard rows/cards
- optional store or context for live market state
- environment-based configuration

If the codebase uses:
- Next.js: prefer server routes / route handlers / server components where appropriate
- React SPA: add a backend API layer if none exists
- FastAPI / Node backend: use backend endpoints for bootstrap and websocket mediation if needed
- Python: use official Alpaca Python SDK if it fits better
- TypeScript/Node: use the official Alpaca JS SDK if it fits better

## Data Handling Rules

- Inspect the official docs first and use the currently documented endpoints/channels/messages
- Do not guess field names if the docs already define them
- Normalize incoming events so the UI consumes a stable internal shape
- Handle missing fields gracefully
- Preserve timestamps from Alpaca responses
- Avoid hardcoding only one symbol
- Make watchlist symbol parsing robust

## UX Requirements

- clean modern dashboard layout
- easy to scan
- color-coded up/down moves if project styling already supports it
- clear status indicators
- fast rendering
- no blocking UI during reconnects
- no noisy console spam in production mode

## Deliverables

1. Working implementation
2. `.env.example`
3. README section covering:
   - required Alpaca credentials
   - how to run locally
   - how to switch stocks vs crypto
   - how to test websocket connectivity
   - common failure cases and troubleshooting
4. Brief summary of what was changed
5. Any assumptions made

## Important Constraints

- Follow the existing project structure and naming conventions
- Reuse existing UI components where possible
- Keep code production-quality
- Add comments only where they provide real value
- Do not break existing dashboard features
- If anything in the existing codebase conflicts with the safest implementation, explain the conflict and choose the safer option

## Common Failure Cases to Handle

Build for these scenarios:
- missing API keys
- websocket auth failure
- unsupported feed for the account
- symbol subscription error
- too many websocket connections
- no data received
- market closed / thin data conditions
- reconnect storms
- user changing watchlist rapidly

## Final Output Format

After implementation, provide:
1. short execution summary
2. files changed
3. setup steps
4. known limitations
5. how to validate the live feed end-to-end