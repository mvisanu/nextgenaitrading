You are operating an EXISTING trading program in this repository. Do not build a new system unless absolutely required. Prefer using the current CLI, config, and execution flow already present.

Goal:
Use the existing paper-trading program to find and buy:
1. 1 hottest stock
2. 1 hottest bitcoin trade
3. 1 hottest gold trade
4. 1 hottest bullish stock option

Execution rules:
- PAPER trading only
- Conservative long-only entries only
- Run a full dry run first
- Then place approximately $1,000 of each only if the dry run confirms the setup passes all conservative checks
- Do not use live trading under any condition
- Do not ask me for confirmation unless there is a true blocker
- Make the best grounded choice from available market data and the program’s supported symbols

Use this workflow:

1. Inspect the existing codebase and determine:
   - the main entrypoint
   - how paper trading is configured
   - how the current screener/signal/buy flow works
   - how stocks, crypto, gold, and options are represented in the current program
   - what commands/config/env vars are required

2. Reuse the existing logic as much as possible.
   - Do not rewrite the app if it already works
   - Only make minimal changes if needed to support this exact run
   - Keep all changes small and targeted

3. Screening objective:
   Find the hottest BUY candidate in each bucket using conservative signals:
   - Stock: strongest bullish liquid stock candidate (Live Trading, Auto-Buy)
   - Bitcoin: BTC/USD
   - Gold and Silver: use the program’s supported gold instrument or proxy (Buy from Commodities section)
   - Option: 1 bullish CALL option on the strongest stock candidate, or the best supported fallback if needed

4. Conservative buy criteria:
   Only allow buys when the asset clearly passes conservative trend/momentum confirmation such as:
   - price above key moving averages
   - short-term trend above medium-term trend
   - momentum positive but not excessively overextended
   - liquidity acceptable
   - spread acceptable
   - no low-quality or thinly traded names
   - for options: choose a liquid call with reasonable spread and reasonable time to expiration

5. Dry run first:
   Run a dry run that prints:
   - selected symbol for each category
   - why it was selected
   - key signal values used
   - why it is conservative
   - exact intended order payload
   - estimated spend for each
   - which assets are skipped if they fail validation

6. After the dry run:
   If the setup is valid, place paper trades for about $1,000 each:
   - stock: about $1,000
   - bitcoin: about $1,000
   - gold: about $1,000
   - option: buy 1 contract only if total premium is within about $1,000; otherwise skip
   Never force a trade that does not pass validation.

7. Safety constraints:
   - hard fail if environment is not paper
   - no live orders
   - no margin
   - no shorting
   - no leverage
   - no naked options
   - no duplicate orders
   - skip any asset that does not meet conservative criteria
   - if gold direct commodity trading is not supported, automatically use the supported gold proxy already configured in the project

8. Output requirements:
   At the end, give me a clean summary with:
   - chosen stock, bitcoin, gold, and option
   - why each was chosen
   - dry run result
   - whether each order was submitted or skipped
   - exact paper order confirmations
   - any warnings or assumptions

9. Execution behavior:
   - inspect first
   - create a short execution plan
   - run the dry run
   - if valid, execute the paper buys
   - show me the final results clearly
   - log trade to LEDGER

Important:
Use the existing program in this repo. I do not need a new app. I need you to operate the current one and complete the paper-buy workflow.