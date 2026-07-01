import os
import urllib.request
import json

BASE = "https://ydsaqnnuwyvtyxgvrnys.supabase.co/rest/v1"
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI"
HDR = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Profile": "public"}

# Query pg_proc via postgrest if possible, or just call it and see
req = urllib.request.Request(f"{BASE}/rpc/execute_sql", data=json.dumps({"query": "SELECT prosrc FROM pg_proc WHERE proname = 'recalculate_agent_product_prices'"}).encode('utf-8'), headers={**HDR, "Content-Type": "application/json"})
try:
    print(json.loads(urllib.request.urlopen(req).read()))
except Exception as e:
    print(str(e))
