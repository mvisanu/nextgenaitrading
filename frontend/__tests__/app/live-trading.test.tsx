/**
 * Tests for app/live-trading/page.tsx
 * Covers: risk disclaimer always visible, dry-run default ON, confirmation dialog
 *         before live enable, LIVE banner when live mode active.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveTradingPage from "@/app/live-trading/page";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/live-trading",
}));

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
    isLoading: false,
    logout: jest.fn(),
  }),
}));

// Mock PriceChart
jest.mock("@/components/charts/PriceChart", () => ({
  PriceChart: () => <div data-testid="price-chart" />,
}));

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock sonner
const mockToastWarning = jest.fn();
const mockToastInfo = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    info: (msg: string) => mockToastInfo(msg),
    warning: (msg: string) => mockToastWarning(msg),
  },
}));

// Mock @hookform/resolvers/zod
jest.mock("@hookform/resolvers/zod", () => ({
  zodResolver: () => async (data: unknown) => ({ values: data, errors: {} }),
}));

// TanStack Query mock
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn, enabled }: any) => {
    // Return empty data for all queries
    return { data: [], isLoading: false };
  },
  useMutation: ({ onSuccess, onError }: any) => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  }),
}));

// Mock select component
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const Select = ({ onValueChange, defaultValue, value, children, disabled }: any) => (
    <select
      defaultValue={defaultValue ?? value}
      onChange={(e) => onValueChange?.(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  );
  const SelectTrigger = ({ children }: any) => <>{children}</>;
  const SelectValue = ({ placeholder }: any) => <option value="">{placeholder}</option>;
  const SelectContent = ({ children }: any) => <>{children}</>;
  const SelectItem = ({ value, children }: any) => <option value={value}>{children}</option>;
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// Mock Switch
jest.mock("@/components/ui/switch", () => {
  const React = require("react");
  const Switch = ({ id, checked, onCheckedChange, disabled }: any) => (
    <input
      type="checkbox"
      id={id}
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
    />
  );
  return { Switch };
});

// Mock Dialog components
jest.mock("@/components/ui/dialog", () => {
  const React = require("react");
  const Dialog = ({ open, onOpenChange, children }: any) =>
    open ? <div role="dialog">{children}</div> : null;
  const DialogContent = ({ children }: any) => <div>{children}</div>;
  const DialogHeader = ({ children }: any) => <div>{children}</div>;
  const DialogTitle = ({ children }: any) => <h2>{children}</h2>;
  const DialogDescription = ({ children }: any) => <p>{children}</p>;
  const DialogFooter = ({ children }: any) => <div>{children}</div>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockToastWarning.mockClear();
});

describe("LiveTradingPage — risk disclaimer", () => {
  it("always renders the risk disclaimer", () => {
    render(<LiveTradingPage />);
    // Compact disclaimer at bottom of the form
    expect(screen.getByText(/Educational software/i)).toBeInTheDocument();
  });

  it("disclaimer mentions real trading risk", () => {
    render(<LiveTradingPage />);
    expect(screen.getByText(/risk of total loss/i)).toBeInTheDocument();
  });

  it("disclaimer mentions past performance", () => {
    render(<LiveTradingPage />);
    expect(screen.getByText(/Past performance/i)).toBeInTheDocument();
  });
});

describe("LiveTradingPage — paper mode default", () => {
  it("does NOT show LIVE MODE ACTIVE banner by default", () => {
    render(<LiveTradingPage />);
    expect(screen.queryByText("LIVE MODE ACTIVE")).not.toBeInTheDocument();
  });

  it("execute button shows paper trade label by default", () => {
    render(<LiveTradingPage />);
    expect(screen.getByText("Execute Paper Trade")).toBeInTheDocument();
  });

  it("Paper mode button is shown in the mode selector", () => {
    render(<LiveTradingPage />);
    expect(screen.getByText("Paper")).toBeInTheDocument();
    expect(screen.getByText("Dry Run")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});

describe("LiveTradingPage — confirmation dialog before live mode", () => {
  async function clickLiveButton() {
    // Find and click the "Live" mode button to trigger the confirmation dialog
    const liveButton = screen.getByRole("button", { name: /^Live$/i });
    await userEvent.click(liveButton);
  }

  it("opens confirmation dialog when Live mode is selected", async () => {
    render(<LiveTradingPage />);
    await clickLiveButton();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("Enable Live Trading?")).toBeInTheDocument();
  });

  it("does NOT switch to live mode if Cancel is clicked", async () => {
    render(<LiveTradingPage />);
    await clickLiveButton();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // Dialog should close, no LIVE banner
    await waitFor(() => {
      expect(screen.queryByText("LIVE MODE ACTIVE")).not.toBeInTheDocument();
    });
  });

  it("enables live mode and shows LIVE banner when confirmed", async () => {
    render(<LiveTradingPage />);
    await clickLiveButton();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Yes, enable LIVE mode/i })
    );

    await waitFor(() => {
      expect(screen.getByText("LIVE MODE ACTIVE")).toBeInTheDocument();
    });
  });

  it("shows LIVE MODE warning toast when confirmed", async () => {
    render(<LiveTradingPage />);
    await clickLiveButton();

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: /Yes, enable LIVE mode/i })
    );

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith(
        expect.stringContaining("LIVE MODE")
      );
    });
  });

  it("shows destructive execute button when live mode is enabled", async () => {
    render(<LiveTradingPage />);
    await clickLiveButton();

    await waitFor(() => screen.getByRole("dialog"));
    await userEvent.click(
      screen.getByRole("button", { name: /Yes, enable LIVE mode/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Execute LIVE Order")).toBeInTheDocument();
    });
  });
});
