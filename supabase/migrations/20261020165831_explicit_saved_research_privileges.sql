-- Caller-qualified explicit privileges for authenticated saved research routes.
-- Add only observed operations. Existing broader live ACLs are not narrowed.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
CREATE TEMP TABLE saved_research_access_plan_20261020(table_name text, operations text[], policy_count int, service_read boolean) ON COMMIT DROP;
INSERT INTO saved_research_access_plan_20261020 VALUES
  ('reconstitution_logs', ARRAY['SELECT','INSERT','DELETE']::text[], 4, false),
  ('user_compound_subscriptions', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[], 2, true),
  ('user_reading_queue', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[], 2, true),
  ('user_saved_compounds', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[], 2, true),
  ('user_saved_matches', ARRAY['SELECT','INSERT']::text[], 3, false);
DO $$
DECLARE item record; policy record; expression text;
BEGIN
  FOR item IN SELECT * FROM saved_research_access_plan_20261020 LOOP
    IF to_regclass('public.'||item.table_name) IS NULL THEN RAISE EXCEPTION 'Saved research table missing: %',item.table_name; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||item.table_name)) THEN
      RAISE EXCEPTION 'Saved research RLS drift: %',item.table_name;
    END IF;
    IF (SELECT count(*) FROM pg_attribute WHERE attrelid=to_regclass('public.'||item.table_name)
      AND attname IN ('id','user_id') AND atttypid='uuid'::regtype AND NOT attisdropped) <> 2 THEN
      RAISE EXCEPTION 'Saved research identity column drift: %',item.table_name;
    END IF;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name)) <> item.policy_count THEN
      RAISE EXCEPTION 'Saved research policy count drift: %',item.table_name;
    END IF;
    FOR policy IN SELECT * FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name) LOOP
      IF (policy.polroles <> ARRAY[0::oid] AND policy.polroles <> ARRAY[(SELECT oid FROM pg_roles WHERE rolname='authenticated')]) OR NOT policy.polpermissive OR policy.polcmd NOT IN ('r','a','w','d','*') THEN
        RAISE EXCEPTION 'Saved research policy shape drift: %',item.table_name;
      END IF;
      -- Accept only the source ownership equality and its initplan optimization.
      -- This is a guard, never inference of which SQL privileges callers need.
      IF policy.polcmd <> 'a' AND policy.polqual IS NULL THEN RAISE EXCEPTION 'Saved research policy USING missing'; END IF;
      IF policy.polcmd IN ('a','*') AND policy.polwithcheck IS NULL THEN RAISE EXCEPTION 'Saved research policy CHECK missing'; END IF;
      FOREACH expression IN ARRAY ARRAY[pg_get_expr(policy.polqual,policy.polrelid),pg_get_expr(policy.polwithcheck,policy.polrelid)] LOOP
        IF expression IS NOT NULL THEN
          expression := replace(regexp_replace(lower(expression),'[[:space:]()]','','g'),'selectauth.uidasuid','auth.uid');
          IF expression NOT IN ('auth.uid=user_id','user_id=auth.uid') THEN
            RAISE EXCEPTION 'Saved research ownership policy drift: %',item.table_name;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
CREATE TEMP TABLE saved_research_acl_preimage_20261020 ON COMMIT DROP AS
 SELECT plan.table_name,r.role,p.privilege,
   has_table_privilege(r.role,to_regclass('public.'||plan.table_name),p.privilege) AS allowed
 FROM saved_research_access_plan_20261020 plan
 CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege);
CREATE TEMP TABLE saved_research_metadata_preimage_20261020 ON COMMIT DROP AS
 SELECT c.oid,jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid)) AS value
 FROM pg_class c JOIN saved_research_access_plan_20261020 plan ON c.oid=to_regclass('public.'||plan.table_name);
-- app/api/research/shelf-life/route.ts
GRANT SELECT, INSERT, DELETE ON TABLE public.reconstitution_logs TO authenticated;
-- app/api/research/subscriptions/route.ts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_compound_subscriptions TO authenticated;
-- app/research/subscriptions/page.tsx:23; signed-in user_id filter before server rendering.
GRANT SELECT ON TABLE public.user_compound_subscriptions TO service_role;
-- app/api/research/reading-queue/route.ts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_reading_queue TO authenticated;
-- app/research/reading-queue/page.tsx:23; signed-in user_id filter before server rendering.
GRANT SELECT ON TABLE public.user_reading_queue TO service_role;
-- app/api/research/saved/route.ts
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_saved_compounds TO authenticated;
-- app/research/saved/page.tsx:23; signed-in user_id filter before server rendering.
GRANT SELECT ON TABLE public.user_saved_compounds TO service_role;
-- app/research/actions.ts + components/SavedMatches.tsx
GRANT SELECT, INSERT ON TABLE public.user_saved_matches TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM saved_research_acl_preimage_20261020 before
    JOIN saved_research_access_plan_20261020 plan USING(table_name)
    WHERE has_table_privilege(before.role,to_regclass('public.'||before.table_name),before.privilege)
      IS DISTINCT FROM (before.allowed OR (before.role='authenticated' AND before.privilege=ANY(plan.operations)) OR (before.role='service_role' AND plan.service_read AND before.privilege='SELECT'))) THEN
    RAISE EXCEPTION 'Saved research privilege postflight failed';
  END IF;
  IF EXISTS (SELECT 1 FROM saved_research_metadata_preimage_20261020 before JOIN pg_class c ON c.oid=before.oid
    WHERE before.value IS DISTINCT FROM jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))) THEN
    RAISE EXCEPTION 'Saved research metadata changed';
  END IF;
END $$;
COMMIT;
