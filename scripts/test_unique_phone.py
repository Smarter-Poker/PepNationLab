import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

try:
    res = supabase.table("profiles").insert({
        'id': '22222222-2222-2222-2222-222222222222',
        'phone': '708-539-2751',
        'role': 'researcher'
    }).execute()
    print("Insert success")
except Exception as e:
    print("Exception:", str(e))
