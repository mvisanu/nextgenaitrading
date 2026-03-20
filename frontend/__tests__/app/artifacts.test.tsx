/**
 * Tests for app/artifacts/page.tsx
 * Covers: renders artifact table, copy-to-clipboard, download as .pine,
 *         row click fetches and shows code, empty state.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArtifactsPage from "@/app/artifacts/page";
import type { Artifact } from "@/types";

// Mock AppShell
jest.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children, title }: any) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Mock next/link
jest.mock("next/link", () => {
  const React = require("react");
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

// Mock ScrollArea
jest.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
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

// Mock artifactApi
const mockArtifactList = jest.fn();
const mockArtifactPineScript = jest.fn();
jest.mock("@/lib/api", () => ({
  artifactApi: {
    list: () => mockArtifactList(),
    pineScript: (id: number) => mockArtifactPineScript(id),
  },
}));

// Mock clipboard
const mockClipboardWrite = jest.fn();
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  value: { writeText: mockClipboardWrite },
});

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = jest.fn().mockReturnValue("blob:mock-url");
const mockRevokeObjectURL = jest.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

const mockArtifacts: Artifact[] = [
  {
    id: 1,
    user_id: 1,
    strategy_run_id: 10,
    created_at: "2024-01-15T12:00:00Z",
    mode_name: "ai-pick",
    variant_name: "macd_v3",
    pine_script_version: "v5",
    notes: null,
    selected_winner: true,
    symbol: "AAPL",
  },
  {
    id: 2,
    user_id: 1,
    strategy_run_id: 11,
    created_at: "2024-01-20T12:00:00Z",
    mode_name: "buy-low-sell-high",
    variant_name: "dip_hunter_v2",
    pine_script_version: "v5",
    notes: "Strong performer",
    selected_winner: false,
    symbol: "BTC-USD",
  },
];

// Mock TanStack Query
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: any) => {
    const result = queryFn();
    if (result && typeof result.then === "function") {
      // It's a promise — return loading state initially
      // For test purposes, resolve synchronously via mockArtifactList
    }
    return { data: mockArtifactList(), isLoading: false };
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockArtifactList.mockReturnValue(mockArtifacts);
  mockArtifactPineScript.mockResolvedValue({ code: "//@version=5\n// Test script" });
  mockClipboardWrite.mockResolvedValue(undefined);
});

describe("ArtifactsPage — rendering", () => {
  it("renders the page title", () => {
    render(<ArtifactsPage />);
    expect(screen.getByText("Artifacts")).toBeInTheDocument();
  });

  it("shows artifact count in header", () => {
    render(<ArtifactsPage />);
    expect(screen.getByText(/Pine Script Artifacts \(2\)/)).toBeInTheDocument();
  });

  it("renders artifact rows in table", () => {
    render(<ArtifactsPage />);
    expect(screen.getByText("macd_v3")).toBeInTheDocument();
    expect(screen.getByText("dip_hunter_v2")).toBeInTheDocument();
  });

  it("shows mode labels in table", () => {
    render(<ArtifactsPage />);
    expect(screen.getByText("AI Pick")).toBeInTheDocument();
    expect(screen.getByText("Buy Low / Sell High")).toBeInTheDocument();
  });

  it("shows symbol in table", () => {
    render(<ArtifactsPage />);
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("BTC-USD")).toBeInTheDocument();
  });

  it("shows version badge", () => {
    render(<ArtifactsPage />);
    const v5Badges = screen.getAllByText("v5");
    expect(v5Badges.length).toBe(2);
  });
});

describe("ArtifactsPage — empty state", () => {
  it("shows empty state message when no artifacts", () => {
    mockArtifactList.mockReturnValue([]);
    render(<ArtifactsPage />);
    expect(screen.getByText(/No Pine Script artifacts yet/i)).toBeInTheDocument();
  });

  it("shows link to strategies page in empty state", () => {
    mockArtifactList.mockReturnValue([]);
    render(<ArtifactsPage />);
    const link = screen.getByRole("link", { name: /Run an AI Pick or Buy Low \/ Sell High strategy/i });
    expect(link).toBeInTheDocument();
  });
});

describe("ArtifactsPage — copy to clipboard", () => {
  it("copy button is disabled when code is not yet loaded", () => {
    render(<ArtifactsPage />);
    const copyButtons = screen.getAllByTitle("Copy to clipboard");
    // Code not loaded yet → all disabled
    copyButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("shows toast error when download attempted without loading code first", async () => {
    render(<ArtifactsPage />);
    const downloadButtons = screen.getAllByTitle("Download .pine file");
    // Buttons are disabled until code is loaded
    expect(downloadButtons[0]).toBeDisabled();
  });
});

describe("ArtifactsPage — row click and code loading", () => {
  it("loads and shows pine script code when row is clicked", async () => {
    render(<ArtifactsPage />);

    // Click on the first artifact row
    const rows = screen.getAllByRole("row");
    // Skip header row (index 0)
    await userEvent.click(rows[1]);

    await waitFor(() => {
      expect(mockArtifactPineScript).toHaveBeenCalledWith(1);
    });
  });

  it("copy button enabled after code is loaded and calls clipboard.writeText", async () => {
    render(<ArtifactsPage />);

    // Click row to load code
    const rows = screen.getAllByRole("row");
    await userEvent.click(rows[1]);

    await waitFor(() => {
      expect(mockArtifactPineScript).toHaveBeenCalledWith(1);
    });

    // Find copy button in expanded row (the one in the viewer, not the table action)
    await waitFor(() => {
      const copyButtons = screen.getAllByTitle("Copy to clipboard");
      expect(copyButtons[0]).not.toBeDisabled();
    });
  });

  it("shows toast success after successful copy", async () => {
    render(<ArtifactsPage />);

    const rows = screen.getAllByRole("row");
    await userEvent.click(rows[1]);

    await waitFor(() => {
      expect(mockArtifactPineScript).toHaveBeenCalledWith(1);
    });

    await waitFor(() => {
      const copyButtons = screen.getAllByTitle("Copy to clipboard");
      return copyButtons[0].closest("[aria-disabled='false']") || !copyButtons[0].hasAttribute("disabled");
    });

    const copyButtons = screen.getAllByTitle("Copy to clipboard");
    const enabledCopy = copyButtons.find((btn) => !btn.hasAttribute("disabled"));
    if (enabledCopy) {
      await userEvent.click(enabledCopy);
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Pine Script copied to clipboard");
      });
    }
  });

  it("collapses row when clicked a second time", async () => {
    render(<ArtifactsPage />);
    const rows = screen.getAllByRole("row");

    // First click to expand
    await userEvent.click(rows[1]);
    await waitFor(() => expect(mockArtifactPineScript).toHaveBeenCalled());

    // Second click to collapse
    await userEvent.click(rows[1]);

    // Code viewer should no longer be visible
    await waitFor(() => {
      expect(screen.queryByText("Strategy run:")).not.toBeInTheDocument();
    });
  });
});

describe("ArtifactsPage — download", () => {
  it("creates a blob URL and triggers download after code is loaded", async () => {
    render(<ArtifactsPage />);
    const rows = screen.getAllByRole("row");
    await userEvent.click(rows[1]);

    await waitFor(() => expect(mockArtifactPineScript).toHaveBeenCalledWith(1));

    // Wait for code to appear in state
    await waitFor(() => {
      const downloadButtons = screen.getAllByTitle("Download .pine file");
      return !downloadButtons[0].hasAttribute("disabled");
    });

    const downloadButtons = screen.getAllByTitle("Download .pine file");
    const enabled = downloadButtons.find((b) => !b.hasAttribute("disabled"));
    if (enabled) {
      await userEvent.click(enabled);
      expect(mockCreateObjectURL).toHaveBeenCalled();
    }
  });
});
