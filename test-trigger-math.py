import os
import urllib.request
import json

BASE = "https://ydsaqnnuwyvtyxgvrnys.supabase.co/rest/v1"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI"
HDR = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Profile": "public"}

def get_rpc(body):
    req = urllib.request.Request(f"{BASE}/rpc/execute_sql", data=json.dumps(body).encode('utf-8'), headers={**HDR, "Content-Type": "application/json"})
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        return str(e)

# We can't use execute_sql because it doesn't exist.
# Let's check the API directly for profiles.custom_markup_override
req = urllib.request.Request(f"{BASE}/profiles?select=custom_markup_override&limit=10&custom_markup_override=not.is.null", headers=HDR)
try:
    print(json.loads(urllib.request.urlopen(req).read()))
except Exception as e:
    print(str(e))
