import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("profiles").select("id, email, first_name, last_name, role").ilike("first_name", "%Eddie%").execute()
print(res)
