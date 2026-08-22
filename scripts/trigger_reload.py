import os
from supabase import create_client

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    print("Missing Supabase credentials in environment")
    exit(1)

supabase = create_client(supabase_url, supabase_key)

# Fetch one agent product to touch
res = supabase.table("agent_products").select("id, retail_price").limit(1).execute()
if res.data:
    row_id = res.data[0]['id']
    price = res.data[0]['retail_price']
    
    # Touch it (set price to same price)
    update_res = supabase.table("agent_products").update({"retail_price": price}).eq("id", row_id).execute()
    print("Triggered Realtime reload for row", row_id)
else:
    print("No rows found")
