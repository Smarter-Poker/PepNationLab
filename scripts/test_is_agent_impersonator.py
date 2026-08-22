import os
from supabase import create_client
import json

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # wait, we need the authenticated user

print("Need an access token to test RLS.")
