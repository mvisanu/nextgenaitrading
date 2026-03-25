/**
 * Tests for app/dashboard/page.tsx
 * Covers: KPI cards render, loading state, empty state, runs table,
 *         symbol/mode/signal display.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";
import type { StrategyRun } from "@/types";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard",
}));

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock AppShell + useAuth
jest.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
  useAuth: () => ({
    user: { id: 1, email: "test@nextgenstock.io" },
    logout: jest.fn(),
  }),
}));

// Mock Sidebar (imported directly by DashboardPage)
jest.mock("@/components/layout/Sidebar", () => ({
  Sidebar: () => <nav data-testid="sidebar" />,
}));

// Mock useSidebarPinned (used by DashboardPage)
jest.mock("@/lib/sidebar", () => ({
  useSidebarPinned: () => ({ pinned: false, toggle: jest.fn() }),
}));

// Mock EquityCurve
jest.mock("@/components/charts/EquityCurve", () => ({
  EquityCurve: () => <div data-testid="equity-curve" />,
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

// TanStack Query mock
type QueryOptions = {
  queryKey: string[];
  queryFn: () => Promise<unknown>;
  enabled?: boolean;
};

const queryResults: Record<string, { data?: unknown; isLoading?: boolean; error?: unknown }> = {};

jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: QueryOptions) => {
    const key = JSON.stringify(queryKey);
    if (queryResults[key]) return queryResults[key];
    // Default: loading
    return { data: undefined, isLoading: true, error: null };
  },
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  }),
}));

const mockRuns: StrategyRun[] = [
  {
    id: 1,
    user_id: 1,
    created_at: "2024-01-10T12:00:00Z",
    run_type: "backtest",
    mode_name: "conservative",
    strategy_family: null,
    symbol: "AAPL",
    timeframe: "1d",
    leverage: 2.5,
    min_confirmations: 7,
    trailing_stop_pct: null,
    current_regime: "bull",
    current_signal: "buy",
    confirmation_count: 7,
    selected_variant_name: null,
    selected_variant_score: null,
    notes: null,
    error_message: null,
  },
  {
    id: 2,
    user_id: 1,
    created_at: "2024-01-11T12:00:00Z",
    run_type: "backtest",
    mode_name: "aggressive",
    strategy_family: null,
    symbol: "TSLA",
    timeframe: "4h",
    leverage: 4.0,
    min_confirmations: 5,
    trailing_stop_pct: 5,
    current_regime: "bear",
    current_signal: "sell",
    confirmation_count: 3,
    selected_variant_name: null,
    selected_variant_score: null,
    notes: null,
    error_message: null,
  },
];

beforeEach(() => {
  // Clear query results
  for (const key in queryResults) delete queryResults[key];
});

describe("DashboardPage — loading state", () => {
  it("renders KPI strip with default values while loading", () => {
    render(<DashboardPage />);
    // KPI strip always renders — shows "Runs" label with 0 count while loading
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
});

describe("DashboardPage — with data", () => {
  beforeEach(() => {
    queryResults[JSON.stringify(["strategies", "runs"])] = {
      data: mockRuns,
      isLoading: false,
      error: null,
    };
  });

  it("renders Dashboard title", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders Runs KPI label in the strip", () => {
    render(<DashboardPage />);
    // KPI strip shows "Runs" label + the count (2 runs)
    expect(screen.getByText("Runs")).toBeInTheDocument();
    const twos = screen.getAllByText("2");
    expect(twos.length).toBeGreaterThan(0);
  });

  it("renders KPI data-testid cards", () => {
    const { container } = render(<DashboardPage />);
    const kpiCards = container.querySelectorAll('[data-testid="kpi-card"]');
    expect(kpiCards.length).toBeGreaterThan(0);
  });

  it("renders strategy run symbols in the expandable table after clicking expand", async () => {
    const { getByTitle } = render(<DashboardPage />);
    // The chevron button expands the recent-runs table
    getByTitle(/show recent runs/i).click();
    // Both symbols may appear in multiple places (KPI strip, table, symbol search)
    const aapls = await screen.findAllByText("AAPL");
    expect(aapls.length).toBeGreaterThan(0);
    const tslas = await screen.findAllByText("TSLA");
    expect(tslas.length).toBeGreaterThan(0);
  });

  it("renders mode names in expanded table", async () => {
    const { getByTitle } = render(<DashboardPage />);
    getByTitle(/show recent runs/i).click();
    // mode_name is rendered as-is (lowercase) from the API
    expect(await screen.findByText("conservative")).toBeInTheDocument();
    expect(screen.getByText("aggressive")).toBeInTheDocument();
  });

  it("renders signal values in expanded table", async () => {
    const { getByTitle } = render(<DashboardPage />);
    getByTitle(/show recent runs/i).click();
    // current_signal rendered as-is; "buy" from AAPL run
    expect(await screen.findByText("buy")).toBeInTheDocument();
    expect(screen.getByText("sell")).toBeInTheDocument();
  });

  it("renders timeframe values in expanded table", async () => {
    const { getByTitle } = render(<DashboardPage />);
    getByTitle(/show recent runs/i).click();
    expect(await screen.findByText("1d")).toBeInTheDocument();
    expect(screen.getByText("4h")).toBeInTheDocument();
  });
});

describe("DashboardPage — empty runs state", () => {
  beforeEach(() => {
    queryResults[JSON.stringify(["strategies", "runs"])] = {
      data: [],
      isLoading: false,
      error: null,
    };
  });

  it("shows empty state message when no runs", async () => {
    const { getByTitle } = render(<DashboardPage />);
    getByTitle(/show recent runs/i).click();
    expect(await screen.findByText(/No strategy runs yet/i)).toBeInTheDocument();
  });

  it("shows link to run a strategy when empty", async () => {
    const { getByTitle } = render(<DashboardPage />);
    getByTitle(/show recent runs/i).click();
    expect(await screen.findByText(/Run a strategy/i)).toBeInTheDocument();
  });

  it("shows '0' for Runs KPI", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
});
