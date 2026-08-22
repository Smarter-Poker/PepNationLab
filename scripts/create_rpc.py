import os
import requests

url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

sql = """
CREATE OR REPLACE FUNCTION public.get_pg_policies()
RETURNS TABLE (policyname text, tablename text, cmd text, qual text, with_check text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.policyname::text, c.relname::text, p.cmd::text, pg_get_expr(p.qual, p.polrelid)::text, pg_get_expr(p.with_check, p.polrelid)::text
  FROM pg_policy p
  JOIN pg_class c ON p.polrelid = c.oid
  WHERE c.relname = 'profiles';
END;
$$;
"""

# I can execute SQL on Supabase using the Postgres Meta API if it's enabled.
meta_url = f"{url}/pg/" # Usually not exposed.
