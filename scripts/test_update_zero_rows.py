import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Try updating a non-existent ID
fake_id = '00000000-0000-0000-0000-000000000000'
updates = {'first_name': 'Nowhere'}

try:
    res = supabase.table("profiles").update(updates).eq("id", fake_id).execute()
    print("Execute returned:", res)
except Exception as e:
    print("Exception:", str(e))
    if hasattr(e, 'response') and e.response:
        print("Response:", e.response.json())
