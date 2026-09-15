import { render, waitFor } from "@testing-library/react";
import { Workspace } from "@/components/layout/Workspace";
import { accountStorageKey } from "@/lib/account-storage";

jest.mock("@/components/layout/AppShell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
jest.mock("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "research-user" } }) }));
jest.mock("next/navigation", () => ({
  usePathname: () => "/research", useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams("view=watchlist&symbol=NVDA&timeframe=4h&strategy=squeeze"),
}));

test("opening Research directly saves incoming context for chart and order links", async () => {
  localStorage.clear();
  render(<Workspace title="Research" description="Research stocks" views={[{ id: "watchlist", label: "Watchlist", component: () => <p>Shared watchlist</p> }]} />);
  await waitFor(() => expect(JSON.parse(localStorage.getItem(accountStorageKey("research-user", "trading-selection")!)!))
    .toEqual({ symbol: "NVDA", timeframe: "4h", strategy: "squeeze" }));
});
