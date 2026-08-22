import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

try:
    res = supabase.table("profiles").insert({
        'id': '11111111-1111-1111-1111-111111111111',
        'email': 'moose032017490@gmail.com',
        'role': 'researcher'
    }).execute()
    print("Insert success")
except Exception as e:
    print("Exception:", str(e))
