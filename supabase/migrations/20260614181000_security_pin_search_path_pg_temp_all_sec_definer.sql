-- Migration: 20260614181000_security_pin_search_path_pg_temp_all_sec_definer.sql
-- 
-- Pins SET search_path = public, pg_temp on every SECURITY DEFINER function in
-- the public schema that currently only has search_path=public (without pg_temp).
-- 
-- Without pg_temp, a session that creates a temp table named the same as a real
-- function or type before calling one of these functions could redirect the lookup,
-- enabling a search_path injection attack.
--
-- This DO-block queries pg_proc for all affected functions and builds ALTER FUNCTION
-- statements dynamically, so it is safe to re-run (idempotent): functions that
-- already have pg_temp in their search_path are not touched.
--
-- Background: migration 20260602204500_universal_search_path_hardening.sql set
-- search_path=public (without pg_temp) on all SECURITY DEFINER functions as a
-- bulk operation. Later targeted migrations (post-20260614) correctly used
-- "public, pg_temp" but the earlier functions were left behind.

DO $$
DECLARE
  rec RECORD;
  func_sig TEXT;
BEGIN
  FOR rec IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef = true
      AND NOT (
        p.proconfig @> ARRAY['search_path=public, pg_temp']
        OR p.proconfig @> ARRAY['search_path=public,pg_temp']
        OR p.proconfig @> ARRAY['search_path=public, extensions, pg_temp']
      )
  LOOP
    func_sig := format('public.%I(%s)', rec.proname, rec.args);
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        func_sig
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not pin search_path for %: %', func_sig, SQLERRM;
    END;
  END LOOP;
END;
$$;
