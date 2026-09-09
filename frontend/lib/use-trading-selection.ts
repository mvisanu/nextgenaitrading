"use client";

import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { useCallback,useEffect,useMemo } from "react";
import { useAccountStorage } from "./account-storage";
import { useAuth } from "./auth-context";
import { DEFAULT_SELECTION,selectionFromParams,selectionSchema,tradingHref,type TradingSelection } from "./trading-selection";

export function useSavedTradingSelection() {
  const { user } = useAuth();
  return useAccountStorage(user?.id, "trading-selection", selectionSchema, DEFAULT_SELECTION);
}

export function useTradingSelection() {
  const { user } = useAuth();
  const [saved, save] = useSavedTradingSelection();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const selection = useMemo(() => selectionFromParams(params, saved), [params, saved]);
  useEffect(() => {
    if (user && JSON.stringify(saved) !== JSON.stringify(selection)) save(selection);
  }, [saved, selection, save, user]);
  const update = useCallback((patch: Partial<TradingSelection>) => {
    const next = selectionSchema.safeParse({ ...selection, ...patch });
    if (!next.success) return false;
    router.replace(tradingHref(`${pathname}?${params}`, next.data), { scroll: false });
    return true;
  }, [selection, router, pathname, params]);
  return [selection, update] as const;
}
