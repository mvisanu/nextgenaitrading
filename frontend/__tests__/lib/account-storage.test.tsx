import { act, renderHook } from "@testing-library/react";
import { z } from "zod";
import { accountStorageKey, readAccountData, useAccountStorage, writeAccountData } from "@/lib/account-storage";
const schema = z.array(z.string());
const empty: string[] = [];
beforeEach(() => localStorage.clear());
test("switching accounts never shows the previous account or legacy data", () => {
  localStorage.setItem("legacy", '["shared"]');
  writeAccountData("a", "items", schema, ["private"]);
  const { result, rerender } = renderHook(({ id }: { id: string | null }) => useAccountStorage(id, "items", schema, empty), { initialProps: { id: "a" as string | null } });
  expect(result.current[0]).toEqual(["private"]);
  rerender({ id: "b" }); expect(result.current[0]).toEqual([]);
  rerender({ id: null }); expect(result.current[0]).toEqual([]);
  expect(localStorage.getItem("legacy")).toBe('["shared"]');
});
test("same-tab and cross-tab changes refresh readers without lost sequential updates", () => {
  const one = renderHook(() => useAccountStorage(1, "items", schema, empty));
  const two = renderHook(() => useAccountStorage(1, "items", schema, empty));
  act(() => { one.result.current[1](p => [...p, "one"]); two.result.current[1](p => [...p, "two"]); });
  expect(one.result.current[0]).toEqual(["one", "two"]);
  act(() => {
    localStorage.setItem(accountStorageKey(1, "items")!, '["external"]');
    window.dispatchEvent(new StorageEvent("storage", { key: accountStorageKey(1, "items") }));
  });
  expect(two.result.current[0]).toEqual(["external"]);
});
test.each(['{', '{}', '[null]', '[123]'])("malformed stored value %s is not rendered", raw => {
  localStorage.setItem(accountStorageKey(1, "items")!, raw);
  expect(readAccountData(1, "items", schema, empty)).toEqual([]);
});
test("a failed write cannot report a saved paper trade", () => {
  const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  expect(() => writeAccountData(1, "items", schema, ["one"])).toThrow("quota");
  spy.mockRestore();
  expect(() => writeAccountData(null, "items", schema, ["one"])).toThrow("Sign in");
});
