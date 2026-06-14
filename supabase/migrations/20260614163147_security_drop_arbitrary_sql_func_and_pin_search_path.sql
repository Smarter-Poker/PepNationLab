-- ============================================================================
-- Security hardening (2026-06-14, phase 2)
-- ============================================================================
-- P0: public.temp_run_sql(text) was a SECURITY DEFINER function that ran
-- `EXECUTE <arg>` (arbitrary SQL as the function owner) and had EXECUTE granted
-- to anon + PUBLIC. Any unauthenticated caller could POST /rest/v1/rpc/temp_run_sql
-- and read or mutate the ENTIRE database, fully bypassing RLS. It is referenced
-- nowhere in application code. Drop it.
DROP FUNCTION IF EXISTS public.temp_run_sql(text);

-- Lesser: two leftover SECURITY DEFINER debug helpers exposed internal database
-- topology (publication tables, replication state) to anon/PUBLIC. Unused by the
-- app (leftover from realtime debugging). Drop them.
DROP FUNCTION IF EXISTS public.fn_get_pub_tables();
DROP FUNCTION IF EXISTS public.fn_get_repl();

-- Pin a FIXED search_path on the remaining legitimate SECURITY DEFINER functions
-- so an unprivileged caller cannot hijack unqualified name resolution inside a
-- definer-rights function (closes the function_search_path_mutable advisor).
-- public+extensions covers app tables and the pgvector operators these use.
ALTER FUNCTION public.check_api_rate_limit(uuid)            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.refresh_compound_search()            SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.match_compounds_vector(vector, double precision, integer)
                                                           SET search_path = public, extensions, pg_temp;
ALTER FUNCTION public.search_compounds_rank(text, integer, integer)
                                                           SET search_path = public, extensions, pg_temp;
