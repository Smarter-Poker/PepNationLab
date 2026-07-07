-- Perf: wrap auth.uid() as (select auth.uid()) in researcher_* RLS policies so it is
-- evaluated once per query instead of once per row (Supabase auth_rls_initplan advisor).
-- Applied to prod (ydsaqnnuwyvtyxgvrnys) via Supabase MCP as ledger version 20260707213520.
-- Scoped to researcher_* tables only. Semantically identical (owner-scoped access
-- unchanged); idempotent (skips already-wrapped policies); transactional.
DO $$
DECLARE p record;
DECLARE new_qual text;
DECLARE new_check text;
DECLARE stmt text;
BEGIN
  FOR p IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'researcher_%'
      AND ( (qual ~ 'auth\.uid\(\)'       AND qual       !~* 'select auth\.uid')
         OR (with_check ~ 'auth\.uid\(\)' AND with_check !~* 'select auth\.uid') )
  LOOP
    stmt := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF p.qual IS NOT NULL THEN
      new_qual := regexp_replace(p.qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF p.with_check IS NOT NULL THEN
      new_check := regexp_replace(p.with_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
  END LOOP;
END $$;
