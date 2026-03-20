/**
 * Centralised test constants for the NextGenStock E2E suite.
 *
 * Guidelines:
 *  - Use unique suffixes (timestamp or counter) when creating users to keep tests
 *    independent even if cleanup fails between runs.
 *  - Never import from the frontend source — all types are inlined here.
 */

// ── API base (mirrors playwright.config.ts) ────────────────────────────────
export const API_URL = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// ── User credentials ───────────────────────────────────────────────────────
/** Primary test user.  Created fresh in global-setup if missing. */
export const USER_A = {
  email: "e2e-user-a@nextgenstock.test",
  password: "TestPass1234!",
  displayName: "Test User A",
};

/** Secondary test user — used for multi-tenancy tests. */
export const USER_B = {
  email: "e2e-user-b@nextgenstock.test",
  password: "TestPass5678!",
  displayName: "Test User B",
};

/** Invalid credentials — should never succeed. */
export const INVALID_USER = {
  email: "nobody@nextgenstock.test",
  password: "WrongPassword99!",
};

// ── Broker credentials (fake keys — used with dry-run only) ──────────────
export const ALPACA_CRED = {
  provider: "alpaca" as const,
  profile_name: "E2E Alpaca Paper",
  api_key: "PKTEST00000000000001",
  secret_key: "SKTEST00000000000001abcdef1234567890",
  paper_trading: true,
};

export const ROBINHOOD_CRED = {
  provider: "robinhood" as const,
  profile_name: "E2E Robinhood Crypto",
  api_key: "RHTEST00000000000001",
  secret_key: "RHSECRET00000000000001abcdef1234567890",
};

// ── Symbols ────────────────────────────────────────────────────────────────
export const STOCK_SYMBOL = "AAPL";
export const CRYPTO_SYMBOL = "BTC-USD";
export const ETF_SYMBOL = "SPY";
export const INVALID_SYMBOL = "XXXXINVALID999";

// ── Timeframes ─────────────────────────────────────────────────────────────
export const TIMEFRAMES = ["1d", "1h", "4h", "1wk"] as const;

// ── Strategy modes ─────────────────────────────────────────────────────────
export const MODES = [
  "conservative",
  "aggressive",
  "ai-pick",
  "buy-low-sell-high",
] as const;

// ── Frontend routes ────────────────────────────────────────────────────────
export const ROUTES = {
  login: "/login",
  register: "/register",
  dashboard: "/dashboard",
  strategies: "/strategies",
  backtests: "/backtests",
  liveTrading: "/live-trading",
  artifacts: "/artifacts",
  profile: "/profile",
} as const;

// ── Cookie names ───────────────────────────────────────────────────────────
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

// ── Selectors (data-testid / aria / role) — kept central to ease updates ──
export const SELECTORS = {
  // Auth forms
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  submitButton: 'button[type="submit"]',
  errorAlert: '[role="alert"]',

  // Navigation
  sidebarNav: "nav",
  userAvatar: '[data-testid="user-avatar"], [aria-label*="user"]',

  // Strategy form
  symbolInput: '[placeholder*="symbol" i], [name="symbol"], input[id="symbol"]',
  timeframeSelect: 'select[name="timeframe"], [data-testid="timeframe-select"]',
  modeTab: '[role="tab"]',
  runButton: 'button:has-text("Run"), button:has-text("Analyze")',

  // Results
  signalBadge: '[data-testid="signal-badge"], .badge',
  regimeBadge: '[data-testid="regime-badge"]',

  // Broker form
  providerSelect: 'select[name="provider"], [data-testid="provider-select"]',
  profileNameInput: '[name="profile_name"], input[id="profile_name"]',
  apiKeyInput: '[name="api_key"], input[id="api_key"]',
  secretKeyInput: '[name="secret_key"], input[id="secret_key"]',
  paperToggle: '[name="paper_trading"], input[type="checkbox"]',
  saveCredButton: 'button:has-text("Save")',
  testConnButton: 'button:has-text("Test")',
  deleteCredButton: 'button:has-text("Delete")',
  confirmDeleteButton: '[data-testid="confirm-delete"], button:has-text("Confirm")',

  // Dry-run toggle on live trading
  dryRunToggle: '[name="dry_run"], input[type="checkbox"][aria-label*="dry" i]',
  enableLiveButton: 'button:has-text("Enable Live")',
  confirmLiveDialog: '[role="dialog"]',

  // Toast notifications
  toast: '[data-sonner-toast], [data-testid="toast"], .sonner-toast',

  // Copy button (artifacts)
  copyButton: 'button:has-text("Copy"), button[aria-label*="copy" i]',

  // Pine Script code block
  codeBlock: "pre, code, [data-testid='pine-script']",
} as const;
