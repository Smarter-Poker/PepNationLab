CREATE OR REPLACE FUNCTION public.fn_get_repl()
RETURNS TABLE(state text, application_name text, sync_state text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT state, application_name, sync_state FROM pg_stat_replication;
$$;
