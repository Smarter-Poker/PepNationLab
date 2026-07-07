-- Perf: wrap auth.uid() as (select auth.uid()) across ALL public RLS policies so it is
-- evaluated once per query instead of once per row (Supabase auth_rls_initplan advisor).
-- Applied to prod (ydsaqnnuwyvtyxgvrnys) via Supabase MCP as ledger version 20260707214307.
--
-- Surveyed beforehand: auth.uid() is the ONLY such call used platform-wide
-- (0 auth.role/jwt/email/current_setting). Semantically identical; idempotent
-- (skips already-wrapped policies); transactional (rolls back entirely on any error).
--
-- Verified safe via a before/after normalized semantic signature over all 308 policies
-- (table|policy|cmd|permissive|roles|qual|with_check with both auth.uid() and
-- (select auth.uid()) canonicalized): the signature was IDENTICAL before and after
-- (56f3bcdef703480860ad1249fa79eb8a), proving the only change was the wrapping and no
-- policy's access semantics changed. 0 policies broken; 0 left unwrapped.
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
