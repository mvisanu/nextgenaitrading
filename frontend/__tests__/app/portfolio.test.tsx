import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Holdings from "@/components/workspaces/portfolio/holdings";

jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: 1 } }) }));

let mockPositions: unknown[] = [];
let mockError: Error | null = null;
jest.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data: queryKey.at(-1) === "positions" ? mockPositions : [], isPending: false, error: queryKey.at(-1) === "positions" ? mockError : null }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/components/layout/WorkspaceSection", () => ({ WorkspaceSection: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
beforeEach(() => { mockPositions = []; mockError = null; localStorage.clear(); });

test("an empty account never shows demo holdings or synthetic performance", () => {
  render(<Holdings />);
  expect(screen.getByText("No recorded positions")).toBeInTheDocument();
  expect(screen.queryByText("TSLA")).not.toBeInTheDocument();
  expect(screen.queryByText("Equity Performance")).not.toBeInTheDocument();
});
test("manual entries are retained but do not impersonate recorded positions", async () => {
  localStorage.setItem("ngs:user:1:portfolio_holdings", JSON.stringify([{ id: "manual", symbol: "AAPL", name: "Apple", sector: "Tech", tag: "TECH", tagColor: "primary", quantity: 2, avgCost: 100, lastPrice: 110, dayPnlPct: 0 }]));
  render(<Holdings />);
  expect(screen.queryByText("AAPL")).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Data source"), "manual");
  expect(screen.getByText("AAPL")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit AAPL" })).toBeInTheDocument();
});
test("recorded holdings cannot be edited through local ledger controls", () => {
  mockPositions = [{ id: 1, symbol: "AAPL", quantity: 2, avg_entry_price: 100, mark_price: 110, is_open: true }];
  render(<Holdings />);
  expect(screen.getByText("AAPL")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit AAPL" })).not.toBeInTheDocument();
  expect(screen.getByText("$220.00")).toBeInTheDocument();
});
test("missing marks are unavailable, not falsely valued at cost", () => {
  mockPositions = [{ id: 1, symbol: "AAPL", quantity: 2, avg_entry_price: 100, mark_price: null, is_open: true }];
  render(<Holdings />);
  expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  expect(screen.getByText(/excluded from these totals/)).toBeInTheDocument();
});
test("a failed positions request is an error, not an empty account", () => {
  mockError = new Error("offline");
  render(<Holdings />);
  expect(screen.getByRole("alert")).toHaveTextContent("Positions could not be loaded");
  expect(screen.queryByText("No recorded positions")).not.toBeInTheDocument();
});
