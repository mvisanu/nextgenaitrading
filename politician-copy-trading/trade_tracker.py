"""
SQLite-based trade tracker.
Remembers which Capitol Trades disclosures we've already copied,
and what Alpaca orders were placed.
"""
import sqlite3
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import config
from capitol_scraper import PoliticianTrade

logger = logging.getLogger(__name__)


def _conn() -> sqlite3.Connection:
    db = sqlite3.connect(config.DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    return db


def init_db() -> None:
    with _conn() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS copied_trades (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                trade_id        TEXT UNIQUE NOT NULL,
                politician_id   TEXT NOT NULL,
                politician_name TEXT NOT NULL,
                ticker          TEXT NOT NULL,
                asset_type      TEXT NOT NULL,
                trade_type      TEXT NOT NULL,
                trade_date      TEXT NOT NULL,
                disclosure_date TEXT NOT NULL,
                amount_low      REAL,
                amount_high     REAL,
                alpaca_order_id TEXT,
                alpaca_status   TEXT DEFAULT 'pending',
                dry_run         INTEGER DEFAULT 1,
                copy_amount_usd REAL,
                created_at      TEXT NOT NULL,
                notes           TEXT
            );

            CREATE TABLE IF NOT EXISTS ranking_history (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                ran_at          TEXT NOT NULL,
                politician_id   TEXT NOT NULL,
                politician_name TEXT NOT NULL,
                score           REAL,
                win_rate        REAL,
                avg_return_pct  REAL,
                recent_trades   INTEGER,
                rank_position   INTEGER
            );

            CREATE TABLE IF NOT EXISTS bot_state (
                key   TEXT PRIMARY KEY,
                value TEXT
            );
        """)
    logger.info(f"DB initialised at {config.DB_PATH}")


def is_trade_copied(trade_id: str) -> bool:
    with _conn() as db:
        row = db.execute(
            "SELECT 1 FROM copied_trades WHERE trade_id = ?", (trade_id,)
        ).fetchone()
    return row is not None


def record_copied_trade(
    trade: PoliticianTrade,
    alpaca_order_id: str | None,
    alpaca_status: str,
    copy_amount_usd: float,
    dry_run: bool,
    notes: str = "",
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as db:
        db.execute(
            """
            INSERT OR IGNORE INTO copied_trades (
                trade_id, politician_id, politician_name,
                ticker, asset_type, trade_type,
                trade_date, disclosure_date,
                amount_low, amount_high,
                alpaca_order_id, alpaca_status,
                dry_run, copy_amount_usd, created_at, notes
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                trade.trade_id, trade.politician_id, trade.politician_name,
                trade.ticker, trade.asset_type, trade.trade_type,
                trade.trade_date.isoformat(), trade.disclosure_date.isoformat(),
                trade.amount_low, trade.amount_high,
                alpaca_order_id, alpaca_status,
                1 if dry_run else 0,
                copy_amount_usd, now, notes,
            ),
        )
    logger.info(
        f"Recorded: {trade.politician_name} | {trade.trade_type.upper()} {trade.ticker} "
        f"| order={alpaca_order_id} status={alpaca_status} dry_run={dry_run}"
    )


def update_order_status(trade_id: str, alpaca_order_id: str, status: str) -> None:
    with _conn() as db:
        db.execute(
            "UPDATE copied_trades SET alpaca_order_id=?, alpaca_status=? WHERE trade_id=?",
            (alpaca_order_id, status, trade_id),
        )


def save_ranking(scores: list) -> None:
    """Persist ranking results to DB for historical tracking."""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as db:
        for rank, s in enumerate(scores, 1):
            db.execute(
                """
                INSERT INTO ranking_history
                (ran_at, politician_id, politician_name, score, win_rate,
                 avg_return_pct, recent_trades, rank_position)
                VALUES (?,?,?,?,?,?,?,?)
                """,
                (now, s.politician_id, s.politician_name, s.score,
                 s.win_rate, s.avg_excess_return, s.recent_trade_count, rank),
            )


def get_state(key: str, default: str = "") -> str:
    with _conn() as db:
        row = db.execute("SELECT value FROM bot_state WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def set_state(key: str, value: str) -> None:
    with _conn() as db:
        db.execute(
            "INSERT OR REPLACE INTO bot_state (key, value) VALUES (?,?)",
            (key, value),
        )


def get_all_copied_trades() -> list[dict]:
    with _conn() as db:
        rows = db.execute(
            "SELECT * FROM copied_trades ORDER BY created_at DESC LIMIT 200"
        ).fetchall()
    return [dict(r) for r in rows]


def get_ranking_history(limit: int = 50) -> list[dict]:
    with _conn() as db:
        rows = db.execute(
            "SELECT * FROM ranking_history ORDER BY ran_at DESC, rank_position ASC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]
