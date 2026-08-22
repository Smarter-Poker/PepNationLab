import os
import psycopg2
from supabase import create_client

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.postgrest.api_url + "/rpc/debug_rls"
# Let's just use raw REST to query pg_constraint? No, PostgREST doesn't expose system catalogs.
