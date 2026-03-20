/**
 * Tests for components/strategy/ResultsPanel.tsx
 * Covers: KPI cards render, trade table render, OptimizationScatter conditional,
 *         artifact link, signal/regime badges.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { ResultsPanel } from "@/components/strategy/ResultsPanel";
import type { BacktestSummary, BacktestTrade, VariantBacktestResult } from "@/types";

// Mock heavy chart components
jest.mock("@/components/charts/PriceChart", () => ({
  PriceChart: () => <div data-testid="price-chart" />,
}));
jest.mock("@/components/charts/EquityCurve", () => ({
  EquityCurve: () => <div data-testid="equity-curve" />,
}));
jest.mock("@/components/charts/OptimizationScatter", () => ({
  OptimizationScatter: () => <div data-testid="optimization-scatter" />,
}));

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

const mockSummary: BacktestSummary = {
  run: {
    id: 1,
    user_id: 1,
    created_at: "2024-01-01T00:00:00Z",
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
  total_return_pct: 15.5,
  max_drawdown_pct: -8.2,
  sharpe_like: 1.4,
  trade_count: 12,
  win_rate: 0.67,
};

const mockTrades: BacktestTrade[] = [
  {
    id: 1,
    user_id: 1,
    strategy_run_id: 1,
    entry_time: "2024-01-10T09:00:00Z",
    exit_time: "2024-01-15T09:00:00Z",
    entry_price: 185.5,
    exit_price: 192.0,
    return_pct: 3.5,
    leveraged_return_pct: 8.75,
    pnl: 325.0,
    holding_hours: 120,
    exit_reason: "trailing_stop",
    mode_name: "conservative",
  },
];

const mockVariants: VariantBacktestResult[] = [
  {
    id: 1,
    user_id: 1,
    strategy_run_id: 1,
    created_at: "2024-01-01T00:00:00Z",
    mode_name: "ai-pick",
    variant_name: "macd_v1",
    family_name: "macd",
    symbol: "AAPL",
    timeframe: "1d",
    parameter_json: {},
    train_return: 12.0,
    validation_return: 10.5,
    test_return: 8.0,
    validation_score: 0.85,
    max_drawdown: -5.0,
    sharpe_like: 1.3,
    trade_count: 8,
    selected_winner: true,
  },
];

describe("ResultsPanel — KPI cards", () => {
  it("renders Total Return KPI", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("Total Return")).toBeInTheDocument();
    expect(screen.getByText("+15.50%")).toBeInTheDocument();
  });

  it("renders Max Drawdown KPI", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("Max Drawdown")).toBeInTheDocument();
    expect(screen.getByText("-8.20%")).toBeInTheDocument();
  });

  it("renders Sharpe-Like KPI", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("Sharpe-Like")).toBeInTheDocument();
    expect(screen.getByText("1.40")).toBeInTheDocument();
  });

  it("renders Win Rate KPI as percentage", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("Win Rate")).toBeInTheDocument();
    expect(screen.getByText("67.0%")).toBeInTheDocument();
  });
});

describe("ResultsPanel — signal/regime badges", () => {
  it("shows regime badge when current_regime is set", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("bull")).toBeInTheDocument();
    expect(screen.getByText("Regime:")).toBeInTheDocument();
  });

  it("shows signal badge in uppercase when current_signal is set", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("BUY")).toBeInTheDocument();
    expect(screen.getByText("Signal:")).toBeInTheDocument();
  });

  it("shows confirmation count", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(screen.getByText("7 confirmations")).toBeInTheDocument();
  });

  it("does not show regime when current_regime is null", () => {
    const noRegime: BacktestSummary = {
      ...mockSummary,
      run: { ...mockSummary.run, current_regime: null },
    };
    render(<ResultsPanel summary={noRegime} />);
    expect(screen.queryByText("Regime:")).not.toBeInTheDocument();
  });
});

describe("ResultsPanel — trade table", () => {
  it("shows trade table when trades are provided", () => {
    render(<ResultsPanel summary={mockSummary} trades={mockTrades} />);
    expect(screen.getByText("Trades (1)")).toBeInTheDocument();
  });

  it("shows trade entry/exit prices", () => {
    render(<ResultsPanel summary={mockSummary} trades={mockTrades} />);
    expect(screen.getByText("$185.50")).toBeInTheDocument();
    expect(screen.getByText("$192.00")).toBeInTheDocument();
  });

  it("shows trade return pct", () => {
    render(<ResultsPanel summary={mockSummary} trades={mockTrades} />);
    expect(screen.getByText("+3.50%")).toBeInTheDocument();
  });

  it("shows exit reason", () => {
    render(<ResultsPanel summary={mockSummary} trades={mockTrades} />);
    expect(screen.getByText("trailing_stop")).toBeInTheDocument();
  });

  it("does not show trade table when trades array is empty", () => {
    render(<ResultsPanel summary={mockSummary} trades={[]} />);
    expect(screen.queryByText(/Trades \(/)).not.toBeInTheDocument();
  });
});

describe("ResultsPanel — OptimizationScatter", () => {
  const optimizerSummary: BacktestSummary = {
    ...mockSummary,
    run: { ...mockSummary.run, mode_name: "ai-pick" },
  };

  it("shows OptimizationScatter when mode is ai-pick and variants provided", () => {
    render(
      <ResultsPanel
        summary={optimizerSummary}
        variants={mockVariants}
      />
    );
    expect(screen.getByTestId("optimization-scatter")).toBeInTheDocument();
  });

  it("does NOT show OptimizationScatter for conservative mode", () => {
    render(<ResultsPanel summary={mockSummary} variants={mockVariants} />);
    expect(screen.queryByTestId("optimization-scatter")).not.toBeInTheDocument();
  });

  it("does NOT show OptimizationScatter when variants is empty", () => {
    render(<ResultsPanel summary={optimizerSummary} variants={[]} />);
    expect(screen.queryByTestId("optimization-scatter")).not.toBeInTheDocument();
  });

  it("shows variant leaderboard with winner trophy for ai-pick", () => {
    render(
      <ResultsPanel
        summary={optimizerSummary}
        variants={mockVariants}
      />
    );
    expect(screen.getByText("macd_v1")).toBeInTheDocument();
    expect(screen.getByText("Variant Leaderboard")).toBeInTheDocument();
  });
});

describe("ResultsPanel — artifact link", () => {
  it("shows artifact link when artifactId is provided", () => {
    render(<ResultsPanel summary={mockSummary} artifactId={42} />);
    const link = screen.getByText("View generated Pine Script artifact");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/artifacts?highlight=42");
  });

  it("does not show artifact link when artifactId is not provided", () => {
    render(<ResultsPanel summary={mockSummary} />);
    expect(
      screen.queryByText("View generated Pine Script artifact")
    ).not.toBeInTheDocument();
  });
});

describe("ResultsPanel — equity curve", () => {
  it("shows equity curve when equityPoints are in chartData", () => {
    render(
      <ResultsPanel
        summary={mockSummary}
        chartData={{
          candles: [],
          signals: [],
          equity: [{ date: "2024-01-01", equity: 100 }],
        }}
      />
    );
    expect(screen.getByTestId("equity-curve")).toBeInTheDocument();
  });
});
