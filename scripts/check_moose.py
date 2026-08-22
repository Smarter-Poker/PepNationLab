import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("profiles").select("*").ilike("email", "%moose0320%").execute()
print(f"Found {len(res.data)} records by email.")
for r in res.data:
    print(r['id'], r['email'], r['role'])

res = supabase.table("profiles").select("*").ilike("contact_email", "%moose0320%").execute()
print(f"Found {len(res.data)} records by contact_email.")

res = supabase.table("profiles").select("*").ilike("first_name", "Mustafa").execute()
print(f"Found {len(res.data)} records by first_name.")
for r in res.data:
    print(r['id'], r['email'], r['first_name'], r['last_name'])
