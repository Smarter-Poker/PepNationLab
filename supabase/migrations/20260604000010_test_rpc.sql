CREATE OR REPLACE FUNCTION public.fn_get_pub_tables()
RETURNS TABLE(pubname name, tablename name)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT pubname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
$$;
