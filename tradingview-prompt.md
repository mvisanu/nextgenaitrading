# Claude Code Prompt — Build TradingView Screener + Technical Analysis Page

You are a senior full-stack engineer, frontend architect, and trading app product engineer working in Claude Code.

Before making any code changes:
1. Inspect the existing project/codebase and understand:
   - frontend stack
   - routing structure
   - component library
   - API/data layer
   - current trading/investing pages
   - styling patterns
   - how MCP tools are already configured or accessed
2. Create a short execution plan.
3. Then execute the plan.
4. Validate the implementation locally as much as possible.

## Objective

Create a dedicated page in the application for:

- **TradingView Screener** = find interesting assets
- **TradingView TA** = analyze a selected asset technically

This page should help a user:
1. scan for promising assets using screener results
2. click/select an asset
3. immediately view technical analysis for that asset
4. review the setup in a clean, decision-friendly UI

---

## Core Requirements

Build **one dedicated page** focused only on these two MCP integrations.

### Primary workflow
1. User opens the page
2. User selects a market/universe and screener inputs
3. App uses **TradingView Screener MCP** to fetch interesting assets
4. Results are shown in a sortable/filterable list
5. User clicks one asset
6. App uses **TradingView TA MCP** to analyze that asset
7. TA results are shown in a detailed analysis panel

---

## Use These MCP Tools

### 1. TradingView Screener MCP
Use this to:
- find interesting assets
- fetch screener results
- support filters such as:
  - market or exchange
  - asset type
  - sector if available
  - price range
  - volume
  - relative strength / momentum signals if available
  - change %
  - 52-week position if available

Goal:
Return a useful shortlist of opportunities rather than dumping raw data.

### 2. TradingView TA MCP
Use this to:
- analyze a selected symbol
- fetch technical summary / recommendation
- fetch indicator values if available
- support timeframe analysis such as:
  - 1D
  - 4H
  - 1H
  - 15m

Goal:
Show an easy-to-read technical view for the selected asset.

---

## Page Requirements

Create a page with the following layout:

### A. Header section
- Page title
- Short description:
  - Screener finds candidates
  - TA analyzes the selected candidate
- Refresh button
- Last updated timestamp

### B. Screener controls panel
Include controls for:
- market / asset universe
- exchange if applicable
- search text
- minimum price
- maximum price
- minimum volume
- top N results
- optional sort field
- optional sort direction

If the MCP server supports additional screener filters discovered during inspection, expose them cleanly.

### C. Screener results section
Display results in a clean table or card list with columns like:
- symbol
- name
- exchange
- price
- change %
- volume
- any other useful available screener metrics

Requirements:
- sortable where practical
- selectable row/card
- selected asset visibly highlighted
- loading state
- empty state
- error state

### D. Technical analysis panel
When an asset is selected, show:
- symbol / name
- timeframe selector
- overall recommendation
- buy / neutral / sell breakdown if available
- indicator summary if available
- key indicators such as RSI, MACD, moving averages, etc. if provided by the MCP
- trend summary in plain language

### E. Analyst summary section
Add a small computed summary block that explains:
- why the asset appeared in screener results
- what the TA currently suggests
- whether the setup looks bullish, bearish, or mixed

This summary must be conservative and descriptive.
Do not make guarantees.
Do not present this as financial advice.

---

## UX Requirements

- Follow the existing app design system exactly
- Reuse existing layout/components where possible
- Keep the page responsive and desktop-first but mobile-friendly
- Prefer a two-column layout on desktop:
  - left = screener results
  - right = TA detail
- On smaller screens, stack sections vertically
- Make loading and error states polished and readable

---

## Technical Requirements

- Use the existing project stack and patterns
- Do not introduce unnecessary new libraries
- Keep code modular and production-ready
- Separate:
  - page container
  - screener controls
  - screener results list/table
  - technical analysis panel
  - summary panel
- Add strong typing if the project uses TypeScript
- Create helper types/interfaces for screener results and TA results
- Normalize inconsistent MCP responses into frontend-friendly models
- Handle missing/null fields safely

---

## Data / Integration Requirements

### Screener integration
- Connect the page to the **TradingView Screener MCP**
- Inspect the available MCP methods first
- Use the most appropriate method(s) for listing/filtering assets
- Transform raw results into a normalized UI model

### TA integration
- Connect the page to the **TradingView TA MCP**
- Inspect the available MCP methods first
- Use the most appropriate method(s) for symbol technical analysis
- Support at least one default timeframe and allow switching if supported

### Important
Do not invent MCP method names.
First inspect how the MCP servers are exposed in this environment, then wire the implementation to the actual available methods.

---

## Safety / Product Guardrails

- This page is for research and decision support
- Add a visible disclaimer such as:
  - "Technical analysis is informational only and not financial advice."
- Avoid language like:
  - guaranteed winner
  - best stock to buy now
  - certain profit
- If data is unavailable, explain that clearly instead of guessing

---

## Deliverables

Implement all needed code for:
1. the page
2. supporting components
3. any required hooks/services/helpers
4. routing integration
5. basic loading/error/empty states

Also provide:
- a short summary of what was added
- where the files were created/updated
- how the page works
- any assumptions made about the MCP tool responses

---

## Suggested Page Behavior

### Default behavior
On first load:
- show screener controls with sensible defaults
- optionally auto-run one default screener query
- no TA panel until a symbol is selected, or auto-select the first result if that fits the current UX

### On result click
- load TA for that symbol
- show spinner in TA panel
- preserve selected row state

### On timeframe change
- reload TA for the selected symbol
- update recommendation and indicators

---

## Optional Nice-to-Have Improvements
Only do these if they fit naturally into the existing project:
- save last used screener filters in local storage
- favorite/watchlist toggle if the app already has that concept
- quick action buttons like:
  - analyze first result
  - refresh analysis
- compare 2–3 timeframes in a compact view

Do not add large new platform features outside the scope of this page.

---

## Implementation Notes

- Prefer clarity over overengineering
- Keep the code easy to extend later
- Match the project’s current naming/style conventions exactly
- Reuse any shared table, card, badge, tabs, or form components that already exist

---

## Final Output Format

At the end, provide:
1. execution plan
2. files changed
3. implementation summary
4. assumptions
5. validation notes