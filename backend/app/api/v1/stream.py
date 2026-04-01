"""
Server-Sent Events (SSE) endpoint for real-time Alpaca market data.

GET /api/v1/stream/quotes?symbols=AAPL,MSFT
  — streams live quote/trade updates for the requested symbols.

GET /api/v1/stream/status
  — returns current stream manager diagnostics (no auth required).

Security: Alpaca credentials stay server-side only. Frontend receives
a filtered event stream through this proxy — never raw Alpaca WebSocket.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.auth.dependencies import get_current_user
from app.models.user import User
from app.services.alpaca_stream import stream_manager

router = APIRouter(prefix="/api/v1/stream", tags=["stream"])

# Max symbols a single SSE client may subscribe to
_MAX_CLIENT_SYMBOLS = 10


@router.get("/status")
async def stream_status(current_user: User = Depends(get_current_user)) -> dict:
    """Diagnostics — requires auth to prevent leaking subscribed symbols."""
    return stream_manager.get_diagnostics()


@router.get("/quotes")
async def stream_quotes(
    symbols: Annotated[str, Query(description="Comma-separated symbols, max 10")] = "",
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    SSE stream of quote/trade updates for the requested symbols.

    Events:
      event: status   data: {"status": "live"|"connecting"|"reconnecting"|...}
      event: snapshot data: {AAPL: {bid, ask, last, ...}, ...}
      event: quote    data: {symbol, bid, ask, bid_size, ask_size, last, last_size, timestamp, stale}
    """
    requested = [
        s.strip().upper()
        for s in symbols.split(",")
        if s.strip()
    ][:_MAX_CLIENT_SYMBOLS]

    if not requested:
        # Return status stream only (no quotes)
        async def status_only():
            import json
            yield f"event: status\ndata: {json.dumps(stream_manager.get_diagnostics())}\n\n"
        return StreamingResponse(status_only(), media_type="text/event-stream")

    return StreamingResponse(
        stream_manager.event_generator(requested),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering
        },
    )
