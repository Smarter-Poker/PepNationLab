import os
import requests
import json

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# We can query postgres_logs using the management API if we had the access token, but we don't.
# We can't query pg_constraint via REST API directly.
# BUT we can check the migrations for `CHECK` and `UNIQUE` and `FOREIGN KEY`.
