"""
Executes copy trades on Alpaca when a new politician disclosure is detected.
Handles both stock/ETF trades and options trades.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal, ROUND_DOWN

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import (
    MarketOrderRequest,
    LimitOrderRequest,
    GetOrdersRequest,
)
from alpaca.trading.enums import (
    OrderSide,
    TimeInForce,
    OrderStatus,
    QueryOrderStatus,
    AssetClass,
)
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestQuoteRequest

import config
import trade_tracker
from capitol_scraper import PoliticianTrade

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Alpaca client singleton
# ---------------------------------------------------------------------------

_trading_client: TradingClient | None = None
_data_client: StockHistoricalDataClient | None = None


def _get_trading_client() -> TradingClient:
    global _trading_client
    if _trading_client is None:
        paper = "paper" in config.ALPACA_ENDPOINT_URL.lower()
        # alpaca-py TradingClient adds /v2 internally — strip it from the stored URL
        _trading_client = TradingClient(
            api_key=config.ALPACA_API_KEY,
            secret_key=config.ALPACA_SECRET_KEY,
            paper=paper,
            url_override=config.ALPACA_ENDPOINT_URL.rstrip("/").removesuffix("/v2"),
        )
    return _trading_client


def _get_data_client() -> StockHistoricalDataClient:
    global _data_client
    if _data_client is None:
        _data_client = StockHistoricalDataClient(
            api_key=config.ALPACA_API_KEY,
            secret_key=config.ALPACA_SECRET_KEY,
        )
    return _data_client


# ---------------------------------------------------------------------------
# Price lookup
# ---------------------------------------------------------------------------

def _get_latest_ask(ticker: str) -> float | None:
    """Return the latest ask price for a stock/ETF via Alpaca."""
    try:
        client = _get_data_client()
        req = StockLatestQuoteRequest(symbol_or_symbols=ticker)
        quotes = client.get_stock_latest_quote(req)
        quote = quotes.get(ticker)
        if quote and quote.ask_price and quote.ask_price > 0:
            return float(quote.ask_price)
    except Exception as e:
        logger.warning(f"Could not get ask price for {ticker}: {e}")
    return None


# ---------------------------------------------------------------------------
# Order execution
# ---------------------------------------------------------------------------

def _qty_from_usd(price: float, usd: float) -> Decimal:
    """Calculate fractional shares from dollar amount."""
    if price <= 0:
        return Decimal("0")
    qty = Decimal(str(usd)) / Decimal(str(price))
    return qty.quantize(Decimal("0.000001"), rounding=ROUND_DOWN)


def _place_stock_order(
    ticker: str,
    side: OrderSide,
    usd_amount: float,
    dry_run: bool,
) -> dict:
    """Place a market order for a stock/ETF."""
    if dry_run:
        logger.info(f"[DRY RUN] Would place {side.value.upper()} ${usd_amount:.2f} of {ticker}")
        return {"order_id": f"dry_run_{ticker}_{side.value}", "status": "dry_run"}

    client = _get_trading_client()

    # Check account buying power
    account = client.get_account()
    buying_power = float(account.buying_power)
    if side == OrderSide.BUY and buying_power < usd_amount:
        logger.warning(
            f"Insufficient buying power ${buying_power:.2f} for ${usd_amount:.2f} {ticker} order"
        )
        return {"order_id": None, "status": "rejected_insufficient_funds"}

    try:
        # For sells, check if we have a position
        if side == OrderSide.SELL:
            positions = {p.symbol: p for p in client.get_all_positions()}
            if ticker not in positions:
                logger.info(f"No position in {ticker} — skipping sell signal")
                return {"order_id": None, "status": "skipped_no_position"}

        order_req = MarketOrderRequest(
            symbol=ticker,
            notional=round(usd_amount, 2),   # dollar-based (fractional shares)
            side=side,
            time_in_force=TimeInForce.DAY,
        )
        order = client.submit_order(order_req)
        logger.info(
            f"ORDER PLACED: {side.value.upper()} ${usd_amount:.2f} of {ticker} "
            f"→ order_id={order.id} status={order.status}"
        )
        return {"order_id": str(order.id), "status": str(order.status)}
    except Exception as e:
        logger.error(f"Order failed for {ticker}: {e}")
        return {"order_id": None, "status": f"error: {e}"}


def _place_options_order(
    trade: PoliticianTrade,
    side: OrderSide,
    usd_amount: float,
    dry_run: bool,
) -> dict:
    """
    Attempt to copy an options trade.
    If specific option details (strike/expiry) are unknown, falls back to stock.
    """
    if dry_run:
        option_desc = (
            f"{trade.ticker} {trade.option_type or 'call/put'} "
            f"strike={trade.option_strike or 'unknown'} exp={trade.option_expiry or 'unknown'}"
        )
        logger.info(f"[DRY RUN] Would place {side.value.upper()} option: {option_desc} ${usd_amount:.2f}")
        return {"order_id": f"dry_run_opt_{trade.ticker}_{side.value}", "status": "dry_run"}

    # Alpaca options trading requires contract symbol format: AAPL240315C00185000
    if trade.option_strike and trade.option_expiry and trade.option_type:
        try:
            exp = trade.option_expiry.replace("-", "").replace("/", "")
            if len(exp) == 8:  # YYYYMMDD → YYMMDD
                exp = exp[2:]
            strike_int = int(float(trade.option_strike) * 1000)
            cp = "C" if trade.option_type.lower() == "call" else "P"
            contract_symbol = f"{trade.ticker}{exp}{cp}{strike_int:08d}"

            # Get price via Alpaca options data
            ask_price = _get_latest_ask(contract_symbol)
            if not ask_price:
                raise ValueError(f"No ask price for {contract_symbol}")

            qty = max(1, int(usd_amount / (ask_price * 100)))  # 1 contract = 100 shares
            order_req = MarketOrderRequest(
                symbol=contract_symbol,
                qty=qty,
                side=side,
                time_in_force=TimeInForce.DAY,
            )
            client = _get_trading_client()
            order = client.submit_order(order_req)
            logger.info(f"OPTIONS ORDER: {side.value.upper()} {qty}x {contract_symbol} → {order.id}")
            return {"order_id": str(order.id), "status": str(order.status)}
        except Exception as e:
            logger.warning(f"Options order failed ({e}), falling back to underlying stock")

    # Fallback: buy the underlying stock
    logger.info(f"Falling back to underlying stock {trade.ticker} for options trade")
    return _place_stock_order(trade.ticker, side, usd_amount, dry_run)


# ---------------------------------------------------------------------------
# Main copy-trade entry point
# ---------------------------------------------------------------------------

def copy_trade(trade: PoliticianTrade) -> None:
    """
    Execute a copy of the given politician trade.
    Skips if already copied. Records result in DB.
    """
    if trade_tracker.is_trade_copied(trade.trade_id):
        logger.debug(f"Already copied trade {trade.trade_id} — skipping")
        return

    dry_run = config.DRY_RUN
    usd_amount = config.COPY_TRADE_AMOUNT

    side = OrderSide.BUY if trade.trade_type == "buy" else OrderSide.SELL

    logger.info(
        f"COPY TRADE: {trade.politician_name} | {trade.trade_type.upper()} "
        f"{trade.ticker} ({trade.asset_type}) | reported ${trade.amount_low:,.0f}–${trade.amount_high:,.0f} "
        f"| we use ${usd_amount:.2f} | dry_run={dry_run}"
    )

    is_options = "option" in trade.asset_type.lower()
    if is_options:
        result = _place_options_order(trade, side, usd_amount, dry_run)
    else:
        result = _place_stock_order(trade.ticker, side, usd_amount, dry_run)

    trade_tracker.record_copied_trade(
        trade=trade,
        alpaca_order_id=result.get("order_id"),
        alpaca_status=result.get("status", "unknown"),
        copy_amount_usd=usd_amount,
        dry_run=dry_run,
        notes=f"source_amount=${trade.amount_low:.0f}-{trade.amount_high:.0f}",
    )


def get_portfolio_summary() -> dict:
    """Return current Alpaca account summary."""
    try:
        client = _get_trading_client()
        account = client.get_account()
        positions = client.get_all_positions()
        open_orders = client.get_orders(GetOrdersRequest(status=QueryOrderStatus.OPEN))
        return {
            "equity": float(account.equity),
            "buying_power": float(account.buying_power),
            "cash": float(account.cash),
            "positions": [
                {
                    "symbol": p.symbol,
                    "qty": float(p.qty),
                    "market_value": float(p.market_value),
                    "unrealized_pl": float(p.unrealized_pl),
                    "unrealized_plpc": float(p.unrealized_plpc) * 100,
                }
                for p in positions
            ],
            "open_orders": len(open_orders),
        }
    except Exception as e:
        logger.error(f"Portfolio summary error: {e}")
        return {}
