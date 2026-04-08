# NextGen AI Trading — Top 50 Competitor Analysis
## Claude Code Prompt · notebooklm-py v0.3.4 · All 15 Bugs Fixed

> **How to run:** Paste this file as a Claude Code prompt. Claude Code will execute each step.
> CLI reference: https://github.com/teng-lin/notebooklm-py/blob/main/docs/cli-reference.md
>
> **Plan requirements for 100+ sources:**
> Standard = 50 sources | Plus = 100 | Pro = 300 | Ultra = 600
> Check your tier before adding sources or you will hit a silent limit.

---

## ARTIFACT GENERATION LEGEND

Before running Step 7, understand the sync/async behavior of each generator:

| Artifact Type | Sync or Async | Typical Wait | Notes |
|--------------|---------------|--------------|-------|
| `mind-map` | **Synchronous** | Instant | No `--wait`, no `artifact wait` needed |
| `data-table` | Async | 1–5 min | Fire → get task ID → `artifact wait` → download |
| `report` | Async | 2–8 min | Fire → get task ID → `artifact wait` → download |
| `infographic` | Async | 2–8 min | Fire → get task ID → `artifact wait` → download |
| `slide-deck` | Async | 5–15 min | Fire → get task ID → `artifact wait` → download |
| `audio` | Async | 10–20 min | Use subagent pattern (see Step 7) |
| `video` | Async | 15–30 min | Use subagent pattern (see Step 7) |

For all async types: **never download immediately after generate.** Always capture the task ID
from `notebooklm artifact list --json`, wait with `artifact wait <id>`, then download with `-a <id>`.

---

## CONTEXT

**My product:** https://nextgenaitrading.vercel.app/
**Goal:** Compare NextGen AI Trading against 50 close competitors. Find strengths, weaknesses,
gaps, and the top product improvements.

---

## STEP 0 — INSTALL, VERIFY & AUTHENTICATE

```bash
# Install with browser support (PyPI release — do NOT use main branch)
pip install "notebooklm-py[browser]" --break-system-packages

# Install Playwright
playwright install chromium
# Linux fix if you get "TypeError: onExit is not a function":
# pip install playwright==1.41.0 --break-system-packages && playwright install chromium

# Install and verify the Claude Code skill
notebooklm skill install
notebooklm skill status

# Print bundled Claude Code skill template for reference
# FIX #4: agent show claude IS a real command in the official README
notebooklm agent show claude

# Authenticate — opens Chromium; complete Google login, then press Enter in terminal
notebooklm login

# Verify auth — MUST pass before proceeding
notebooklm auth check --test
```

---

## STEP 1 — CREATE NOTEBOOK & CAPTURE ID

```bash
# Create the notebook
notebooklm create "NextGen AI Trading — 50 Competitor Analysis 2026"

# FIX #1 & #7: list --json returns {"notebooks":[...]} not a bare array.
# Also filter by title instead of blindly taking index [0] in case of pre-existing notebooks.
NOTEBOOK_ID=$(notebooklm list --json | python3 -c "
import sys, json
data = json.load(sys.stdin)
# data is a dict with a 'notebooks' key, not a bare list
notebooks = data.get('notebooks', data) if isinstance(data, dict) else data
matches = [n for n in notebooks if '50 Competitor Analysis 2026' in n.get('title', '')]
if not matches:
    # Fallback: take most recently created (index 0 is newest)
    print(notebooks[0]['id'])
else:
    print(matches[0]['id'])
")
echo "Notebook ID: $NOTEBOOK_ID"

# Set it as active context
notebooklm use $NOTEBOOK_ID

# Confirm context
notebooklm status
```

---

## STEP 2 — ADD MY PRODUCT SOURCES

```bash
# Add without --wait to avoid blocking; poll in Step 5
notebooklm source add "https://nextgenaitrading.vercel.app/"
notebooklm source add "https://nextgenaitrading.vercel.app/dashboard"
notebooklm source add "https://nextgenaitrading.vercel.app/features"
notebooklm source add "https://nextgenaitrading.vercel.app/pricing"
notebooklm source add "https://nextgenaitrading.vercel.app/about"

# FIX #10: Use --mode deep for research queries that need breadth (not --mode fast)
# fast = quick scan; deep = more sources, better coverage for broad topics
notebooklm source add-research "NextGen AI Trading nextgenaitrading.vercel.app features review AI trading platform" --mode deep
```

---

## STEP 3 — ADD ALL 50 COMPETITOR SOURCES

> Add all in bulk without blocking. Step 5 has a polling loop to wait for READY status.
> If you hit your plan's source limit, stop and upgrade your NotebookLM tier first.

### TIER 1 — The Original 17 Retail Brokerages

```bash
notebooklm source add "https://robinhood.com/"
notebooklm source add "https://robinhood.com/us/en/support/articles/robinhood-gold/"
notebooklm source add "https://www.fidelity.com/"
notebooklm source add "https://www.fidelity.com/trading/commissions-margin-rates"
notebooklm source add "https://www.fidelity.com/research-tools/overview"
notebooklm source add "https://www.schwab.com/"
notebooklm source add "https://www.schwab.com/pricing"
notebooklm source add "https://www.schwab.com/trading/thinkorswim"
notebooklm source add "https://www.schwab.com/trading/thinkorswim/papermoney"
notebooklm source add "https://us.etrade.com/home"
notebooklm source add "https://us.etrade.com/what-we-offer/our-products"
notebooklm source add "https://us.etrade.com/trading/power-etrade"
notebooklm source add "https://www.webull.com/"
notebooklm source add "https://www.webull.com/activity/paper-trade"
notebooklm source add "https://www.interactivebrokers.com/en/home.php"
notebooklm source add "https://www.interactivebrokers.com/en/accounts/fees.php"
notebooklm source add "https://investor.vanguard.com/home"
notebooklm source add "https://www.merrilledge.com/"
notebooklm source add "https://www.merrilledge.com/guided-investing"
notebooklm source add "https://www.sofi.com/invest/"
notebooklm source add "https://www.sofi.com/invest/active-investing/"
notebooklm source add "https://public.com/"
notebooklm source add "https://public.com/premium"
notebooklm source add "https://m1.com/"
notebooklm source add "https://m1.com/invest/"
notebooklm source add "https://www.ally.com/invest/"
notebooklm source add "https://www.moomoo.com/us"
notebooklm source add "https://www.moomoo.com/us/pricing"
notebooklm source add "https://tastytrade.com/"
notebooklm source add "https://tastytrade.com/pricing/"
notebooklm source add "https://www.firstrade.com/content/en-us/welcome"
notebooklm source add "https://www.firstrade.com/content/en-us/pricing"
```

### TIER 2 — AI & Signal Trading Platforms (Closest Competitors)

```bash
notebooklm source add "https://www.trade-ideas.com/"
notebooklm source add "https://www.trade-ideas.com/holly-ai/"
notebooklm source add "https://www.trade-ideas.com/pricing/"
notebooklm source add "https://trendspider.com/"
notebooklm source add "https://trendspider.com/features/"
notebooklm source add "https://trendspider.com/pricing/"
notebooklm source add "https://tickeron.com/"
notebooklm source add "https://tickeron.com/pricing/"
notebooklm source add "https://danelfin.com/"
notebooklm source add "https://danelfin.com/pricing"
notebooklm source add "https://www.kavout.com/"
notebooklm source add "https://alpaca.markets/"
notebooklm source add "https://alpaca.markets/pricing"
notebooklm source add "https://www.quantconnect.com/"
notebooklm source add "https://www.quantconnect.com/pricing"
notebooklm source add "https://www.composer.trade/"
notebooklm source add "https://www.composer.trade/pricing"
notebooklm source add "https://streak.tech/"
notebooklm source add "https://signalstack.com/"
```

### TIER 3 — Paper Trading & Simulation

```bash
notebooklm source add "https://www.investopedia.com/simulator/"
notebooklm source add "https://www.marketwatch.com/games"
notebooklm source add "https://www.tradestation.com/"
notebooklm source add "https://www.tradestation.com/pricing/"
notebooklm source add "https://ninjatrader.com/"
notebooklm source add "https://ninjatrader.com/pricing/"
```

### TIER 4 — Social / Copy Trading

```bash
notebooklm source add "https://www.etoro.com/en-us/"
notebooklm source add "https://www.etoro.com/en-us/trading/copytrader/"
notebooklm source add "https://www.etoro.com/en-us/trading/fees/"
notebooklm source add "https://commonstock.com/"
notebooklm source add "https://stocktwits.com/"
```

### TIER 5 — Robo-Advisors

```bash
notebooklm source add "https://www.betterment.com/"
notebooklm source add "https://www.betterment.com/pricing"
notebooklm source add "https://www.wealthfront.com/"
notebooklm source add "https://www.acorns.com/"
notebooklm source add "https://www.acorns.com/pricing/"
notebooklm source add "https://www.stash.com/"
notebooklm source add "https://www.stash.com/pricing"
```

### TIER 6 — International Competitors

```bash
notebooklm source add "https://www.revolut.com/en-US/products/invest/"
notebooklm source add "https://www.trading212.com/"
notebooklm source add "https://www.trading212.com/trading-conditions"
notebooklm source add "https://freetrade.io/"
notebooklm source add "https://freetrade.io/pricing"
notebooklm source add "https://www.stake.com/"
```

### TIER 7 — Options & Flow Specialists

```bash
notebooklm source add "https://unusualwhales.com/"
notebooklm source add "https://unusualwhales.com/pricing"
notebooklm source add "https://marketchameleon.com/"
notebooklm source add "https://tradier.com/"
```

### TIER 8 — Research & Data Platforms

```bash
notebooklm source add "https://finviz.com/"
notebooklm source add "https://finviz.com/elite.ashx"
notebooklm source add "https://www.barchart.com/"
notebooklm source add "https://www.barchart.com/solutions/premier"
notebooklm source add "https://simplywall.st/"
notebooklm source add "https://simplywall.st/pricing"
notebooklm source add "https://stockanalysis.com/"
notebooklm source add "https://pro.benzinga.com/"
```

---

## STEP 4 — WEB RESEARCH QUERIES

```bash
# FIX #10: Use --mode deep for broad multi-competitor research topics.
# FIX #13: All --mode deep queries now use --no-wait so they fire in parallel
#           instead of blocking serially for 8–20 min total.
#           A single `research wait` at the end blocks once for all of them.

# Broad queries (deep coverage needed) — fire all non-blocking
notebooklm source add-research "best AI stock trading platforms comparison 2026" --mode deep --no-wait
notebooklm source add-research "retail brokerage platform feature comparison 2026" --mode deep --no-wait
notebooklm source add-research "paper trading platforms comparison real-time data quality" --mode deep --no-wait
notebooklm source add-research "AI trading signal tools accuracy independent review" --mode deep --no-wait

# Narrower queries (fast mode is sufficient; fire inline)
notebooklm source add-research "fractional shares brokerage comparison 2026" --mode fast
notebooklm source add-research "zero commission trading Robinhood Webull moomoo comparison" --mode fast
notebooklm source add-research "robo advisor comparison Betterment Wealthfront M1 2026" --mode fast
notebooklm source add-research "no-code algorithmic trading Composer QuantConnect comparison" --mode fast
notebooklm source add-research "options trading platform thinkorswim tastytrade best features" --mode fast
notebooklm source add-research "social copy trading eToro Stocktwits comparison 2026" --mode fast

# Wait for all deep research jobs to finish and import their sources
# (single blocking call; timeout 1800s = 30 min max)
notebooklm research wait --import-all --timeout 1800
```

---

## STEP 5 — POLL UNTIL ALL SOURCES ARE READY

```bash
# FIX #6: Single check is not enough for 100+ sources. Use a polling loop.
# Run this script — it polls every 30 seconds until all sources are READY or ERROR.

python3 << 'EOF'
import subprocess, json, time, sys

print("Polling source status — waiting for all to reach READY...")
while True:
    result = subprocess.run(
        ["notebooklm", "source", "list", "--json"],
        capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
        # Handle both {"sources":[...]} and bare list
        sources = data.get("sources", data) if isinstance(data, dict) else data
    except json.JSONDecodeError:
        print("Could not parse JSON — retrying in 30s")
        time.sleep(30)
        continue

    total = len(sources)
    ready = sum(1 for s in sources if s.get("status") == "READY")
    errors = [s.get("title", s.get("id", "?")) for s in sources if s.get("status") == "ERROR"]
    processing = total - ready - len(errors)

    print(f"  {ready}/{total} READY | {processing} processing | {len(errors)} errors")

    if errors:
        print(f"  ERROR sources: {errors}")

    if ready + len(errors) == total:
        print("All sources settled. Proceeding.")
        if errors:
            print(f"WARNING: {len(errors)} sources failed. Re-add them manually if needed.")
        break

    time.sleep(30)
EOF
```

---

## STEP 6 — ASK STRUCTURED RESEARCH QUESTIONS

> **NOTE (FIX #15 — corrected):** Per the notebooklm-py v0.3.4 skill autonomy rules,
> `ask "..." --save-as-note` is in the **"Ask Before Running"** category. Claude Code
> **will prompt for confirmation** before each call — it does not auto-save silently.
> To avoid 20+ confirmation prompts: remove `--save-as-note` from the bulk questions below
> and add it only to the 3–5 answers you specifically want persisted as notes.
> The flag is kept on every command here for completeness; accept or skip each prompt as needed.
>
> Run each `ask` one at a time in sequence. The notebook must be in context (`notebooklm status`).

```bash
# === MY PRODUCT AUDIT ===

notebooklm ask "Based only on the NextGen AI Trading sources, what is the core value proposition and intended target user? What trust signals are visible or absent on the public landing page? Separate verified facts from inference." --save-as-note

notebooklm ask "What features does NextGen AI Trading publicly demonstrate? List only what is confirmed from the indexed sources. Mark anything not confirmed as NOT VERIFIED." --save-as-note

notebooklm ask "Compare the first-impression UX of NextGen AI Trading against Robinhood, Webull, and Public based on sources. Where does NextGen fall short on clarity, trust signals, and onboarding?" --save-as-note


# === FEATURE MAPPING ===

notebooklm ask "Create a structured feature comparison covering all 50 competitors: stocks, ETFs, options, crypto, fractional shares, paper trading, robo-investing, AI features, backtesting, social/copy trading, mobile app, web app, commissions. Format as one competitor per row." --save-as-note

notebooklm ask "Which competitors offer genuine AI-powered trading signals, automated picks, or AI-driven trade execution? For each, describe what the AI actually does — is it real AI or marketing language? Cite the source for each claim." --save-as-note

notebooklm ask "Which competitors offer paper trading or demo modes? For each: does it use real-time data, real order types, portfolio analytics, and performance tracking? Note any limitations." --save-as-note

notebooklm ask "Which competitors offer backtesting? For each: is it visual, code-based, or natural language driven? What are the data range limitations and accuracy caveats?" --save-as-note

notebooklm ask "Map pricing models across all 50 competitors: free tiers, subscription costs, commission structures, margin rates, premium data fees, payment for order flow practices." --save-as-note


# === TRUST & COMPLIANCE ===

notebooklm ask "Which competitors most prominently display SIPC coverage, FINRA registration, SEC disclosure, or data security claims on their public pages? Rank the top 10 by trust signal visibility." --save-as-note

notebooklm ask "What risk disclaimer and compliance language do competitors use on their homepages? What does NextGen AI Trading currently show versus what regulated brokerages show?" --save-as-note


# === UX & ONBOARDING ===

notebooklm ask "Describe the signup and onboarding flow for Robinhood, Webull, Public, moomoo, and SoFi. What is the estimated time-to-first-trade? What friction points exist? How does NextGen AI Trading compare?" --save-as-note

notebooklm ask "Which competitors have the clearest homepage value proposition — understood by a newcomer in under 10 seconds? Which are most confusing? Where does NextGen AI Trading rank?" --save-as-note


# === GAP ANALYSIS ===

notebooklm ask "What features are all major competitors offering that NextGen AI Trading appears to be missing entirely or has not publicly demonstrated?" --save-as-note

notebooklm ask "Where are incumbents like thinkorswim, Interactive Brokers, Fidelity, and E*TRADE overbuilt and creating user frustration? What complaints appear most frequently in the indexed sources?" --save-as-note

notebooklm ask "Where is the biggest gap between AI trading marketing claims and actual AI capabilities across competitors? Where is there a clear opportunity for a product that delivers AI trading more honestly and usefully?" --save-as-note


# === STRATEGIC POSITIONING ===

notebooklm ask "Which of the 50 competitors are the most direct threats to NextGen AI Trading? Which are only indirect benchmarks? Rate each High / Medium / Low threat and explain your reasoning." --save-as-note

notebooklm ask "If NextGen AI Trading had to pick ONE clear positioning wedge — one specific problem no incumbent solves well — what would it be based on all evidence in this notebook?" --save-as-note

notebooklm ask "What niche would give NextGen AI Trading the best chance of winning in year one? Consider: beginner AI trading assistant, paper trading with AI coaching, quant tools for retail, AI research without brokerage, social AI signals." --save-as-note


# === SCORING ===

notebooklm ask "Score NextGen AI Trading and each of the 50 competitors on a 1–5 scale for all 15 dimensions below. For each score: one-line reason + cite the source. Dimensions: (1) Beginner friendliness (2) Trust/credibility (3) Clarity of value proposition (4) Ease of buying stocks (5) Research quality (6) Paper trading support (7) Automation/robo support (8) AI differentiation (9) UX polish (10) Mobile readiness (11) Web experience (12) Monetization clarity (13) Feature depth (14) Speed to first value (15) Power-user appeal" --save-as-note


# === RECOMMENDATIONS ===

notebooklm ask "List the top 10 highest-impact product improvements for NextGen AI Trading ranked by expected impact on user acquisition, homepage conversion, and post-login retention. Cite competitor evidence for each." --save-as-note

notebooklm ask "List the top 5 trust and conversion improvements NextGen AI Trading should make to its website immediately — low implementation cost but clearly costing conversions versus competitors." --save-as-note

notebooklm ask "List the top 5 features to build next for NextGen AI Trading based on competitor gaps. For each: describe it, name which competitor does it best, explain NextGen's differentiation angle, estimate implementation complexity." --save-as-note

notebooklm ask "List the top 3 monetization models that fit NextGen AI Trading based on competitor pricing patterns. For each: what to charge for, what to keep free, expected ARPU range, and which competitor precedent supports it." --save-as-note

notebooklm ask "Write a 'Why choose NextGen AI Trading instead of Robinhood / Webull / Public' section for the website. Make it honest, specific, and based only on verifiable differentiators from the indexed sources." --save-as-note

notebooklm ask "Rewrite the NextGen AI Trading homepage headline, subheadline, and CTA button text. Provide 3 alternatives: (1) beginner-friendly angle (2) AI-differentiated angle (3) power-user angle. Base each on the gap analysis from sources." --save-as-note
```

---

## STEP 7 — GENERATE ALL ARTIFACTS

> Pattern for every async artifact:
> 1. Fire the generate command → it returns a task ID immediately
> 2. Capture the task ID: `ARTIFACT_ID=$(notebooklm artifact list --json | python3 -c "...")`
> 3. Wait: `notebooklm artifact wait $ARTIFACT_ID`
> 4. Download with `-a $ARTIFACT_ID` flag to target the right artifact
>
> For audio/video (10–30 min), use the subagent pattern so Claude Code doesn't block.

```bash
mkdir -p ./nextgen-competitor-research

# ============================================================
# MIND MAP — SYNCHRONOUS, runs instantly, no artifact wait
# ============================================================
notebooklm generate mind-map
notebooklm download mind-map ./nextgen-competitor-research/feature-positioning-mindmap.json


# ============================================================
# DATA TABLE → CSV
# FIX #11: Capture task_id directly from generate --json output.
# Do NOT use artifact list + filter on 'kind' — that field doesn't exist;
# the schema uses 'type'. Direct capture from generate --json is safer and unambiguous.
# ============================================================
DATA_TABLE_ID=$(notebooklm generate data-table "Comparison table of all 50 competitors. Columns: Company, URL, Target User, Stocks, ETFs, Options, Crypto, Fractional Shares, Paper Trading, Auto Investing, AI Features, Backtesting, Social Features, Mobile App Quality, Web App Quality, Pricing Model, Commission Structure, Trust Signals, Key Strength, Key Weakness, Threat Level to NextGen (High/Medium/Low), Notes" --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Data table task ID: $DATA_TABLE_ID"
notebooklm artifact wait $DATA_TABLE_ID
notebooklm download data-table ./nextgen-competitor-research/competitor-matrix.csv -a $DATA_TABLE_ID


# ============================================================
# BRIEFING DOC REPORT
# FIX #5: use --format + --append, not a bare positional string.
# FIX #11: capture task_id from generate --json directly.
# ============================================================
BRIEFING_ID=$(notebooklm generate report --format briefing-doc --append "Focus on NextGen AI Trading's position vs all 50 competitors. Include gap analysis, threat assessment, and top strategic recommendations." --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Briefing task ID: $BRIEFING_ID"
notebooklm artifact wait $BRIEFING_ID
notebooklm download report ./nextgen-competitor-research/competitor-briefing.md -a $BRIEFING_ID


# ============================================================
# STUDY GUIDE REPORT
# FIX #11: capture task_id from generate --json directly.
# ============================================================
STUDY_ID=$(notebooklm generate report --format study-guide --append "Structure as: competitor landscape overview, feature comparison by category, positioning analysis, and action items." --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Study guide task ID: $STUDY_ID"
notebooklm artifact wait $STUDY_ID
notebooklm download report ./nextgen-competitor-research/competitor-study-guide.md -a $STUDY_ID


# ============================================================
# INFOGRAPHIC
# FIX #11: capture task_id from generate --json directly.
# ============================================================
INFOGRAPHIC_ID=$(notebooklm generate infographic --orientation landscape --detail detailed --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Infographic task ID: $INFOGRAPHIC_ID"
notebooklm artifact wait $INFOGRAPHIC_ID
notebooklm download infographic ./nextgen-competitor-research/competitor-landscape-infographic.png -a $INFOGRAPHIC_ID


# ============================================================
# SLIDE DECK — PDF then PPTX
# FIX #3: second download uses --format pptx (not default PDF).
# FIX #11: capture task_id from generate --json directly.
# ============================================================
SLIDES_ID=$(notebooklm generate slide-deck --format presenter --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Slide deck task ID: $SLIDES_ID"
notebooklm artifact wait $SLIDES_ID
notebooklm download slide-deck ./nextgen-competitor-research/competitor-analysis-slides.pdf -a $SLIDES_ID
notebooklm download slide-deck ./nextgen-competitor-research/competitor-analysis-slides.pptx -a $SLIDES_ID --format pptx


# ============================================================
# AUDIO BRIEF
# FIX #11: capture task_id from generate --json directly.
# FIX #14: subagent pattern is now explicit — actual wait + download commands provided,
#          not just described in a comment.
# Audio takes 10–20 min. In Claude Code, spawn this as a parallel Task so the main
# session is not blocked. The two commands to run in that task are:
# ============================================================
AUDIO_ID=$(notebooklm generate audio "10-minute executive briefing: NextGen AI Trading vs 50 competitors — biggest gaps, threat levels, and top 5 strategic moves" --format brief --json | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])")
echo "Audio task ID: $AUDIO_ID"

# Run these two commands in a new Claude Code Task (or paste into terminal after ~15 min):
#   notebooklm artifact wait $AUDIO_ID --timeout 1800
#   notebooklm download audio ./nextgen-competitor-research/competitor-briefing-audio.mp3 -a $AUDIO_ID
#
# Claude Code subagent invocation (if supported in your session):
#   Task(
#     prompt=f"Wait for audio artifact {AUDIO_ID} to complete, then download it.\n"
#             "Run: notebooklm artifact wait {AUDIO_ID} --timeout 1800\n"
#             "Then: notebooklm download audio ./nextgen-competitor-research/competitor-briefing-audio.mp3 -a {AUDIO_ID}",
#     subagent_type="general-purpose"
#   )
echo "Audio is generating (~15 min). See the two commands above — run them when ready."
```

---

## STEP 8 — EXPORT NOTEBOOK METADATA

```bash
# FIX: notebooklm metadata --json IS a real v0.3.4 command (added in that release)
# Use it for a full notebook summary including sources list
notebooklm metadata --json > ./nextgen-competitor-research/notebook-metadata.json

# Also export the detailed source list separately
notebooklm source list --json > ./nextgen-competitor-research/sources.json

# Export artifact inventory
notebooklm artifact list --json > ./nextgen-competitor-research/artifacts.json
```

---

## STEP 9 — WRITE THE FOUR DELIVERABLE FILES

Pull all content from the notebook notes saved in Step 6 and the downloaded artifacts.
**Do not fabricate — use only what the notebook answers returned.**
Mark any competitor feature as "Not verified" if sources did not confirm it.

### A. `./nextgen-competitor-research/competitor-analysis.md`

```markdown
# NextGen AI Trading — Competitor Analysis 2026

## Executive Summary
[From briefing-doc report download]

## Methodology
- 50 competitors researched via notebooklm-py v0.3.4
- Sources: official competitor URLs + 10 web research queries
- Date: April 2026
- Verification policy: official pages preferred; third-party labeled secondary;
  unverifiable claims labeled NOT VERIFIED

## My Product Audit — NextGen AI Trading
[From first 3 ask questions in Step 6]

## Competitor Profiles — All 50
[One section per competitor, from feature mapping answers]

## Full Feature Matrix
[From competitor-matrix.csv, rendered as markdown table]

## Positioning Analysis
[From wedge + niche questions]

## UX & Onboarding Findings
[From UX questions]

## Trust & Compliance Findings
[From trust questions]

## Scoring Matrix (1–5 on 15 dimensions)
[From scoring question — all 50 competitors]

## Gap Analysis
[From gap questions]

## Threat Assessment
[High / Medium / Low per competitor with reasoning]

## Strategic Recommendations
### Top 10 Product Improvements
### Top 5 Trust/Conversion Website Improvements
### Top 5 Features to Build Next
### Top 3 Monetization Options

## Homepage Copy Recommendations
[3 headline/subheadline/CTA variants from final ask]

## Why Choose NextGen vs Robinhood / Webull / Public
[From specific question in Step 6]

## Final Verdict
[One paragraph: where NextGen can realistically differentiate in 12 months]

## Complete Source List
[Every URL added to the notebook]
```

### B. `./nextgen-competitor-research/competitor-matrix.csv`

Use the downloaded file from Step 7. Verify all 50 rows are present before saving.

Required columns:
```
Company, URL, Target User, Stocks, ETFs, Options, Crypto, Fractional Shares, Paper Trading,
Auto Investing, AI Features, Backtesting, Social Features, Mobile App, Web App, Pricing,
Trust Signals, Key Advantage, Key Weakness, Threat Level to NextGen, Notes, Source URLs
```

### C. `./nextgen-competitor-research/nextgen-prioritized-roadmap.md`

```markdown
# NextGen AI Trading — Prioritized Product Roadmap

## Quick Wins (0–2 weeks)
[From top 5 trust/conversion improvements]

## Medium Improvements (30 days)
[From top 5 features to build — early items]

## Bigger Bets (90 days)
[AI differentiation, backtesting, social signals, wedge feature]

## Why Each Item Matters
[Cite competitor evidence per item]

## Expected Impact
[Conversion / retention / differentiation estimate per item]
```

### D. `./nextgen-competitor-research/positioning-summary.md`

```markdown
# NextGen AI Trading — Positioning Summary

## One-Sentence Positioning Statement
## Ideal Customer Profile
## Category Definition
## Main Wedge Against Incumbents
## Homepage Messaging Recommendations
  - 3 headline options
  - 3 subheadline options
  - 3 CTA options
  - Social proof suggestions
  - Trust signal placement
## Pricing Page Recommendations
## Trust Page Recommendations
## "Why Not Robinhood / Webull / Public" Section
```

---

## VERIFICATION CHECKLIST

- [ ] `notebooklm list --json` parsed as `data["notebooks"]` not bare array (Fix #1)
- [ ] Notebook ID matched by title substring not `[0]` index (Fix #7)
- [ ] All artifacts downloaded with `-a $ARTIFACT_ID` flag after `artifact wait` (Fix #2)
- [ ] Slide deck downloaded twice: once as PDF, once with `--format pptx` (Fix #3)
- [ ] `notebooklm agent show claude` ran at install (Fix #4)
- [ ] `generate report` used `--format briefing-doc --append "..."` not positional string (Fix #5)
- [ ] Source polling loop ran until all sources READY, not a single check (Fix #6)
- [ ] Notebook ID found by title match not hardcoded index (Fix #7)
- [ ] Artifact generation legend reviewed before Step 7 (Fix #8)
- [ ] `--save-as-note` confirmation prompts acknowledged — 20+ prompts expected (Fix #9 / #15)
- [ ] Broad research queries used `--mode deep --no-wait`; narrow ones used `--mode fast` (Fix #10 / #13)
- [ ] All artifact IDs captured via `generate --json | python3 -c "...task_id..."` — not `artifact list` with `'kind'` filter (Fix #11)
- [ ] `notebooklm metadata --json` used in Step 8 (confirmed real v0.3.4 command; Fix #12 reversed)
- [ ] `research wait --import-all --timeout 1800` called after all `--no-wait` deep queries (Fix #13)
- [ ] Audio wait + download commands are explicit (not just a comment); subagent or manual run planned (Fix #14)
- [ ] `competitor-matrix.csv` has all 50 rows with no fabricated data
- [ ] All 4 markdown deliverables written to `./nextgen-competitor-research/`
- [ ] Items marked "Not verified" where sources were blocked or unavailable
- [ ] No inflated claims about NextGen AI Trading current capabilities

---

## THE 50 COMPETITORS — QUICK REFERENCE

| # | Competitor | Category | URL |
|---|-----------|----------|-----|
| 1 | Robinhood | Retail Brokerage | robinhood.com |
| 2 | Fidelity | Retail Brokerage | fidelity.com |
| 3 | Charles Schwab | Retail Brokerage | schwab.com |
| 4 | thinkorswim | Pro Platform | schwab.com/thinkorswim |
| 5 | E*TRADE | Retail Brokerage | etrade.com |
| 6 | Power E*TRADE | Pro Platform | etrade.com/power-etrade |
| 7 | Webull | Retail Brokerage | webull.com |
| 8 | Interactive Brokers | Pro Brokerage | interactivebrokers.com |
| 9 | Vanguard | Retail Brokerage | vanguard.com |
| 10 | Merrill Edge | Retail Brokerage | merrilledge.com |
| 11 | SoFi Invest | Neobank Brokerage | sofi.com/invest |
| 12 | Public | Social Brokerage | public.com |
| 13 | M1 Finance | Automated Investing | m1.com |
| 14 | Ally Invest | Retail Brokerage | ally.com/invest |
| 15 | moomoo | Retail Brokerage | moomoo.com |
| 16 | tastytrade | Options Specialist | tastytrade.com |
| 17 | Firstrade | Retail Brokerage | firstrade.com |
| 18 | Trade Ideas | AI Scanner | trade-ideas.com |
| 19 | TrendSpider | AI Technical Analysis | trendspider.com |
| 20 | Tickeron | AI Signals | tickeron.com |
| 21 | Danelfin | AI Stock Picking | danelfin.com |
| 22 | Kavout | AI Ratings | kavout.com |
| 23 | Alpaca | API Brokerage | alpaca.markets |
| 24 | QuantConnect | Algo Backtesting | quantconnect.com |
| 25 | Composer | No-Code Algo | composer.trade |
| 26 | Streak | Algo Trading | streak.tech |
| 27 | SignalStack | Signal Automation | signalstack.com |
| 28 | Investopedia Simulator | Paper Trading | investopedia.com/simulator |
| 29 | MarketWatch VSE | Paper Trading | marketwatch.com/games |
| 30 | TradeStation | Pro + Paper Trading | tradestation.com |
| 31 | NinjaTrader | Futures + Paper | ninjatrader.com |
| 32 | eToro | Social Copy Trading | etoro.com |
| 33 | Commonstock | Social Research | commonstock.com |
| 34 | Stocktwits | Social Finance | stocktwits.com |
| 35 | Betterment | Robo-Advisor | betterment.com |
| 36 | Wealthfront | Robo-Advisor | wealthfront.com |
| 37 | Acorns | Micro-Investing | acorns.com |
| 38 | Stash | Micro-Investing | stash.com |
| 39 | Revolut Invest | Neobank Global | revolut.com |
| 40 | Trading 212 | EU Retail | trading212.com |
| 41 | Freetrade | UK Zero-Commission | freetrade.io |
| 42 | Stake | AU/UK Retail | stake.com |
| 43 | Unusual Whales | Options Flow / AI | unusualwhales.com |
| 44 | Market Chameleon | Options Research | marketchameleon.com |
| 45 | Tradier | API Brokerage | tradier.com |
| 46 | Finviz | Stock Screener | finviz.com |
| 47 | Barchart | Market Data + Signals | barchart.com |
| 48 | Simply Wall St | AI Visual Research | simplywall.st |
| 49 | Stock Analysis | Research Data | stockanalysis.com |
| 50 | Benzinga Pro | News + Signals | pro.benzinga.com |

---

## ALL 15 BUG FIXES — SUMMARY

| # | Bug | Fix Applied |
|---|-----|-------------|
| 1 | `list --json` parsed as bare array | Parsed as `data["notebooks"]` dict key |
| 2 | Downloads ran against incomplete artifacts | Every download preceded by `artifact wait $ID` |
| 3 | Both slide downloads produced PDF | Second download uses `--format pptx` flag |
| 4 | `agent show claude` claimed not to exist | Confirmed real in official README; kept |
| 5 | Positional string arg on `generate report` | Replaced with `--format <tmpl> --append "<text>"` |
| 6 | Source polling was a single check | Python polling loop, 30s interval, exits when all settled |
| 7 | `nbs[0]` picked wrong notebook | Filters by title substring before falling back to index 0 |
| 8 | No sync/async legend | Artifact generation legend table added at top of file |
| 9 | `--save-as-note` said to skip confirmation | Corrected by Fix #15 below |
| 10 | `--mode fast` used for broad research | Broad queries use `--mode deep`; narrow use `--mode fast` |
| 11 | `a.get('kind','')` — field doesn't exist | Replaced with direct `generate --json \| python3 task_id` capture; schema field is `'type'` not `'kind'` |
| 12 | `notebooklm metadata --json` said not to exist | Confirmed it IS a real v0.3.4 command (added in that release); kept in Step 8 |
| 13 | 4 deep queries blocked serially 8–20 min | Added `--no-wait` to each; single `research wait --import-all --timeout 1800` waits once |
| 14 | Audio subagent only described in comment | Explicit `artifact wait` + `download` commands now present; subagent Task template included |
| 15 | FIX #9 comment wrong about confirmation | Corrected: `--save-as-note` IS in "Ask Before Running" per skill docs; 20+ prompts will appear |