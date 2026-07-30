import urllib.request, json, uuid
from datetime import datetime

SUPABASE_URL = "https://ydsaqnnuwyvtyxgvrnys.supabase.co"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI"
AGENT_ID = "844dca4b-6f01-4779-bc95-bfa1e0809c0c"

bundle_names = [
    "Pretty Savage",
    "Sexy Savage",
    "Swole Savage",
    "Limitless Savage",
    "Savage Shredder",
    "Immortal Savage",
    "Savage Sleep",
    "Eternal Savage",
    "Savage Goddess"
]

new_bundles = []
for name in bundle_names:
    new_bundles.append({
        "id": str(uuid.uuid4()),
        "name": name,
        "tagline": "Custom Savage Bundle",
        "description": f"The {name} stack.",
        "image_url": None,
        "product_ids": [],
        "discount_percent": 0,
        "custom_price": None,
        "is_active": True,
        "scope": "downline",
        "created_by": AGENT_ID,
        "created_at": datetime.utcnow().isoformat() + "Z"
    })

req = urllib.request.Request(
    f"{SUPABASE_URL}/rest/v1/agent_profiles?id=eq.{AGENT_ID}",
    data=json.dumps({"bundles_config": new_bundles}).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {KEY}",
        "apikey": KEY,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    },
    method="PATCH"
)

with urllib.request.urlopen(req) as response:
    print(f"Update response status: {response.status}")
