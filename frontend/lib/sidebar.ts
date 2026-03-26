import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

const PINNED_KEY = "ngs-sidebar-pinned";

// Simple cross-component sync for sidebar pinned state via storage events
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): boolean {
  try {
    const val = localStorage.getItem(PINNED_KEY);
    // Default to pinned on first visit (no stored preference yet)
    if (val === null) return true;
    return val === "true";
  } catch {
    return true;
  }
}

function getServerSnapshot(): boolean {
  return true;
}

function setPinned(value: boolean) {
  try { localStorage.setItem(PINNED_KEY, String(value)); } catch {}
  listeners.forEach((cb) => cb());
}

export function useSidebarPinned() {
  const pinned = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    setPinned(!getSnapshot());
  }, []);

  // Listen for storage events from other tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PINNED_KEY) listeners.forEach((cb) => cb());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { pinned, toggle };
}
