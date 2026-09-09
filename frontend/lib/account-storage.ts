"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import type { ZodType } from "zod";

export type AccountId = string | number | null | undefined;
const CHANGE = "ngs-account-storage";
export function accountStorageKey(accountId: AccountId, name: string): string | null {
  return accountId == null ? null : `ngs:user:${encodeURIComponent(String(accountId))}:${name}`;
}

export function readAccountData<T>(accountId: AccountId, name: string, schema: ZodType<T>, fallback: T): T {
  const key = accountStorageKey(accountId, name);
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : fallback;
  } catch { return fallback; }
}

export function writeAccountData<T>(accountId: AccountId, name: string, schema: ZodType<T>, value: T): void {
  const key = accountStorageKey(accountId, name);
  if (!key) throw new Error("Sign in before saving trading data");
  const validated = schema.parse(value);
  // Do not report a successful trade/save if browser persistence failed.
  localStorage.setItem(key, JSON.stringify(validated));
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useAccountStorage<T>(accountId: AccountId, name: string, schema: ZodType<T>, fallback: T) {
  const key = accountStorageKey(accountId, name);
  // Subscribe to the stable raw string, not a newly parsed object on every render.
  const getSnapshot = useCallback(() => {
    try { return key ? localStorage.getItem(key) : null; } catch { return null; }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const value = useMemo(() => {
    try {
      if (raw) { const result = schema.safeParse(JSON.parse(raw)); if (result.success) return result.data; }
    } catch { /* Preserve malformed data for explicit recovery. */ }
    return fallback;
  }, [raw, schema, fallback]);
  const setValue = useCallback((next: T | ((previous: T) => T)) => {
    const previous = readAccountData(accountId, name, schema, fallback);
    try {
      writeAccountData(accountId, name, schema, typeof next === "function" ? (next as (v: T) => T)(previous) : next);
    } catch { toast.error("Could not save browser data. Check storage availability and try again."); }
  }, [accountId, name, schema, fallback]);
  return [value, setValue] as const;
}
