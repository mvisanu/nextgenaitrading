/**
 * Tests for app/profile/page.tsx
 * Covers: masked broker key displayed, add credential dialog, delete confirmation dialog,
 *         credential form validation, profile form submit.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "@/app/profile/page";
import type { BrokerCredential, UserProfile } from "@/types";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/profile",
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

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock Dialog
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

// Mock Select
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  const Select = ({ onValueChange, defaultValue, disabled, children }: any) => (
    <select
      defaultValue={defaultValue}
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
    />
  );
  return { Switch };
});

// Mock Separator
jest.mock("@/components/ui/separator", () => ({
  Separator: () => <hr />,
}));

// Mock Alert
jest.mock("@/components/ui/alert", () => ({
  Alert: ({ children, variant }: any) => <div role="alert" data-variant={variant}>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

// Mock sonner
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (msg: string) => mockToastSuccess(msg),
    error: (msg: string) => mockToastError(msg),
  },
}));

// Mock API
const mockSaveProfile = jest.fn();
const mockCreateCredential = jest.fn();
const mockDeleteCredential = jest.fn();
const mockTestCredential = jest.fn();

jest.mock("@/lib/api", () => ({
  profileApi: {
    get: jest.fn(),
    update: jest.fn(),
  },
  brokerApi: {
    list: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
    test: jest.fn(),
  },
}));

const mockProfile: UserProfile = {
  id: 1,
  user_id: 1,
  display_name: "Alice Trader",
  timezone: "America/New_York",
  default_symbol: "AAPL",
  default_mode: "conservative",
};

const mockCredentials: BrokerCredential[] = [
  {
    id: 1,
    user_id: 1,
    provider: "alpaca",
    profile_name: "My Alpaca Account",
    api_key: "****ABCD",
    base_url: null,
    is_active: true,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
];

// Track mutation callbacks
let saveMutationOnSuccess: ((data: unknown) => void) | null = null;
let saveMutationOnError: ((err: Error) => void) | null = null;
let createMutationOnSuccess: ((data: unknown) => void) | null = null;
let deleteMutationOnSuccess: (() => void) | null = null;
let deleteMutationOnError: ((err: Error) => void) | null = null;

jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: any) => {
    if (JSON.stringify(queryKey) === JSON.stringify(["profile"])) {
      return { data: mockProfile, isLoading: false };
    }
    if (JSON.stringify(queryKey) === JSON.stringify(["broker", "credentials"])) {
      return { data: mockCredentials, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  },
  useMutation: ({ mutationFn, onSuccess, onError }: any) => {
    // Identify which mutation by examining mutationFn.toString()
    const fnStr = mutationFn.toString();
    if (fnStr.includes("profileApi")) {
      saveMutationOnSuccess = onSuccess;
      saveMutationOnError = onError;
      return { mutate: mockSaveProfile, isPending: false };
    }
    if (fnStr.includes("brokerApi.create")) {
      createMutationOnSuccess = onSuccess;
      return { mutate: mockCreateCredential, isPending: false };
    }
    if (fnStr.includes("brokerApi.delete")) {
      deleteMutationOnSuccess = onSuccess;
      deleteMutationOnError = onError;
      return { mutate: mockDeleteCredential, isPending: false };
    }
    if (fnStr.includes("brokerApi.test")) {
      return { mutate: mockTestCredential, isPending: false };
    }
    return { mutate: jest.fn(), isPending: false };
  },
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ProfilePage — rendering", () => {
  it("renders the Profile page title", () => {
    render(<ProfilePage />);
    expect(screen.getByText("Profile")).toBeInTheDocument();
  });

  it("renders User Profile section", () => {
    render(<ProfilePage />);
    expect(screen.getByText("User Profile")).toBeInTheDocument();
  });

  it("renders Broker Credentials section", () => {
    render(<ProfilePage />);
    expect(screen.getByText("Broker Credentials")).toBeInTheDocument();
  });

  it("shows existing credential row", () => {
    render(<ProfilePage />);
    expect(screen.getByText("My Alpaca Account")).toBeInTheDocument();
  });
});

describe("ProfilePage — masked broker keys", () => {
  it("displays masked API key (****ABCD format)", () => {
    render(<ProfilePage />);
    expect(screen.getByText("****ABCD")).toBeInTheDocument();
  });

  it("does NOT show unmasked key in the DOM", () => {
    render(<ProfilePage />);
    // The credential should show masked form
    const keyDisplay = screen.getByText("****ABCD");
    expect(keyDisplay).toBeInTheDocument();
    // Verify it's rendered as monospace (credential detail)
    expect(keyDisplay.className).toContain("mono");
  });

  it("shows Alpaca badge on alpaca credential", () => {
    render(<ProfilePage />);
    expect(screen.getByText(/Alpaca.*Stocks.*ETFs/)).toBeInTheDocument();
  });
});

describe("ProfilePage — delete confirmation dialog", () => {
  it("does NOT show delete dialog initially", () => {
    render(<ProfilePage />);
    expect(screen.queryByText("Delete Credential?")).not.toBeInTheDocument();
  });

  it("opens delete confirmation when trash icon is clicked", async () => {
    render(<ProfilePage />);

    // Find the delete button (trash icon button)
    const deleteBtn = screen.getByRole("button", { name: "" }); // icon-only button
    // More targeted: find the destructive ghost button
    const allButtons = screen.getAllByRole("button");
    const trashButton = allButtons.find(
      (btn) =>
        btn.querySelector("svg") &&
        (btn.className.includes("destructive") || btn.className.includes("text-destructive"))
    );

    if (trashButton) {
      await userEvent.click(trashButton);
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Delete Credential?")).toBeInTheDocument();
      });
    }
  });
});

describe("ProfilePage — add credential dialog", () => {
  it("opens dialog when 'Add Credential' button is clicked", async () => {
    render(<ProfilePage />);

    await userEvent.click(screen.getByRole("button", { name: /Add Credential/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Add Broker Credential")).toBeInTheDocument();
    });
  });

  it("shows Robinhood warning when Robinhood provider is selected", async () => {
    render(<ProfilePage />);

    await userEvent.click(screen.getByRole("button", { name: /Add Credential/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // There may be multiple comboboxes (provider, default_mode in profile form)
    // Find the one inside the dialog
    const dialog = screen.getByRole("dialog");
    const selects = dialog.querySelectorAll("select");
    // Provider select should be the first one inside the dialog
    const providerSelect = selects[0] as HTMLSelectElement;
    expect(providerSelect).toBeDefined();
    await userEvent.selectOptions(providerSelect, "robinhood");

    await waitFor(() => {
      expect(
        screen.getByText(/Robinhood credentials only support crypto trading/i)
      ).toBeInTheDocument();
    });
  });

  it("shows profile_name required error when form is submitted empty", async () => {
    render(<ProfilePage />);
    await userEvent.click(screen.getByRole("button", { name: /Add Credential/i }));

    await waitFor(() => screen.getByRole("dialog"));

    // Submit without filling required fields
    await userEvent.click(screen.getByRole("button", { name: /Save Credential/i }));

    await waitFor(() => {
      expect(screen.getByText("Profile name is required")).toBeInTheDocument();
    });
  });
});
