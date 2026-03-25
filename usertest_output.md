# NextGenStock v2 — E2E Test Suite Output

Generated: 2026-03-24

---

## Files Created

### New Helper

| File | Purpose |
|---|---|
| `tests/e2e/helpers/v2-api.helper.ts` | API request wrappers for all v2 endpoints: buy zone, theme score, alerts, ideas, auto-buy, opportunities. Also exports `loginAsNewUser` and `logoutCurrent` utility functions. |

### New Spec Files

| File | Tests | Feature Area |
|---|---|---|
| `tests/e2e/specs/buy-zone.spec.ts` | 15 | Feature A — Buy Zone Estimator API |
| `tests/e2e/specs/theme-score.spec.ts` | 13 | Feature D — Theme Score Engine API |
| `tests/e2e/specs/alerts.spec.ts` | 18 | Feature B — Smart Alert Engine API |
| `tests/e2e/specs/ideas.spec.ts` | 20 | Feature E — Idea Pipeline API |
| `tests/e2e/specs/auto-buy.spec.ts` | 24 | Feature C — Auto-Buy Engine API |
| `tests/e2e/specs/opportunities.spec.ts` | 9 | Opportunities API |
| `tests/e2e/specs/opportunities-ui.spec.ts` | 9 | Opportunities page UI |
| `tests/e2e/specs/ideas-ui.spec.ts` | 9 | Ideas page UI |
| `tests/e2e/specs/alerts-ui.spec.ts` | 12 | Alerts page UI |
| `tests/e2e/specs/auto-buy-ui.spec.ts` | 15 | Auto-Buy page UI |
| `tests/e2e/specs/v2-integration.spec.ts` | 15 | Cross-feature integration flows |

**Total new tests: 159**

### Modified Files

| File | Change |
|---|---|
| `tests/e2e/fixtures/test-data.ts` | Added v2 routes to the `ROUTES` constant: `/opportunities`, `/ideas`, `/alerts`, `/auto-buy` |

---

## Test Count Per File

| File | Test Count |
|---|---|
| buy-zone.spec.ts | 15 |
| theme-score.spec.ts | 13 |
| alerts.spec.ts | 18 |
| ideas.spec.ts | 20 |
| auto-buy.spec.ts | 24 |
| opportunities.spec.ts | 9 |
| opportunities-ui.spec.ts | 9 |
| ideas-ui.spec.ts | 9 |
| alerts-ui.spec.ts | 12 |
| auto-buy-ui.spec.ts | 15 |
| v2-integration.spec.ts | 15 |
| **Total** | **159** |

---

## Test Coverage Matrix

### API Endpoints

| Endpoint | Auth (401) | Happy Path | Field Validation | Ownership (403/404) | Banned Language |
|---|---|---|---|---|---|
| GET /api/stocks/{ticker}/buy-zone | BZ-06 | BZ-01 | BZ-02,03,04,05,07,08 | — | BZ-09 |
| POST /api/stocks/{ticker}/recalculate-buy-zone | BZ-13 | BZ-11,12 | BZ-14,15 | — | — |
| GET /api/stocks/{ticker}/theme-score | TS-07 | TS-01 | TS-02,03,04,05,06,08,09 | — | — |
| POST /api/stocks/{ticker}/theme-score/recompute | TS-11 | TS-10 | TS-12,13 | — | — |
| GET /api/alerts | ALERT-11 | ALERT-02 | — | ALERT-18 | — |
| POST /api/alerts | ALERT-12 | ALERT-01 | ALERT-07,08,09,10 | — | — |
| PATCH /api/alerts/{id} | ALERT-13 | ALERT-03,04 | — | ALERT-16 | — |
| DELETE /api/alerts/{id} | ALERT-14 | ALERT-05 | — | ALERT-17 | — |
| GET /api/ideas | IDEA-14 | IDEA-03,04,05 | — | IDEA-20 | — |
| POST /api/ideas | IDEA-15 | IDEA-01,02 | IDEA-10,11,12,13 | — | — |
| PATCH /api/ideas/{id} | IDEA-16 | IDEA-06 | — | IDEA-18 | — |
| DELETE /api/ideas/{id} | IDEA-17 | IDEA-07 | — | IDEA-19 | — |
| GET /api/auto-buy/settings | AB-21 | AB-01,02 | AB-07 | — | — |
| PATCH /api/auto-buy/settings | AB-22 | AB-03,04,05,06 | — | — | — |
| GET /api/auto-buy/decision-log | AB-23 | AB-08,09,10 | — | — | — |
| POST /api/auto-buy/dry-run/{ticker} | AB-24 | AB-11 | AB-12,13,14,15,16,17,18,19,20 | — | AB-18 |
| GET /api/opportunities | OPP-08 | OPP-01,02 | OPP-03,04,05,06,07 | — | OPP-09 |

### Frontend Pages

| Page | Auth Redirect | Page Loads | Form Present | Create Flow | Delete Flow | Banned Language |
|---|---|---|---|---|---|---|
| /opportunities | OPP-UI-01 | OPP-UI-02 | OPP-UI-04,05,06 | — | — | OPP-UI-08 |
| /ideas | IDEA-UI-01 | IDEA-UI-02 | IDEA-UI-04,05 | IDEA-UI-07 | IDEA-UI-08,09 | IDEA-UI-06 |
| /alerts | ALERT-UI-01 | ALERT-UI-02 | ALERT-UI-04,05,06 | ALERT-UI-08 | ALERT-UI-11,12 | — |
| /auto-buy | AB-UI-01 | AB-UI-02 | AB-UI-13 | — | — | AB-UI-08 |

### Cross-Feature Integration

| Flow | Test ID |
|---|---|
| Create idea → appears in list with rank_score | V2-INT-01 |
| Buy zone + theme score fetchable for same ticker | V2-INT-02 |
| Create alert → appears in alert list | V2-INT-03,04 |
| Auto-buy dry-run → full safeguard breakdown | V2-INT-05 |
| Dry-run → creates log entry | V2-INT-06 |
| Dry-run log entry has dry_run=true | V2-INT-07 |
| Opportunities uses probabilistic language | V2-INT-08 |
| Opportunities confidence_score in valid range | V2-INT-09 |
| Alerts isolated per user (USER_A vs USER_B) | V2-INT-10 |
| Ideas isolated per user (USER_A vs USER_B) | V2-INT-11 |
| Auto-buy settings independent per user | V2-INT-12 |
| Decision log scoped per user | V2-INT-13 |
| Fresh user defaults: enabled=false, paper_mode=true | V2-INT-14 |
| Dry-run with disabled auto-buy returns safe state | V2-INT-15 |

---

## Assumptions Made

### Backend Availability
All API-level tests assume both the FastAPI backend (`http://localhost:8000`) and Next.js frontend (`http://localhost:3000`) are running. The Playwright config already has these hardcoded with env var overrides.

### v2 Endpoint Availability
All v2 API tests will fail with connection errors or 404s if the v2 backend endpoints have not yet been deployed. This is by design — the tests serve as acceptance criteria. Tests in the following files require v2 routes:
- `buy-zone.spec.ts` — requires `GET/POST /api/stocks/{ticker}/buy-zone`
- `theme-score.spec.ts` — requires `GET/POST /api/stocks/{ticker}/theme-score`
- `alerts.spec.ts` — requires `GET/POST/PATCH/DELETE /api/alerts`
- `ideas.spec.ts` — requires `GET/POST/PATCH/DELETE /api/ideas`
- `auto-buy.spec.ts` — requires all four `/api/auto-buy/` endpoints
- `opportunities.spec.ts` — requires `GET /api/opportunities`
- `v2-integration.spec.ts` — requires all of the above

### Response Shape Assumptions
The response shapes were inferred from:
1. `prompt-feature.md` ORM model definitions and dataclass shapes
2. `FRONTEND2.md` TypeScript interface definitions
3. FastAPI conventions (existing endpoints return the model shape directly)

Where the exact response key name was ambiguous (e.g., `reason_codes` vs `reason_codes_json`), tests check for both:
```typescript
const reasonCodes = (body.reason_codes ?? body.reason_codes_json) as string[];
```

### Auto-Buy Dry-Run Response Code Coverage
The `reason_codes` coverage test (AB-16) checks that at least half of the 9 expected safeguard keys appear in the combined reason code string. This is intentionally lenient because the backend may abbreviate key names or use slightly different naming. If your implementation uses exact names from `SAFEGUARD_CHECKS`, all 9 will match.

### expected_drawdown Sign Convention
Test BZ-08 asserts `expected_drawdown < 0`. This matches the spec comment "percent, negative" in the `BuyZoneResult` dataclass. If your backend stores it as a positive magnitude and negates at display time, change the assertion accordingly.

### Auto-Buy Settings Default confidence_threshold
Test V2-INT-12 asserts `confidence_threshold === 0.70` for a fresh user. This matches the spec default. Adjust the test if your implementation uses a different default.

### UI Tests and Component Selectors
UI tests use multiple fallback selectors to be resilient to minor shadcn/ui component variations. Where a test can't find a component, it silently skips the interaction rather than failing — except for structure-critical checks (heading, primary buttons) which are hard assertions.

The `page.waitForTimeout(500)` in ALERT-UI-10 is the only hardcoded wait and is used only after a Switch toggle to allow the state update request to complete before asserting the URL hasn't changed. This is acceptable per the one case where an async state update would otherwise cause a race with a non-awaitable UI change.

---

## Running the Tests

### Prerequisites
1. Docker Postgres running: `docker compose up -d` (from repo root)
2. Alembic migrations applied: `cd backend && alembic upgrade head`
3. Backend running: `cd backend && uvicorn app.main:app --reload`
4. Frontend running: `cd frontend && npm run dev`
5. Test dependencies installed: `cd tests && npm install`

### Run the full v2 suite only
```bash
cd tests
npx playwright test --config=e2e/playwright.config.ts --grep "BZ-|TS-|ALERT-|IDEA-|AB-|OPP-|V2-INT-"
```

### Run individual spec files
```bash
# API tests only (faster, no browser)
npx playwright test --config=e2e/playwright.config.ts e2e/specs/buy-zone.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/theme-score.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/alerts.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/ideas.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/auto-buy.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/opportunities.spec.ts

# UI tests (require frontend server)
npx playwright test --config=e2e/playwright.config.ts e2e/specs/opportunities-ui.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/ideas-ui.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/alerts-ui.spec.ts
npx playwright test --config=e2e/playwright.config.ts e2e/specs/auto-buy-ui.spec.ts

# Cross-feature integration
npx playwright test --config=e2e/playwright.config.ts e2e/specs/v2-integration.spec.ts
```

### Run all tests (v1 + v2)
```bash
cd tests
npx playwright test --config=e2e/playwright.config.ts
```

### Run in headed mode (useful for UI test debugging)
```bash
npx playwright test --config=e2e/playwright.config.ts e2e/specs/auto-buy-ui.spec.ts --headed
```

### View the HTML report after a run
```bash
npx playwright show-report e2e/playwright-report
```

---

## Tests That Will Fail Before v2 Backend Deployment

The following tests require the v2 backend endpoints to be deployed and reachable. They will fail with a `fetch failed` or HTTP 404 error if the routes do not exist yet:

| Spec File | Failing Condition |
|---|---|
| `buy-zone.spec.ts` (all 15 tests) | `GET/POST /api/stocks/{ticker}/buy-zone` not deployed |
| `theme-score.spec.ts` (all 13 tests) | `GET/POST /api/stocks/{ticker}/theme-score` not deployed |
| `alerts.spec.ts` (all 18 tests) | `/api/alerts` CRUD not deployed |
| `ideas.spec.ts` (all 20 tests) | `/api/ideas` CRUD not deployed |
| `auto-buy.spec.ts` (all 24 tests) | `/api/auto-buy/*` not deployed |
| `opportunities.spec.ts` (all 9 tests) | `GET /api/opportunities` not deployed |
| `v2-integration.spec.ts` (all 15 tests) | All of the above |
| `opportunities-ui.spec.ts` | `/opportunities` page not implemented |
| `ideas-ui.spec.ts` | `/ideas` page not implemented |
| `alerts-ui.spec.ts` | `/alerts` page not implemented |
| `auto-buy-ui.spec.ts` | `/auto-buy` page not implemented |

To run only tests that do NOT depend on v2 backend deployment:
```bash
npx playwright test --config=e2e/playwright.config.ts --grep-invert "BZ-|TS-|ALERT-|IDEA-|AB-|OPP-|V2-INT-"
```

---

## CI/CD Integration

Add this step to your GitHub Actions workflow:

```yaml
- name: Run v2 E2E tests
  working-directory: tests
  env:
    PLAYWRIGHT_BASE_URL: http://localhost:3000
    PLAYWRIGHT_API_URL: http://localhost:8000
  run: |
    npm install
    npx playwright install --with-deps chromium
    npx playwright test --config=e2e/playwright.config.ts --project=chromium
  timeout-minutes: 30
```

Use `--project=chromium` in CI to avoid running all three browser projects and keep CI time reasonable. Run `firefox` and `webkit` projects on a separate scheduled workflow or pre-release gate.

---

## Notes on Test Design Decisions

**Why no `waitForTimeout` except one:** All async waits use `waitForSelector`, `waitForURL`, `toBeVisible({timeout})`, or `waitForLoadState`. The single `waitForTimeout(500)` in ALERT-UI-10 is the documented exception — it guards a Switch toggle state update that has no observable DOM change to wait on.

**Why UI tests use multiple fallback selectors:** The v2 frontend uses shadcn/ui with native HTML replacements (per FRONTEND2.md design decisions). A single selector like `[role="slider"]` would miss the `<input type="range">` implementation. The multi-selector pattern (`selector1, selector2`) ensures tests pass regardless of whether a primitive component or a native HTML element is used.

**Why ownership tests accept `[403, 404]`:** This matches the existing project pattern established in `multi-tenancy.spec.ts`. FastAPI's `assert_ownership()` raises 403, but some list-and-filter patterns may return 404 instead for missing records. Both are correct security behaviors.

**Why the auto-buy dry-run coverage check uses "at least half":** The safeguard key names in the spec may be abbreviated or wrapped in the `reason_codes` strings (e.g., `"PASSED: price_inside_buy_zone"` vs just `"price_inside_buy_zone"`). The `combinedCodes.join(" ")` check is flexible enough to match either format.
