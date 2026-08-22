import os
import requests

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# Get an access token for Mustafa via admin API (sign in as him)
# Since he signed up via OAuth (Google), we can't sign in with password.
# We can generate a magic link though.
admin_api = f"{supabase_url}/auth/v1/admin/users/f2b0ede4-0f29-4bfc-9555-bcd3cac5e31f/generate-link"
headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json"
}

# Actually we can use the admin API to get their tokens
# Let me try admin generate link
res = requests.post(admin_api, headers=headers, json={
    "type": "magiclink",
    "email": "moose032017490@gmail.com"
})
print("Generate link response status:", res.status_code)
data = res.json()
print("Keys:", list(data.keys()))

if "properties" in data:
    props = data["properties"]
    print("access_token:", props.get("access_token", "NOT FOUND"))
    print("refresh_token:", props.get("refresh_token", "NOT FOUND"))
