/**
 * Tests for components/strategy/StrategyForm.tsx
 * Covers: form renders, Zod schema validation, required fields, mode description,
 *         leverage field visibility, dry-run default, onSubmit called with correct values.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrategyForm } from "@/components/strategy/StrategyForm";

// Mock the Select component from radix to a native <select>
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const Select = ({ onValueChange, defaultValue, children, disabled }: any) => {
    return (
      <select
        defaultValue={defaultValue}
        onChange={(e) => onValueChange?.(e.target.value)}
        disabled={disabled}
        data-testid="select"
      >
        {children}
      </select>
    );
  };
  const SelectTrigger = ({ children }: any) => <>{children}</>;
  const SelectValue = ({ placeholder }: any) => <option value="">{placeholder}</option>;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ value, children }: any) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// Mock Switch component
jest.mock("@/components/ui/switch", () => {
  const React = require("react");
  const Switch = ({ id, checked, onCheckedChange, disabled }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      role="switch"
    />
  );
  return { Switch };
});

const defaultProps = {
  mode: "conservative" as const,
  onSubmit: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("StrategyForm — conservative mode", () => {
  it("renders the form", () => {
    render(<StrategyForm {...defaultProps} />);
    expect(screen.getByLabelText(/Symbol/i)).toBeInTheDocument();
    // Timeframe label exists (not associated with a form control via htmlFor)
    expect(screen.getByText(/^Timeframe$/)).toBeInTheDocument();
  });

  it("shows the mode description", () => {
    render(<StrategyForm {...defaultProps} />);
    expect(
      screen.getByText(/Leverage 2\.5x.*7\/8 signal confirmations/i)
    ).toBeInTheDocument();
  });

  it("shows leverage field for conservative mode", () => {
    render(<StrategyForm {...defaultProps} />);
    expect(screen.getByLabelText(/Leverage/i)).toBeInTheDocument();
  });

  it("dry-run switch is checked by default", () => {
    render(<StrategyForm {...defaultProps} />);
    const dryRunSwitch = screen.getByRole("switch");
    expect(dryRunSwitch).toBeChecked();
  });

  it("shows 'simulation' label when dry-run is on", () => {
    render(<StrategyForm {...defaultProps} />);
    expect(screen.getByText(/simulation — no real orders/i)).toBeInTheDocument();
  });

  it("shows submit button with mode label", () => {
    render(<StrategyForm {...defaultProps} />);
    expect(screen.getByRole("button", { name: /Run Conservative/i })).toBeInTheDocument();
  });

  it("shows validation error when symbol is empty on submit", async () => {
    render(<StrategyForm {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Run Conservative/i }));

    await waitFor(() => {
      expect(screen.getByText(/Symbol is required/i)).toBeInTheDocument();
    });
  });

  it("does not call onSubmit when symbol is empty", async () => {
    render(<StrategyForm {...defaultProps} />);
    await userEvent.click(screen.getByRole("button", { name: /Run Conservative/i }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  it("calls onSubmit with correct values on valid submission", async () => {
    render(<StrategyForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText(/Symbol/i), "AAPL");
    await userEvent.click(screen.getByRole("button", { name: /Run Conservative/i }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "AAPL",
          mode: "conservative",
          dry_run: true,
        })
      );
    });
  });

  it("uppercases symbol on submit", async () => {
    render(<StrategyForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText(/Symbol/i), "aapl");
    await userEvent.click(screen.getByRole("button", { name: /Run Conservative/i }));

    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: "AAPL" })
      );
    });
  });

  it("shows error when leverage is 0 or negative", async () => {
    render(<StrategyForm {...defaultProps} />);

    await userEvent.type(screen.getByLabelText(/Symbol/i), "AAPL");
    const leverageInput = screen.getByLabelText(/Leverage/i);
    await userEvent.clear(leverageInput);
    await userEvent.type(leverageInput, "-1");

    await userEvent.click(screen.getByRole("button", { name: /Run Conservative/i }));

    await waitFor(() => {
      // Zod: z.number().positive() — should produce an error
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  it("shows loading state when isLoading is true", () => {
    render(<StrategyForm {...defaultProps} isLoading />);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByText(/Running strategy/i)).toBeInTheDocument();
  });
});

describe("StrategyForm — aggressive mode", () => {
  it("shows 4.0x leverage description", () => {
    render(<StrategyForm mode="aggressive" onSubmit={jest.fn()} />);
    expect(screen.getByText(/Leverage 4\.0x/i)).toBeInTheDocument();
  });

  it("shows leverage field for aggressive mode", () => {
    render(<StrategyForm mode="aggressive" onSubmit={jest.fn()} />);
    expect(screen.getByLabelText(/Leverage/i)).toBeInTheDocument();
  });

  it("shows button labeled 'Run Aggressive'", () => {
    render(<StrategyForm mode="aggressive" onSubmit={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Run Aggressive/i })).toBeInTheDocument();
  });
});

describe("StrategyForm — ai-pick mode (optimizer)", () => {
  it("DOES NOT show leverage field for ai-pick", () => {
    render(<StrategyForm mode="ai-pick" onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText(/Leverage/i)).not.toBeInTheDocument();
  });

  it("shows variant description for ai-pick", () => {
    render(<StrategyForm mode="ai-pick" onSubmit={jest.fn()} />);
    expect(screen.getByText(/12 MACD\/RSI\/EMA variants/i)).toBeInTheDocument();
  });

  it("shows 'Running optimization' text when isLoading", () => {
    render(<StrategyForm mode="ai-pick" onSubmit={jest.fn()} isLoading />);
    expect(screen.getByText(/Running optimization/i)).toBeInTheDocument();
  });
});

describe("StrategyForm — buy-low-sell-high mode (optimizer)", () => {
  it("DOES NOT show leverage field for buy-low-sell-high", () => {
    render(<StrategyForm mode="buy-low-sell-high" onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText(/Leverage/i)).not.toBeInTheDocument();
  });

  it("shows 8 dip/cycle variants description", () => {
    render(<StrategyForm mode="buy-low-sell-high" onSubmit={jest.fn()} />);
    expect(screen.getByText(/8 dip\/cycle variants/i)).toBeInTheDocument();
  });

  it("shows button labeled 'Run Buy Low / Sell High'", () => {
    render(<StrategyForm mode="buy-low-sell-high" onSubmit={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Run Buy Low \/ Sell High/i })).toBeInTheDocument();
  });
});

describe("StrategyForm — dry-run toggle", () => {
  it("shows LIVE warning when dry-run is toggled off", async () => {
    render(<StrategyForm {...defaultProps} />);
    const dryRunSwitch = screen.getByRole("switch");

    await userEvent.click(dryRunSwitch);
    expect(screen.getByText(/LIVE — real orders will be submitted/i)).toBeInTheDocument();
  });
});
