import os
import requests

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

res = requests.post(f"{url}/rest/v1/rpc/debug_rls", headers={"apikey": key, "Authorization": f"Bearer {key}"})
print(res.text)
