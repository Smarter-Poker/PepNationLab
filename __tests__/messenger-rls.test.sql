-- ============================================================================
-- Messenger RLS Regression Test (Structural)
-- ----------------------------------------------------------------------------
-- Phase 15. Apply via the Supabase MCP `execute_sql` against project
-- `ydsaqnnuwyvtyxgvrnys`. Returns one row per check with `pass = true|false`
-- and a `notes` column explaining the result.
--
-- This is a STRUCTURAL test, not a behavioral one:
--
--   * Behavioral RLS testing (does the policy actually deny the wrong user
--     under live auth?) requires a Node harness that signs JWTs for fake
--     personas and round-trips them through Supabase Auth. That harness is
--     deferred -- see scripts/messenger/README.md.
--
--   * The structural test below verifies the shape of every policy on every
--     messenger_* table: RLS is on, SELECT + INSERT policies exist, UPDATE
--     policies carry a WITH CHECK, and the only `USING (true)` clause is on
--     `messenger_link_previews` (intentional -- link metadata is a shared
--     cross-user cache, vetted by Audit 8).
--
-- The script is read-only and idempotent -- it can be re-run any time.
-- ============================================================================

WITH expected_tables AS (
  SELECT unnest(ARRAY[
    'messenger_admin_messages',
    'messenger_blocked',
    'messenger_bookmarks',
    'messenger_calls',
    'messenger_conversation_labels',
    'messenger_conversations',
    'messenger_edit_history',
    'messenger_favorites',
    'messenger_labels',
    'messenger_link_previews',
    'messenger_message_dismissals',
    'messenger_messages',
    'messenger_participants',
    'messenger_pins',
    'messenger_reactions',
    'messenger_reminders',
    'messenger_reports',
    'messenger_scheduled',
    'messenger_templates',
    'messenger_themes'
  ]) AS tablename
),
check_exists AS (
  SELECT
    'exists:' || e.tablename AS check_name,
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = e.tablename
    ) AS pass,
    'Table ' || e.tablename || ' should exist in public schema' AS notes
  FROM expected_tables e
),
check_rls AS (
  SELECT
    'rls_enabled:' || e.tablename AS check_name,
    COALESCE(
      (SELECT c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = e.tablename),
      false
    ) AS pass,
    'RLS must be enabled on ' || e.tablename AS notes
  FROM expected_tables e
),
check_select_policy AS (
  SELECT
    'select_policy:' || e.tablename AS check_name,
    EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = e.tablename
        AND p.cmd IN ('SELECT', 'ALL')
    ) AS pass,
    'SELECT (or ALL) policy required on ' || e.tablename AS notes
  FROM expected_tables e
),
check_insert_policy AS (
  SELECT
    'insert_policy:' || e.tablename AS check_name,
    EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = e.tablename
        AND p.cmd IN ('INSERT', 'ALL')
    ) AS pass,
    'INSERT (or ALL) policy required on ' || e.tablename AS notes
  FROM expected_tables e
),
check_with_check AS (
  SELECT
    'with_check:' || p.tablename || ':' || p.policyname AS check_name,
    p.with_check IS NOT NULL AS pass,
    'Policy ' || p.policyname || ' on ' || p.tablename
      || ' (' || p.cmd || ') must define WITH CHECK to prevent attribution forgery'
      AS notes
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename LIKE 'messenger_%'
    AND p.cmd IN ('INSERT', 'UPDATE', 'ALL')
),
check_using_true AS (
  SELECT
    'using_true:' || p.tablename || ':' || p.policyname AS check_name,
    (p.tablename = 'messenger_link_previews' AND p.cmd = 'SELECT')
      AS pass,
    'USING (true) clause on ' || p.tablename
      || ' policy ' || p.policyname || ' must be justified -- only '
      || 'messenger_link_previews SELECT is whitelisted (Audit 8)'
      AS notes
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename LIKE 'messenger_%'
    AND (p.qual = 'true' OR p.qual = '(true)')
),
all_checks AS (
  SELECT * FROM check_exists
  UNION ALL SELECT * FROM check_rls
  UNION ALL SELECT * FROM check_select_policy
  UNION ALL SELECT * FROM check_insert_policy
  UNION ALL SELECT * FROM check_with_check
  UNION ALL SELECT * FROM check_using_true
)
SELECT
  jsonb_build_object(
    'total', (SELECT COUNT(*) FROM all_checks),
    'passed', (SELECT COUNT(*) FROM all_checks WHERE pass),
    'failed', (SELECT COUNT(*) FROM all_checks WHERE NOT pass),
    'failures', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'check', check_name,
        'notes', notes
      ))
      FROM all_checks
      WHERE NOT pass),
      '[]'::jsonb
    )
  ) AS summary;
