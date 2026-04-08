# Morning Brief Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/morning-brief` page (and sidebar link) that shows a live watchlist TA table — Asset, Bias, Price vs EMA 200, RSI, MACD, Signal — for BTC, ETH, SOL, XRP, LINK, PEPE, refreshed on demand with a 1-hour server-side cache.

**Architecture:** A new FastAPI endpoint `GET /api/v1/morning-brief` computes EMA-200, RSI-14, and MACD from yfinance daily OHLCV data (via the existing `load_ohlcv` service) for the fixed crypto watchlist, derives Bias/Signal labels, and returns structured JSON. The frontend page fetches this with TanStack Query and renders a shadcn/ui table with a manual refresh button. The endpoint is registered in `main.py` and the route is protected in `proxy.ts`.

**Tech Stack:** FastAPI · pandas · yfinance (via `load_ohlcv`) · Next.js 14 App Router · TypeScript · TanStack Query · shadcn/ui (Table, Badge, Card, Skeleton) · Tailwind · AppShell

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/app/api/morning_brief.py` | Create | Endpoint + TA computation for all 6 symbols |
| `backend/app/main.py` | Modify | Register morning-brief router |
| `frontend/types/index.ts` | Modify | Add `MorningBriefRow`, `MorningBriefResponse` types |
| `frontend/lib/api.ts` | Modify | Add `morningBriefApi.fetch()` |
| `frontend/app/morning-brief/page.tsx` | Create | Protected page with table + refresh |
| `frontend/components/dashboard/MorningBriefTable.tsx` | Create | Reusable table component |
| `frontend/proxy.ts` | Modify | Add `/morning-brief` to `PROTECTED_PREFIXES` |
| `frontend/components/layout/Sidebar.tsx` | Modify | Add Morning Brief nav link |

---

## Task 1: Backend — morning_brief endpoint

**Files:**
- Create: `backend/app/api/morning_brief.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_morning_brief.py
import pytest
from httpx import AsyncClient

SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "LINKUSDT", "PEPEUSDT"]

@pytest.mark.asyncio
async def test_morning_brief_returns_all_symbols(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/morning-brief", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "rows" in data
    assert len(data["rows"]) == 6
    symbols_returned = [r["symbol"] for r in data["rows"]]
    for s in SYMBOLS:
        assert s in symbols_returned

@pytest.mark.asyncio
async def test_morning_brief_row_fields(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/morning-brief", headers=auth_headers)
    row = resp.json()["rows"][0]
    for field in ["symbol", "name", "price", "ema200", "price_vs_ema200", "rsi", "macd_bias", "bias", "signal"]:
        assert field in row
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && pytest tests/test_morning_brief.py -v
```
Expected: FAIL with `404` or import error — endpoint doesn't exist yet.

- [ ] **Step 3: Create `backend/app/api/morning_brief.py`**

```python
"""
Morning Brief endpoint — daily crypto watchlist TA snapshot.

Returns EMA-200, RSI-14, MACD bias, and a plain-English signal for
the fixed watchlist: BTC, ETH, SOL, XRP, LINK, PEPE.

Cache: in-process dict keyed to the UTC hour — refreshes at most once
per hour without requiring Redis.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.market_data import load_ohlcv

router = APIRouter(prefix="/api/v1/morning-brief", tags=["morning-brief"])

# ── Watchlist ─────────────────────────────────────────────────────────────────
WATCHLIST = [
    {"symbol": "BTCUSDT", "name": "Bitcoin",   "yf": "BTC-USD"},
    {"symbol": "ETHUSDT", "name": "Ethereum",  "yf": "ETH-USD"},
    {"symbol": "SOLUSDT", "name": "Solana",    "yf": "SOL-USD"},
    {"symbol": "XRPUSDT", "name": "XRP",       "yf": "XRP-USD"},
    {"symbol": "LINKUSDT","name": "Chainlink", "yf": "LINK-USD"},
    {"symbol": "PEPEUSDT","name": "PEPE",      "yf": "PEPE-USD"},
]

# ── Pydantic models ───────────────────────────────────────────────────────────
class MorningBriefRow(BaseModel):
    symbol: str
    name: str
    price: float | None
    ema200: float | None
    price_vs_ema200: str          # "Above" | "Below" | "Near"
    rsi: float | None
    macd_bias: str                # "Bullish" | "Bearish" | "Flat"
    bias: str                     # "Bullish" | "Bearish" | "Neutral"
    signal: str                   # plain-English 1-liner

class MorningBriefResponse(BaseModel):
    rows: list[MorningBriefRow]
    analyzed_at: str
    timeframe: str = "1D"

# ── Cache: one slot per UTC-hour ──────────────────────────────────────────────
_cache: dict[str, Any] = {}

def _cache_key() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H")

# ── TA helpers ────────────────────────────────────────────────────────────────
def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()

def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain  = delta.clip(lower=0)
    loss  = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, adjust=False).mean()
    avg_loss = loss.ewm(com=period - 1, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))

def _macd(series: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Returns (macd_line, signal_line) using standard 12/26/9 params."""
    ema12  = _ema(series, 12)
    ema26  = _ema(series, 26)
    macd   = ema12 - ema26
    signal = _ema(macd, 9)
    return macd, signal

def _analyse(entry: dict) -> MorningBriefRow:
    symbol = entry["symbol"]
    name   = entry["name"]
    yf_sym = entry["yf"]

    try:
        # load_ohlcv uses yfinance with 750-row cap and normalize_symbol
        df = load_ohlcv(yf_sym, interval="1d", period="800d")
        if df is None or len(df) < 30:
            raise ValueError("insufficient data")

        close = df["close"].astype(float)
        price = float(close.iloc[-1])

        ema200_series = _ema(close, 200)
        ema200 = float(ema200_series.iloc[-1])

        rsi_series = _rsi(close)
        rsi_val = float(rsi_series.iloc[-1])

        macd_line, macd_signal = _macd(close)
        macd_last   = float(macd_line.iloc[-1])
        signal_last = float(macd_signal.iloc[-1])

        # ── Price vs EMA-200 ──────────────────────────────────────────────────
        pct = (price - ema200) / ema200 * 100
        if pct > 2:
            pve = "Above"
        elif pct < -2:
            pve = "Below"
        else:
            pve = "Near"

        # ── MACD bias ─────────────────────────────────────────────────────────
        if macd_last > signal_last and macd_last > 0:
            macd_bias = "Bullish"
        elif macd_last < signal_last and macd_last < 0:
            macd_bias = "Bearish"
        elif macd_last > signal_last:
            macd_bias = "Bullish"  # cross above signal even in negative territory
        else:
            macd_bias = "Bearish"

        # ── Overall Bias ─────────────────────────────────────────────────────
        bullish_count = sum([
            pve == "Above",
            rsi_val > 50,
            macd_bias == "Bullish",
        ])
        if bullish_count >= 2 and pve != "Below":
            bias = "Bullish"
        elif bullish_count <= 1 and pve == "Below":
            bias = "Bearish"
        else:
            bias = "Neutral"

        # ── Signal ───────────────────────────────────────────────────────────
        if bias == "Bullish" and rsi_val > 70:
            signal = "Extended, avoid chasing"
        elif bias == "Bullish" and macd_bias == "Bullish":
            signal = "Trend intact, buy dips only"
        elif bias == "Bullish":
            signal = "Momentum improving"
        elif bias == "Bearish" and rsi_val < 32:
            signal = "Oversold, watch for bounce"
        elif bias == "Bearish" and macd_bias == "Bearish":
            signal = "Bearish structure remains"
        elif bias == "Bearish":
            signal = "Weak momentum, wait"
        else:
            signal = "Near EMA 200, decision zone"

        return MorningBriefRow(
            symbol=symbol, name=name,
            price=round(price, 6),
            ema200=round(ema200, 6),
            price_vs_ema200=pve,
            rsi=round(rsi_val, 1),
            macd_bias=macd_bias,
            bias=bias,
            signal=signal,
        )

    except Exception:
        return MorningBriefRow(
            symbol=symbol, name=name,
            price=None, ema200=None,
            price_vs_ema200="N/A",
            rsi=None, macd_bias="N/A",
            bias="N/A", signal="Data unavailable",
        )

# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.get("", response_model=MorningBriefResponse)
async def get_morning_brief(
    _: User = Depends(get_current_user),
) -> MorningBriefResponse:
    key = _cache_key()
    if key in _cache:
        return _cache[key]

    rows = [_analyse(entry) for entry in WATCHLIST]
    result = MorningBriefResponse(
        rows=rows,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        timeframe="1D",
    )
    _cache.clear()          # evict old hour
    _cache[key] = result
    return result
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && pytest tests/test_morning_brief.py -v
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/morning_brief.py tests/test_morning_brief.py
git commit -m "feat: add /api/v1/morning-brief endpoint with hourly TA cache"
```

---

## Task 2: Register router in main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add import after the `# v3 routers` block (~line 231)**

In `backend/app/main.py`, find this line:
```python
from app.api.news_feed import router as news_feed_router
```
Add immediately after it:
```python
from app.api.morning_brief import router as morning_brief_router
```

- [ ] **Step 2: Register the router after `app.include_router(news_feed_router)`**

Find:
```python
app.include_router(news_feed_router)
```
Add immediately after:
```python
app.include_router(morning_brief_router)
```

- [ ] **Step 3: Smoke-test the endpoint**

```bash
cd backend && uvicorn app.main:app --reload &
curl -s http://localhost:8000/api/v1/morning-brief \
  -H "Authorization: Bearer <dev_token>" | python -m json.tool | head -30
```
Expected: JSON with `rows` array of 6 items.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register morning-brief router in main.py"
```

---

## Task 3: Frontend types

**Files:**
- Modify: `frontend/types/index.ts`

- [ ] **Step 1: Append types to the end of `frontend/types/index.ts`**

```typescript
// ── Morning Brief ─────────────────────────────────────────────────────────────
export interface MorningBriefRow {
  symbol: string;
  name: string;
  price: number | null;
  ema200: number | null;
  price_vs_ema200: "Above" | "Below" | "Near" | "N/A";
  rsi: number | null;
  macd_bias: "Bullish" | "Bearish" | "Flat" | "N/A";
  bias: "Bullish" | "Bearish" | "Neutral" | "N/A";
  signal: string;
}

export interface MorningBriefResponse {
  rows: MorningBriefRow[];
  analyzed_at: string;
  timeframe: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors on the new types.

- [ ] **Step 3: Commit**

```bash
git add frontend/types/index.ts
git commit -m "feat: add MorningBriefRow and MorningBriefResponse types"
```

---

## Task 4: Frontend API wrapper

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add import at the top of lib/api.ts (with other type imports)**

In `frontend/lib/api.ts`, find the import block that ends with:
```typescript
  TopMoverRow,
} from "@/types";
```
Change to:
```typescript
  TopMoverRow,
  MorningBriefResponse,
} from "@/types";
```

- [ ] **Step 2: Add `morningBriefApi` export at the end of `frontend/lib/api.ts`**

Find the last exported object in the file and add after it:
```typescript
// ── Morning Brief ─────────────────────────────────────────────────────────────
export const morningBriefApi = {
  fetch: (): Promise<MorningBriefResponse> =>
    apiFetch<MorningBriefResponse>("/api/v1/morning-brief"),
};
```

> Note: `apiFetch` is the existing low-level fetch wrapper already defined in `lib/api.ts`. Use the same name it has in the file — search for `function apiFetch` or `const apiFetch` to confirm the exact name used.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add morningBriefApi.fetch() wrapper"
```

---

## Task 5: MorningBriefTable component

**Files:**
- Create: `frontend/components/dashboard/MorningBriefTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { MorningBriefRow } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────
function BiasBadge({ bias }: { bias: string }) {
  const variant =
    bias === "Bullish"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : bias === "Bearish"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-gray-500/20 text-gray-400 border-gray-500/30";
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${variant}`}>
      {bias}
    </span>
  );
}

function PveCell({ value }: { value: string }) {
  const colour =
    value === "Above"
      ? "text-emerald-400"
      : value === "Below"
      ? "text-red-400"
      : "text-yellow-400";
  return <span className={`font-medium ${colour}`}>{value}</span>;
}

function RsiCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">N/A</span>;
  const colour =
    value >= 70
      ? "text-red-400"
      : value <= 30
      ? "text-emerald-400"
      : "text-foreground";
  return <span className={colour}>{value.toFixed(1)}</span>;
}

function MacdCell({ bias }: { bias: string }) {
  const colour =
    bias === "Bullish"
      ? "text-emerald-400"
      : bias === "Bearish"
      ? "text-red-400"
      : "text-muted-foreground";
  return <span className={colour}>{bias}</span>;
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: 6 }).map((_, j) => (
            <TableCell key={j}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface MorningBriefTableProps {
  rows: MorningBriefRow[] | undefined;
  isLoading: boolean;
}

export function MorningBriefTable({ rows, isLoading }: MorningBriefTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Bias</TableHead>
          <TableHead>Price vs EMA 200</TableHead>
          <TableHead>RSI</TableHead>
          <TableHead>MACD</TableHead>
          <TableHead>Signal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableSkeleton />
        ) : (
          rows?.map((row) => (
            <TableRow key={row.symbol}>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                <div className="text-xs text-muted-foreground">{row.symbol}</div>
              </TableCell>
              <TableCell>
                <BiasBadge bias={row.bias} />
              </TableCell>
              <TableCell>
                <PveCell value={row.price_vs_ema200} />
                {row.price !== null && row.ema200 !== null && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(((row.price - row.ema200) / row.ema200) * 100).toFixed(1)}%
                  </div>
                )}
              </TableCell>
              <TableCell>
                <RsiCell value={row.rsi} />
              </TableCell>
              <TableCell>
                <MacdCell bias={row.macd_bias} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                {row.signal}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/dashboard/MorningBriefTable.tsx
git commit -m "feat: add MorningBriefTable component with skeleton loader"
```

---

## Task 6: Morning Brief page

**Files:**
- Create: `frontend/app/morning-brief/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Clock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MorningBriefTable } from "@/components/dashboard/MorningBriefTable";
import { morningBriefApi } from "@/lib/api";

export default function MorningBriefPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["morning-brief"],
    queryFn: morningBriefApi.fetch,
    staleTime: 60 * 60 * 1000,   // treat as fresh for 1 hour
    refetchOnWindowFocus: false,
  });

  const analyzedAt = data?.analyzed_at
    ? new Date(data.analyzed_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <AppShell title="Morning Brief">
      <div className="flex flex-col gap-6 p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Morning Brief</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Daily crypto watchlist — EMA 200 · RSI · MACD · Signal
            </p>
          </div>
          <div className="flex items-center gap-3">
            {analyzedAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Analyzed {analyzedAt}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Meta */}
        {data && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>Timeframe: <strong className="text-foreground">{data.timeframe} primary</strong></span>
            <span>Exchange: <strong className="text-foreground">BINANCE (yfinance)</strong></span>
            <span>Watchlist: <strong className="text-foreground">BTC · ETH · SOL · XRP · LINK · PEPE</strong></span>
          </div>
        )}

        {/* Table */}
        <Card className="overflow-hidden">
          <MorningBriefTable rows={data?.rows} isLoading={isLoading} />
        </Card>

        {/* Legend */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">Bias Rules</div>
            <p>Bullish = above EMA200 + RSI &gt;50 + MACD bullish. Bearish = opposite. Neutral = mixed signals.</p>
          </div>
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">RSI</div>
            <p>
              <span className="text-emerald-400">Green ≤30</span> oversold ·{" "}
              <span className="text-red-400">Red ≥70</span> overbought · white = neutral
            </p>
          </div>
          <div className="rounded border border-border/40 bg-surface-low p-3">
            <div className="font-medium text-foreground mb-1">Cache</div>
            <p>Results are cached 1 hour server-side. Use Refresh to force a new pull.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/morning-brief/page.tsx
git commit -m "feat: add /morning-brief page with watchlist TA table"
```

---

## Task 7: Protect the route + add sidebar link

**Files:**
- Modify: `frontend/proxy.ts`
- Modify: `frontend/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `/morning-brief` to `PROTECTED_PREFIXES` in `proxy.ts`**

In `frontend/proxy.ts`, find:
```typescript
  "/stock",
];
```
Change to:
```typescript
  "/stock",
  "/morning-brief",
];
```

- [ ] **Step 2: Add Morning Brief link to Sidebar**

In `frontend/components/layout/Sidebar.tsx`, find where nav items are defined (look for an array of objects with `href`, `label`, and an icon — e.g. the `Dashboard` or `Opportunities` entry). Add a new entry in a logical position (near Dashboard or Opportunities):

```typescript
{ href: "/morning-brief", label: "Morning Brief", icon: Sun },
```

Also ensure `Sun` is imported from `lucide-react` at the top of the file. If it's already imported (e.g. for theme toggle), no change needed. If not:
```typescript
import { ..., Sun } from "lucide-react";
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Run the dev server and verify the page loads**

```bash
cd frontend && npm run dev
# Navigate to http://localhost:3000/morning-brief
# Expect: table with 6 rows, skeleton while loading, Refresh button works
```

- [ ] **Step 5: Commit**

```bash
git add frontend/proxy.ts frontend/components/layout/Sidebar.tsx
git commit -m "feat: protect /morning-brief route and add sidebar link"
```

---

## Self-Review

**Spec coverage:**
- ✅ Table columns: Asset, Bias, Price vs EMA 200, RSI, MACD, Signal
- ✅ All 6 symbols: BTC, ETH, SOL, XRP, LINK, PEPE
- ✅ Daily timeframe primary
- ✅ Bias rules (Bullish/Bearish/Neutral logic)
- ✅ Signal plain-English labels
- ✅ Manual refresh button
- ✅ 1-hour server-side cache
- ✅ Protected route (auth required)
- ✅ Sidebar nav link
- ✅ Skeleton loader during fetch

**Placeholders:** None — all code blocks are complete.

**Type consistency:**
- `MorningBriefRow` defined in Task 3 → used in Tasks 4, 5, 6 ✅
- `MorningBriefResponse` defined in Task 3 → used in Task 4, 6 ✅
- `morningBriefApi.fetch` defined in Task 4 → used in Task 6 ✅
- `MorningBriefTable` defined in Task 5 → used in Task 6 ✅
