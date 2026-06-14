-- Security hardening (2026-06-14): remove the only public table with RLS disabled.
-- test_realtime_dummy (columns: id, text; 1 placeholder row) is a leftover from
-- early Supabase realtime testing (see the test_realtime_*.js scripts in the
-- repo root). With RLS disabled it was readable/writable by any anon caller via
-- the auto-generated PostgREST API. Dropping it closes the gap.
DROP TABLE IF EXISTS public.test_realtime_dummy;
