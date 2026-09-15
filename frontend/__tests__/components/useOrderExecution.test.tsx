import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrderExecution } from "@/components/trading/useOrderExecution";
import { liveApi } from "@/lib/api";
import { ApiError } from "@/lib/http";
import { accountStorageKey } from "@/lib/account-storage";
jest.mock("@/lib/api", () => ({ liveApi: { execute: jest.fn() } }));
const execute = jest.mocked(liveApi.execute);
const success = jest.fn(), error = jest.fn();
function wrapper({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(() => new QueryClient({ defaultOptions: { mutations: { retry: false } } }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const options = {
  accountId: "a", symbol: "AAPL", credentialId: 1, isPaper: false, dryRun: false, price: 100,
  timeframe: "1d" as const, mode: "conservative", executePaperOrder: jest.fn(), onSuccess: success, onError: error,
};
const order = { id: 10, symbol: "AAPL", side: "buy", status: "accepted", notional_usd: 100, dry_run: false } as Awaited<ReturnType<typeof liveApi.execute>>;
beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });
test("a lost response survives remount and recovers using exactly the same request ID", async () => {
  execute.mockRejectedValueOnce(new TypeError("network failure"));
  const first = renderHook(() => useOrderExecution(options), { wrapper });
  act(() => first.result.current.executeOrder({ side: "buy", amount: 100 }));
  await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  const original = execute.mock.calls[0][0];
  expect(original.client_order_id).toBeTruthy();
  expect(first.result.current.pendingOrder?.request.client_order_id).toBe(original.client_order_id);
  first.unmount();
  execute.mockResolvedValueOnce(order);
  const next = renderHook(() => useOrderExecution({ ...options, symbol: "MSFT" }), { wrapper });
  act(() => next.result.current.recoverOrder());
  await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
  expect(execute.mock.calls[1][0]).toEqual(original);
  expect(next.result.current.pendingOrder).toBeNull();
  expect(success.mock.calls[0][0]._context.accountId).toBe("a");
});
test("double submission does not issue a second broker request", async () => {
  let finish!: (value: typeof order) => void;
  execute.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const hook = renderHook(() => useOrderExecution(options), { wrapper });
  act(() => {
    hook.result.current.executeOrder({ side: "buy", amount: 100 });
    hook.result.current.executeOrder({ side: "buy", amount: 100 });
  });
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
  await act(async () => finish(order));
  await waitFor(() => expect(success).toHaveBeenCalledTimes(1));
});
test("an unconfirmed broker response remains recoverable and is not logged as success", async () => {
  execute.mockResolvedValueOnce({ ...order, status: "submission_unknown" });
  const hook = renderHook(() => useOrderExecution(options), { wrapper });
  act(() => hook.result.current.executeOrder({ side: "buy", amount: 100 }));
  await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  expect(success).not.toHaveBeenCalled();
  expect(hook.result.current.pendingOrder).not.toBeNull();
  act(() => hook.result.current.executeOrder({ side: "sell", amount: 200 }));
  await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
  expect(execute).toHaveBeenCalledTimes(1);
});
test("a validation rejection clears the unsubmitted intent", async () => {
  execute.mockRejectedValueOnce(new ApiError("Invalid order", 422));
  const hook = renderHook(() => useOrderExecution(options), { wrapper });
  act(() => hook.result.current.executeOrder({ side: "buy", amount: 100 }));
  await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  expect(JSON.parse(localStorage.getItem(accountStorageKey("a", "pending-order")!)!)).toBeNull();
});
test("another account cannot see or recover a saved intent", async () => {
  execute.mockRejectedValueOnce(new TypeError("timeout"));
  const hook = renderHook(({ accountId }) => useOrderExecution({ ...options, accountId }), { wrapper, initialProps: { accountId: "a" } });
  act(() => hook.result.current.executeOrder({ side: "buy", amount: 100 }));
  await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
  hook.rerender({ accountId: "b" });
  expect(hook.result.current.pendingOrder).toBeNull();
  act(() => hook.result.current.recoverOrder());
  await waitFor(() => expect(error).toHaveBeenCalledTimes(2));
  expect(execute).toHaveBeenCalledTimes(1);
});
