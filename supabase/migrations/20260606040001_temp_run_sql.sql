CREATE OR REPLACE FUNCTION public.temp_run_sql(query text)
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE query INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
