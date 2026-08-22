import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("profiles").select("*").ilike("first_name", "%Mustafa%").execute()
for r in res.data:
    print(r['id'], r['email'], r['contact_email'], r['first_name'], r['last_name'], r['phone'])

print("---")
res = supabase.table("profiles").select("*").ilike("phone", "%708%").execute()
for r in res.data:
    print(r['id'], r['email'], r['first_name'], r['phone'])
