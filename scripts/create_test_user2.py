import os
import requests
import uuid

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

email = f"test_{uuid.uuid4().hex[:8]}@gmail.com"
password = "PepNationLabTestUser99$#"

signup_url = f"{url}/auth/v1/signup"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}
res = requests.post(signup_url, headers=headers, json={"email": email, "password": password})
data = res.json()
print("Signup response:", data)

if "access_token" in data:
    access_token = data["access_token"]
    refresh_token = data["refresh_token"]
    user_id = data["user"]["id"]
    
    # We must construct the cookie exactly as Next.js expects it.
    # supabase-auth-token: base64 encoded JSON
    
    import urllib.parse
    import json
    import base64
    
    sb_url_id = url.split("//")[1].split(".")[0] # ydsaqnnuwyvtyxgvrnys
    cookie_name = f"sb-{sb_url_id}-auth-token"
    
    # Wait, the Next.js app uses the default @supabase/ssr cookie names.
    # createServerClient uses 'sb-[project-id]-auth-token' by default unless customized.
    # In lib/supabase/server.ts, it doesn't customize the cookie name.
    
    # Actually, we can just hit the API with Authorization header? No, it uses cookies().
    # Let's just create the cookie array.
    cookie_value = json.dumps([access_token, refresh_token, None, None, None])
    # Next.js @supabase/ssr reads `sb-[project-id]-auth-token.0` and `.1` etc if chunked.
    # If not chunked, it's just the value base64 encoded.
    b64_cookie = base64.b64encode(cookie_value.encode()).decode()
    
    patch_url = "https://pepnationlab.com/api/agent/profile"
    patch_headers = {
        "Cookie": f"{cookie_name}={urllib.parse.quote(b64_cookie)}",
        "Content-Type": "application/json"
    }
    print("Sending PATCH request...")
    patch_res = requests.patch(patch_url, headers=patch_headers, json={"first_name": "Test", "last_name": "User"})
    print("Patch response:", patch_res.status_code, patch_res.text)
