"""
One-time setup: install dependencies and create .env from backend/.env.
Run: python setup.py
"""
import subprocess
import sys
import shutil
from pathlib import Path

HERE = Path(__file__).parent
BACKEND_ENV = HERE.parent / "backend" / ".env"
LOCAL_ENV = HERE / ".env"
EXAMPLE_ENV = HERE / ".env.example"


def main():
    print("=== Politician Copy Trader Setup ===\n")

    # 1. Install requirements
    print("Installing Python dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", str(HERE / "requirements.txt")])
    print("Dependencies installed.\n")

    # 2. Copy .env.example → .env if not exists
    if not LOCAL_ENV.exists():
        shutil.copy(EXAMPLE_ENV, LOCAL_ENV)
        print(f"Created {LOCAL_ENV} from template.")
    else:
        print(f".env already exists at {LOCAL_ENV}")

    # 3. Check backend/.env credentials
    if BACKEND_ENV.exists():
        content = BACKEND_ENV.read_text(encoding="utf-8")
        has_key = "visanu_alpaca_api_key" in content
        has_secret = "visanu_alpaca_secret_key" in content
        has_url = "visanu_alpaca_endpoint_url" in content
        print(f"\nChecking backend/.env:")
        print(f"  visanu_alpaca_endpoint_url: {'FOUND' if has_url else 'MISSING'}")
        print(f"  visanu_alpaca_api_key:      {'FOUND' if has_key else 'MISSING'}")
        print(f"  visanu_alpaca_secret_key:   {'FOUND' if has_secret else 'MISSING'}")
        if not (has_key and has_secret):
            print("\nWARNING: Add your Alpaca keys to backend/.env:")
            print("  visanu_alpaca_endpoint_url=https://paper-api.alpaca.markets")
            print("  visanu_alpaca_api_key=YOUR_KEY")
            print("  visanu_alpaca_secret_key=YOUR_SECRET")
    else:
        print(f"\nWARNING: {BACKEND_ENV} not found.")
        print("Add your Alpaca keys to politician-copy-trading/.env instead.")

    print("\nSetup complete!")
    print("\nUsage:")
    print("  python main.py --rank-only      # Preview politician rankings")
    print("  python main.py                  # Start the bot (dry run by default)")
    print("  python main.py --live           # Start with REAL money (be careful!)")


if __name__ == "__main__":
    main()
