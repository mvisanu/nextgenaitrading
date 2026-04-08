"""
Politician Copy Trader — Entry Point

Usage:
    python main.py                   # Start full bot (ranking + scheduler)
    python main.py --rank-only       # Just show politician rankings and exit
    python main.py --summary         # Show portfolio + copied trade history
    python main.py --dry-run         # Override DRY_RUN=true for this session
    python main.py --live            # Override DRY_RUN=false (REAL MONEY!)
    python main.py --politician slug # Set target politician for this session
"""
import argparse
import logging
import sys
from pathlib import Path

# Configure logging before importing anything else
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / "bot.log", encoding="utf-8"),
    ],
)

import config

logger = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Politician Copy Trader")
    parser.add_argument("--rank-only", action="store_true", help="Show rankings and exit")
    parser.add_argument("--summary", action="store_true", help="Show portfolio summary and exit")
    parser.add_argument("--dry-run", action="store_true", help="Force dry-run mode")
    parser.add_argument("--live", action="store_true", help="Force live trading (REAL MONEY)")
    parser.add_argument("--politician", type=str, help="Override target politician slug")
    args = parser.parse_args()

    # Apply overrides
    if args.dry_run:
        config.DRY_RUN = True
        print("[OVERRIDE] DRY_RUN = True")
    if args.live:
        config.DRY_RUN = False
        print("[OVERRIDE] DRY_RUN = False — LIVE TRADING ENABLED")
        confirm = input("Are you sure you want to trade with REAL MONEY? (yes/no): ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            return
    if args.politician:
        config.TARGET_POLITICIAN = args.politician
        print(f"[OVERRIDE] TARGET_POLITICIAN = {args.politician}")

    # Validate credentials
    if not config.validate_credentials():
        print("\nERROR: Missing Alpaca credentials. Check backend/.env or .env")
        print("Expected keys: visanu_alpaca_api_key, visanu_alpaca_secret_key")
        sys.exit(1)

    print(f"\n{'='*60}")
    print("  POLITICIAN COPY TRADER")
    print(f"  Mode: {'DRY RUN (no real orders)' if config.DRY_RUN else '*** LIVE TRADING ***'}")
    print(f"  Alpaca endpoint: {config.ALPACA_ENDPOINT_URL}")
    print(f"  Copy amount per trade: ${config.COPY_TRADE_AMOUNT:.2f}")
    print(f"  Poll interval: every {config.POLL_INTERVAL_MIN} min")
    print(f"  Target: {config.TARGET_POLITICIAN or 'auto-select best performer'}")
    print(f"{'='*60}\n")

    if args.rank_only:
        from politician_ranker import rank_politicians, print_rankings
        print("Fetching and ranking politicians (this may take a minute)...\n")
        scores = rank_politicians()
        print_rankings(scores)
        return

    if args.summary:
        import trade_tracker
        from copy_trader import get_portfolio_summary
        trade_tracker.init_db()
        from scheduler import job_morning_summary
        job_morning_summary()
        return

    # Full bot mode
    from scheduler import start_scheduler
    start_scheduler()


if __name__ == "__main__":
    main()
