/**
 * useMarketStream — SSE hook for real-time Alpaca quote data.
 *
 * Connects to GET /api/v1/stream/quotes?symbols=...
 * Emits quote events (bid/ask/last) as they arrive.
 * Falls back gracefully to null quotes when streaming is unavailable.
 *
 * Memory-safe: EventSource is closed on unmount; no unbounded state growth.
 */
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getSupabaseBrowserClient } from "./supabase";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export type StreamStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "yfinance_fallback"
  | "error"
  | "disconnected"
  | "unconfigured";

export interface QuoteData {
  symbol: string;
  bid: number | null;
  ask: number | null;
  bid_size: number | null;
  ask_size: number | null;
  last: number | null;
  last_size: number | null;
  timestamp: string | null;
  stale: boolean;
}

interface UseMarketStreamResult {
  quotes: Record<string, QuoteData>;
  status: StreamStatus;
}

/**
 * Subscribe to real-time quotes for the given symbols.
 * symbols should be stable (memoised) to avoid reconnects on every render.
 */
export function useMarketStream(symbols: string[]): UseMarketStreamResult {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [status, setStatus] = useState<StreamStatus>("connecting");
  // We use fetch-based SSE (not EventSource) so we can set Authorization header.
  // esRef holds an abort controller wrapper.
  const esRef = useRef<{ abort: () => void } | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const symbolKey = useMemo(() => symbols.slice().sort().join(","), [symbols]);

  // Use a ref to hold the connect function to avoid stale closures in reconnect callbacks
  const connectRef = useRef<(syms: string[]) => void>(() => {});

  const connect = useCallback(async (syms: string[]) => {
    if (esRef.current) {
      esRef.current.abort();
      esRef.current = null;
    }

    if (!syms.length) {
      setStatus("disconnected");
      return;
    }

    // Get auth token
    let token: string | null = null;
    try {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token ?? null;
      }
    } catch {
      // no-op
    }

    if (!token) {
      setStatus("error");
      return;
    }

    const url = `${BASE_URL}/api/v1/stream/quotes?symbols=${encodeURIComponent(
      syms.join(",")
    )}`;

    // Use fetch-based SSE so we can set Authorization header (EventSource cannot).
    const ctrl = new AbortController();
    setStatus("connecting");

    (async () => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          setStatus(res.status === 401 ? "error" : "reconnecting");
          scheduleReconnect(syms);
          return;
        }

        retryCountRef.current = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "message";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              const raw = line.slice(5).trim();
              try {
                const payload = JSON.parse(raw);
                if (eventType === "status") {
                  const s = (payload as { status?: string })?.status ?? "connecting";
                  setStatus(s as StreamStatus);
                } else if (eventType === "snapshot") {
                  setQuotes(payload as Record<string, QuoteData>);
                } else if (eventType === "quote") {
                  const q = payload as QuoteData;
                  if (q?.symbol) {
                    setQuotes((prev) => ({ ...prev, [q.symbol]: q }));
                  }
                }
              } catch {
                // ignore parse errors
              }
              eventType = "message";
            }
          }
        }

        // Clean disconnect — try reconnect
        setStatus("reconnecting");
        scheduleReconnect(syms);
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setStatus("reconnecting");
        scheduleReconnect(syms);
      }
    })();

    esRef.current = { abort: () => ctrl.abort() };

    function scheduleReconnect(s: string[]) {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      const backoff = Math.min(1000 * 2 ** retryCountRef.current, 30_000);
      retryCountRef.current += 1;
      reconnectTimer.current = window.setTimeout(
        () => connectRef.current(s),
        backoff
      );
    }
  }, []); // stable — no deps needed since setters are stable

  // Keep connectRef current so scheduleReconnect always calls latest version
  connectRef.current = connect;

  useEffect(() => {
    retryCountRef.current = 0;
    if (symbols.length > 0) {
      connect(symbols);
    } else {
      setStatus("disconnected");
    }

    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      esRef.current?.abort();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  return { quotes, status };
}

/** Derive a simple spread value (ask - bid), or null if unavailable. */
export function getSpread(q: QuoteData | undefined): number | null {
  if (!q?.bid || !q?.ask) return null;
  return q.ask - q.bid;
}
