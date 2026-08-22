import os
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

# Get savagebrands agent profile ID
agent = supabase.table("agent_profiles").select("id").eq("slug", "savagebrands").single().execute()
agent_id = agent.data["id"]

# Get their agent products
res = supabase.table("agent_products").select("product_id, custom_image_url").eq("agent_id", agent_id).execute()
print(f"Agent ID: {agent_id}")
for row in res.data:
    if row.get("custom_image_url"):
        print(f"Product {row['product_id']}: {row['custom_image_url']}")
    else:
        print(f"Product {row['product_id']}: NO CUSTOM IMAGE")
