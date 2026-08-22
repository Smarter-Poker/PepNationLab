import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

user_id = 'f2b0ede4-0f29-4bfc-9555-bcd3cac5e31f'
updates = {
    'first_name': 'Mustafa',
    'last_name': 'Abuajaj',
    'phone': '708-539-2751',
    'timezone': 'America/Chicago',
    'full_name': 'Mustafa Abuajaj'
}

try:
    res = supabase.table("profiles").update(updates).eq("id", user_id).execute()
    print("Success:", res.data)
except Exception as e:
    print("Exception:", str(e))
    if hasattr(e, 'response') and e.response:
        print("Response:", e.response.json())
