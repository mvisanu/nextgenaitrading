"""
Configuration loader for politician copy trader.
Reads from backend/.env first, then falls back to local .env.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Try backend/.env first (where Visanu's Alpaca keys live)
_repo_root = Path(__file__).parent.parent
_backend_env = _repo_root / "backend" / ".env"
_local_env = Path(__file__).parent / ".env"

if _backend_env.exists():
    load_dotenv(_backend_env, override=False)
if _local_env.exists():
    load_dotenv(_local_env, override=True)


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}")
    return val


# Alpaca credentials (Visanu's account)
ALPACA_ENDPOINT_URL: str = os.getenv("visanu_alpaca_endpoint_url", "https://paper-api.alpaca.markets")
ALPACA_API_KEY: str = os.getenv("visanu_alpaca_api_key", "")
ALPACA_SECRET_KEY: str = os.getenv("visanu_alpaca_secret_key", "")

# Bot settings
COPY_TRADE_AMOUNT: float = float(os.getenv("COPY_TRADE_AMOUNT", "300"))
DRY_RUN: bool = os.getenv("DRY_RUN", "true").lower() != "false"
TARGET_POLITICIAN: str = os.getenv("TARGET_POLITICIAN", "")  # blank = auto-rank
RANK_LOOKBACK_DAYS: int = int(os.getenv("RANK_LOOKBACK_DAYS", "90"))
MIN_TRADES_TO_QUALIFY: int = int(os.getenv("MIN_TRADES_TO_QUALIFY", "5"))
POLL_INTERVAL_MIN: int = int(os.getenv("POLL_INTERVAL_MIN", "15"))
RERANK_INTERVAL_HOURS: int = int(os.getenv("RERANK_INTERVAL_HOURS", "24"))
DB_PATH: str = os.getenv("DB_PATH", str(Path(__file__).parent / "trade_history.db"))

CAPITOL_TRADES_BASE = "https://www.capitoltrades.com"

# Validate Alpaca creds exist
def validate_credentials() -> bool:
    if not ALPACA_API_KEY or not ALPACA_SECRET_KEY:
        print("[CONFIG] WARNING: Alpaca credentials not found.")
        print(f"  Expected env vars: visanu_alpaca_api_key / visanu_alpaca_secret_key")
        print(f"  Checked: {_backend_env} and {_local_env}")
        return False
    is_paper = "paper" in ALPACA_ENDPOINT_URL.lower()
    mode = "PAPER" if is_paper else "LIVE"
    print(f"[CONFIG] Alpaca [{mode}] key loaded: {ALPACA_API_KEY[:6]}***")
    return True
