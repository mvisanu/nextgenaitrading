"""Quick test: send a minimal gold alert SMS via Twilio."""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

ACCOUNT_SID = os.environ["TWILIO_ACCOUNT_SID"]
AUTH_TOKEN  = os.environ["TWILIO_AUTH_TOKEN"]
FROM_NUMBER = os.environ["TWILIO_FROM_NUMBER"]
TO_NUMBER   = "+18509241429"

# Keep under 160 chars to stay in 1 SMS segment
body = "GOLD BUY ALERT - NextGen AI. Price crossed signal. Check app."

from twilio.rest import Client
client = Client(ACCOUNT_SID, AUTH_TOKEN)
msg = client.messages.create(body=body, from_=FROM_NUMBER, to=TO_NUMBER)
print(f"Sent! SID={msg.sid}  Status={msg.status}  Chars={len(body)}")
