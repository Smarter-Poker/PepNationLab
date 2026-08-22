import os
import requests
import uuid

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

email = f"test_{uuid.uuid4().hex[:8]}@example.com"
password = "TestPassword123!"

# Sign up using REST API
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
    user_id = data["user"]["id"]
    
    # The handle_new_user trigger should have created the profile
    
    # Try updating the profile using the access token
    patch_url = "https://pepnationlab.com/api/agent/profile"
    # Actually, we should test the LOCAL API route if possible? Or just hit production since we created the user on production!
    patch_headers = {
        "Cookie": f"sb-access-token={access_token}",
        "Content-Type": "application/json"
    }
    patch_res = requests.patch(patch_url, headers=patch_headers, json={"first_name": "Test", "last_name": "User"})
    print("Patch response:", patch_res.status_code, patch_res.text)
