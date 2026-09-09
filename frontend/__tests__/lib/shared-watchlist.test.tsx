import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useWatchlist } from "@/lib/watchlist";
import { watchlistApi } from "@/lib/api";

let mockUserId = "account-a";
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: mockUserId } }) }));
jest.mock("@/lib/api", () => ({ watchlistApi: { list: jest.fn(), add: jest.fn(), remove: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => { jest.clearAllMocks(); mockUserId = "account-a"; });

test("adding and removing from one view updates the other from the same server list", async () => {
  let rows = [{ ticker: "AAPL" }];
  (watchlistApi.list as jest.Mock).mockImplementation(async () => [...rows]);
  (watchlistApi.add as jest.Mock).mockImplementation(async ticker => { rows = [...rows, { ticker }]; });
  (watchlistApi.remove as jest.Mock).mockImplementation(async ticker => { rows = rows.filter(row => row.ticker !== ticker); });
  const wrapper = setup();
  const { result } = renderHook(() => ({ chart: useWatchlist(), research: useWatchlist() }), { wrapper });
  await waitFor(() => expect(result.current.chart.allItems).toHaveLength(1));
  act(() => result.current.chart.addToWatchlist("stocks", " nvda "));
  await waitFor(() => expect(result.current.research.allItems.map(item => item.symbol)).toEqual(["AAPL", "NVDA"]));
  act(() => result.current.research.removeFromWatchlist("AAPL"));
  await waitFor(() => expect(result.current.chart.allItems.map(item => item.symbol)).toEqual(["NVDA"]));
});

test("another account never sees the previous account's cached list", async () => {
  (watchlistApi.list as jest.Mock).mockResolvedValueOnce([{ ticker: "AAPL" }]).mockResolvedValueOnce([{ ticker: "MSFT" }]);
  const { result, rerender } = renderHook(() => useWatchlist(), { wrapper: setup() });
  await waitFor(() => expect(result.current.allItems[0]?.symbol).toBe("AAPL"));
  mockUserId = "account-b"; rerender();
  expect(result.current.allItems.some(item => item.symbol === "AAPL")).toBe(false);
  await waitFor(() => expect(result.current.allItems[0]?.symbol).toBe("MSFT"));
});

test("server failure shows an error instead of presenting the old browser list as saved", async () => {
  (watchlistApi.list as jest.Mock).mockRejectedValue(new Error("Offline"));
  const { result } = renderHook(() => useWatchlist(), { wrapper: setup() });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.allItems).toEqual([]);
});
