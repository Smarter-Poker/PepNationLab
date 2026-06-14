-- ============================================================================
-- Tech-debt: drop test_realtime_rls scratch table (2026-06-14)
-- ============================================================================
-- This table was created by migration 20260604000014_test_rls.sql for a
-- one-off realtime RLS smoke test. It holds no real data. The handoff
-- security sweep confirmed RLS is ENABLED with 1 policy (not a security
-- hole), and 1 row. No application code references it.
-- ============================================================================

-- Remove from the realtime publication first (ALTER PUBLICATION does not
-- support IF NOT EXISTS for individual tables, so guard with a DO block).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'test_realtime_rls'
  ) THEN
    -- Remove from publication if it is a member (ignore error if not).
    BEGIN
      ALTER PUBLICATION supabase_realtime DROP TABLE public.test_realtime_rls;
    EXCEPTION WHEN OTHERS THEN
      NULL; -- table may not be in the publication
    END;
  END IF;
END $$;

-- Drop the table itself.
DROP TABLE IF EXISTS public.test_realtime_rls;
