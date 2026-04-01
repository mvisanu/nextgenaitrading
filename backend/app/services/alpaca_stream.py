"""
Alpaca real-time market data stream manager.

Maintains a single WebSocket connection to Alpaca's data stream,
fans out quote/trade updates to registered SSE client queues.

Memory-safe design:
- Max MAX_SYMBOLS symbols subscribed at any time
- Per-symbol quote history bounded to 1 entry (latest only)
- Stale quotes dropped after STALE_SECONDS
- Client queues bounded to MAX_QUEUE_DEPTH; old entries evicted
- Exponential backoff reconnect (1s → 60s max)
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_SYMBOLS = 20          # hard cap on subscribed symbols
STALE_SECONDS = 90        # mark quote stale if no update for this long
MAX_QUEUE_DEPTH = 50      # per-client update queue depth (evict oldest)
MAX_RECONNECT_BACKOFF = 60  # seconds

# Alpaca IEX feed (free tier — 15-min delayed quotes)
# Users with paid SIP subscriptions should set ALPACA_FEED=sip
_FEED_URLS = {
    "iex": "wss://stream.data.alpaca.markets/v2/iex",
    "sip": "wss://stream.data.alpaca.markets/v2/sip",
    "test": "wss://stream.data.alpaca.markets/v2/test",
}


@dataclass
class QuoteData:
    symbol: str
    bid_price: float | None = None
    ask_price: float | None = None
    bid_size: int | None = None
    ask_size: int | None = None
    last_price: float | None = None
    last_size: int | None = None
    timestamp: str | None = None
    stale: bool = False
    updated_at: float = field(default_factory=time.monotonic)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "bid": self.bid_price,
            "ask": self.ask_price,
            "bid_size": self.bid_size,
            "ask_size": self.ask_size,
            "last": self.last_price,
            "last_size": self.last_size,
            "timestamp": self.timestamp,
            "stale": self.stale,
        }


class AlpacaStreamManager:
    """Singleton that manages one WebSocket connection to Alpaca data stream."""

    def __init__(self) -> None:
        self._api_key: str = ""
        self._secret_key: str = ""
        self._feed: str = "iex"
        self._symbols: set[str] = set()
        self._quotes: dict[str, QuoteData] = {}
        self._clients: list[asyncio.Queue] = []
        self._task: asyncio.Task | None = None
        self._stopped = False
        self._connected = False
        self._ws = None  # websockets connection
        self._hit_connection_limit = False  # True when Alpaca rejects with 406
        self._yfinance_fallback_active = False  # True while polling yfinance during Alpaca outage

    # ── Public API ─────────────────────────────────────────────────────────

    def configure(self, api_key: str, secret_key: str, feed: str = "iex") -> None:
        self._api_key = api_key
        self._secret_key = secret_key
        self._feed = feed if feed in _FEED_URLS else "iex"

    def is_configured(self) -> bool:
        return bool(self._api_key and self._secret_key)

    @property
    def status(self) -> str:
        if not self.is_configured():
            return "unconfigured"
        if self._stopped:
            return "stopped"
        if self._connected:
            return "live"
        if self._yfinance_fallback_active:
            return "yfinance_fallback"
        return "connecting"

    @property
    def subscribed_symbols(self) -> list[str]:
        return sorted(self._symbols)

    def get_snapshot(self) -> dict[str, dict]:
        """Return latest known quotes for all subscribed symbols."""
        now = time.monotonic()
        result = {}
        for sym, q in self._quotes.items():
            q.stale = (now - q.updated_at) > STALE_SECONDS
            result[sym] = q.to_dict()
        return result

    def get_diagnostics(self) -> dict:
        return {
            "status": self.status,
            "feed": self._feed,
            "subscribed_symbols": len(self._symbols),
            "symbols": self.subscribed_symbols,
            "connected_clients": len(self._clients),
            "cached_quotes": len(self._quotes),
            "yfinance_fallback": self._yfinance_fallback_active,
        }

    async def start(self) -> None:
        if not self.is_configured():
            logger.info("AlpacaStreamManager: no API keys — streaming disabled")
            return
        self._stopped = False
        self._task = asyncio.create_task(self._run_with_backoff(), name="alpaca-stream")
        logger.info("AlpacaStreamManager started (feed=%s)", self._feed)

    async def stop(self) -> None:
        self._stopped = True
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("AlpacaStreamManager stopped")

    def subscribe(self, symbols: list[str]) -> list[str]:
        """Subscribe to symbols (up to MAX_SYMBOLS total). Returns accepted list."""
        accepted = []
        for sym in symbols:
            if len(self._symbols) >= MAX_SYMBOLS:
                break
            self._symbols.add(sym.upper())
            accepted.append(sym.upper())
        # Trigger subscription refresh if connected
        if self._connected and self._ws and accepted:
            asyncio.create_task(self._send_subscribe(accepted))
        return accepted

    def add_client(self, q: asyncio.Queue) -> None:
        self._clients.append(q)
        # Send immediate snapshot to new client
        snapshot = self.get_snapshot()
        if snapshot:
            _safe_put(q, {"type": "snapshot", "data": snapshot})

    def remove_client(self, q: asyncio.Queue) -> None:
        try:
            self._clients.remove(q)
        except ValueError:
            pass

    # ── SSE generator for FastAPI ──────────────────────────────────────────

    async def event_generator(
        self, symbols: list[str]
    ) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted strings for the requested symbols."""
        q: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE_DEPTH)

        # Ensure symbols are subscribed
        self.subscribe(symbols)
        self.add_client(q)

        # Send initial status event
        yield _sse("status", {"status": self.status})

        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=25.0)
                    # Filter to requested symbols (for quote events)
                    if event.get("type") == "quote":
                        sym = event.get("symbol", "")
                        if sym not in symbols and sym.upper() not in symbols:
                            continue
                    yield _sse(event["type"], event.get("data") or event)
                except asyncio.TimeoutError:
                    # Heartbeat to keep SSE connection alive
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self.remove_client(q)

    # ── Internal WebSocket loop ────────────────────────────────────────────

    async def _run_with_backoff(self) -> None:
        backoff = 1
        while not self._stopped:
            self._hit_connection_limit = False
            try:
                await self._connect_and_listen()
                backoff = 1  # reset on clean disconnect
            except asyncio.CancelledError:
                return
            except Exception as exc:
                logger.warning(
                    "AlpacaStream disconnected (%s), reconnecting in %ds", exc, backoff
                )
            self._connected = False
            if not self._stopped:
                if self._hit_connection_limit:
                    # 406: another connection is still alive on Alpaca's side.
                    # Poll yfinance during the wait so clients keep receiving prices.
                    wait = MAX_RECONNECT_BACKOFF
                    logger.warning(
                        "AlpacaStream: connection limit exceeded (406) — "
                        "waiting %ds for previous connection to expire; "
                        "switching to yfinance fallback", wait
                    )
                    fallback_task = asyncio.create_task(
                        self._yfinance_poll_loop(poll_interval=30.0)
                    )
                    try:
                        await asyncio.sleep(wait)
                    finally:
                        fallback_task.cancel()
                        try:
                            await fallback_task
                        except asyncio.CancelledError:
                            pass
                        self._yfinance_fallback_active = False
                        logger.info(
                            "AlpacaStream: yfinance fallback stopped, attempting Alpaca reconnect"
                        )
                        self._broadcast({"type": "status", "data": {"status": "reconnecting"}})
                else:
                    self._broadcast({"type": "status", "data": {"status": "reconnecting"}})
                    wait = backoff
                    backoff = min(backoff * 2, MAX_RECONNECT_BACKOFF)
                    await asyncio.sleep(wait)

    async def _yfinance_poll_loop(self, poll_interval: float = 30.0) -> None:
        """Poll yfinance for current prices while Alpaca stream is unavailable (406 limit)."""
        import yfinance as yf  # imported here — only used during fallback

        self._yfinance_fallback_active = True
        self._broadcast({"type": "status", "data": {"status": "yfinance_fallback"}})
        logger.info("AlpacaStream: yfinance fallback polling every %ds", poll_interval)

        while True:
            symbols = list(self._symbols)
            for sym in symbols:
                try:
                    info = yf.Ticker(sym).fast_info
                    last_price = getattr(info, "last_price", None)
                    if last_price is not None:
                        q = self._quotes.get(sym) or QuoteData(symbol=sym)
                        q.last_price = float(last_price)
                        q.stale = False
                        q.updated_at = time.monotonic()
                        self._quotes[sym] = q
                        self._broadcast({
                            "type": "quote",
                            "symbol": sym,
                            "data": {**q.to_dict(), "source": "yfinance"},
                        })
                except Exception as exc:
                    logger.debug("yfinance fallback error for %s: %s", sym, exc)
            await asyncio.sleep(poll_interval)

    async def _connect_and_listen(self) -> None:
        import websockets  # transitive dep via alpaca-py

        url = _FEED_URLS[self._feed]
        logger.info("AlpacaStream connecting to %s", url)

        async with websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=30,
            close_timeout=10,
        ) as ws:
            self._ws = ws

            # Authenticate
            await ws.send(json.dumps({
                "action": "auth",
                "key": self._api_key,
                "secret": self._secret_key,
            }))

            auth_resp = json.loads(await ws.recv())
            if not _auth_ok(auth_resp):
                logger.error("AlpacaStream auth failed: %s", auth_resp)
                raise RuntimeError(f"Alpaca stream auth failed: {auth_resp}")

            logger.info("AlpacaStream authenticated (feed=%s)", self._feed)

            # Subscribe to any symbols already queued
            if self._symbols:
                await self._send_subscribe(list(self._symbols), ws=ws)

            self._connected = True
            self._broadcast({"type": "status", "data": {"status": "live"}})

            # Listen for messages
            async for raw in ws:
                if self._stopped:
                    return
                try:
                    messages = json.loads(raw)
                    for msg in messages:
                        self._handle_message(msg)
                except Exception as exc:
                    logger.debug("AlpacaStream parse error: %s — %s", exc, raw[:200])

    async def _send_subscribe(
        self, symbols: list[str], ws=None
    ) -> None:
        target = ws or self._ws
        if not target:
            return
        try:
            await target.send(json.dumps({
                "action": "subscribe",
                "quotes": symbols,
                "trades": symbols,
            }))
            logger.debug("AlpacaStream subscribed: %s", symbols)
        except Exception as exc:
            logger.warning("AlpacaStream subscribe error: %s", exc)

    def _handle_message(self, msg: dict) -> None:
        msg_type = msg.get("T")

        if msg_type == "q":  # quote
            sym = msg.get("S", "")
            q = self._quotes.get(sym) or QuoteData(symbol=sym)
            q.bid_price = msg.get("bp")
            q.ask_price = msg.get("ap")
            q.bid_size = msg.get("bs")
            q.ask_size = msg.get("as")
            q.timestamp = msg.get("t")
            q.stale = False
            q.updated_at = time.monotonic()
            self._quotes[sym] = q
            self._broadcast({
                "type": "quote",
                "symbol": sym,
                "data": q.to_dict(),
            })

        elif msg_type == "t":  # trade
            sym = msg.get("S", "")
            q = self._quotes.get(sym) or QuoteData(symbol=sym)
            q.last_price = msg.get("p")
            q.last_size = msg.get("s")
            q.timestamp = msg.get("t")
            q.stale = False
            q.updated_at = time.monotonic()
            self._quotes[sym] = q
            self._broadcast({
                "type": "quote",
                "symbol": sym,
                "data": q.to_dict(),
            })

        elif msg_type == "error":
            code = msg.get("code")
            logger.warning("AlpacaStream error message: %s", msg)
            if code == 406:
                # Connection limit exceeded — flag so backoff uses max delay.
                # Alpaca closes the socket after sending this; the async-for
                # loop will exit naturally and _run_with_backoff will sleep
                # MAX_RECONNECT_BACKOFF seconds before the next attempt.
                self._hit_connection_limit = True

    def _broadcast(self, event: dict) -> None:
        dead = []
        for q in self._clients:
            try:
                if q.full():
                    # Evict oldest to make room
                    try:
                        q.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(event)
            except Exception:
                dead.append(q)
        for q in dead:
            self.remove_client(q)


# ── Module-level singleton ─────────────────────────────────────────────────────
stream_manager = AlpacaStreamManager()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sse(event: str, data) -> str:
    """Format an SSE event string."""
    payload = json.dumps(data) if not isinstance(data, str) else data
    return f"event: {event}\ndata: {payload}\n\n"


def _safe_put(q: asyncio.Queue, event: dict) -> None:
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass


def _auth_ok(resp) -> bool:
    """Check if Alpaca returned a successful auth response."""
    if isinstance(resp, list):
        return any(
            m.get("T") == "success" and m.get("msg") in ("authenticated", "connected")
            for m in resp
        )
    return resp.get("T") == "success"
