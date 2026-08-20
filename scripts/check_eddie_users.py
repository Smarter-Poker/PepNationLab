import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("profiles").select("*").eq("referring_agent_id", "9af517c8-2365-46c1-afa4-77b0df3ffbc8").ilike("first_name", "%Mustafa%").execute()
print("Mustafas for Eddie R:")
for r in res.data:
    print(r['id'], r['email'], r['first_name'], r['last_name'])
