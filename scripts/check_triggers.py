import os
import requests

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Profile": "public" # Not needed for REST RPC but good for Postgrest
}

# Let's query pg_trigger through a quick sql via rpc if possible? No.
