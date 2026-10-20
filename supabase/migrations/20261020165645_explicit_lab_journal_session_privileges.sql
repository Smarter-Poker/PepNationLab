-- Caller-qualified explicit privileges for authenticated Lab Journal routes.
-- Add only observed operations. Existing broader live ACLs are not narrowed.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
CREATE TEMP TABLE journal_access_plan_20261020(table_name text, operations text[], policy_count int) ON COMMIT DROP;
INSERT INTO journal_access_plan_20261020 VALUES
  ('researcher_biometrics', ARRAY['SELECT','INSERT','DELETE']::text[], 3),
  ('researcher_comparisons', ARRAY['SELECT','INSERT','DELETE']::text[], 3),
  ('researcher_doses', ARRAY['SELECT','INSERT','DELETE']::text[], 4),
  ('researcher_goals', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[], 1),
  ('researcher_inventory', ARRAY['SELECT','INSERT','UPDATE']::text[], 1),
  ('researcher_notes', ARRAY['SELECT','INSERT','UPDATE','DELETE']::text[], 4),
  ('researcher_scheduled_protocols', ARRAY['SELECT','INSERT','DELETE']::text[], 1),
  ('researcher_symptoms', ARRAY['SELECT','INSERT','DELETE']::text[], 3);
DO $$
DECLARE item record; policy record; expression text;
BEGIN
  FOR item IN SELECT * FROM journal_access_plan_20261020 LOOP
    IF to_regclass('public.'||item.table_name) IS NULL THEN RAISE EXCEPTION 'Journal table missing: %',item.table_name; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||item.table_name)) THEN
      RAISE EXCEPTION 'Journal RLS drift: %',item.table_name;
    END IF;
    IF (SELECT count(*) FROM pg_attribute WHERE attrelid=to_regclass('public.'||item.table_name)
      AND attname IN ('id','user_id') AND atttypid='uuid'::regtype AND NOT attisdropped) <> 2 THEN
      RAISE EXCEPTION 'Journal identity column drift: %',item.table_name;
    END IF;
    IF (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name)) <> item.policy_count THEN
      RAISE EXCEPTION 'Journal policy count drift: %',item.table_name;
    END IF;
    FOR policy IN SELECT * FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name) LOOP
      IF policy.polroles <> ARRAY[0::oid] OR NOT policy.polpermissive OR policy.polcmd NOT IN ('r','a','w','d','*') THEN
        RAISE EXCEPTION 'Journal policy shape drift: %',item.table_name;
      END IF;
      -- Accept only the source ownership equality and its initplan optimization.
      -- This is a guard, never inference of which SQL privileges callers need.
      IF policy.polcmd <> 'a' AND policy.polqual IS NULL THEN RAISE EXCEPTION 'Journal policy USING missing'; END IF;
      IF policy.polcmd IN ('a','*') AND policy.polwithcheck IS NULL THEN RAISE EXCEPTION 'Journal policy CHECK missing'; END IF;
      FOREACH expression IN ARRAY ARRAY[pg_get_expr(policy.polqual,policy.polrelid),pg_get_expr(policy.polwithcheck,policy.polrelid)] LOOP
        IF expression IS NOT NULL THEN
          expression := replace(regexp_replace(lower(expression),'[[:space:]()]','','g'),'selectauth.uidasuid','auth.uid');
          IF expression NOT IN ('auth.uid=user_id','user_id=auth.uid') THEN
            RAISE EXCEPTION 'Journal ownership policy drift: %',item.table_name;
          END IF;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;
CREATE TEMP TABLE journal_acl_preimage_20261020 ON COMMIT DROP AS
 SELECT plan.table_name,r.role,p.privilege,
   has_table_privilege(r.role,to_regclass('public.'||plan.table_name),p.privilege) AS allowed
 FROM journal_access_plan_20261020 plan
 CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege);
CREATE TEMP TABLE journal_metadata_preimage_20261020 ON COMMIT DROP AS
 SELECT c.oid,jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid)) AS value
 FROM pg_class c JOIN journal_access_plan_20261020 plan ON c.oid=to_regclass('public.'||plan.table_name);
-- biometrics GET/POST/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, DELETE ON TABLE public.researcher_biometrics TO authenticated;
-- comparisons GET/POST/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, DELETE ON TABLE public.researcher_comparisons TO authenticated;
-- doses GET/POST/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, DELETE ON TABLE public.researcher_doses TO authenticated;
-- goals GET/POST/PUT/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.researcher_goals TO authenticated;
-- inventory GET/POST upsert; effective session actor owns user_id.
GRANT SELECT, INSERT, UPDATE ON TABLE public.researcher_inventory TO authenticated;
-- notes GET/POST/PATCH/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.researcher_notes TO authenticated;
-- protocols GET/POST/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, DELETE ON TABLE public.researcher_scheduled_protocols TO authenticated;
-- symptoms GET/POST/DELETE; effective session actor owns user_id.
GRANT SELECT, INSERT, DELETE ON TABLE public.researcher_symptoms TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM journal_acl_preimage_20261020 before
    JOIN journal_access_plan_20261020 plan USING(table_name)
    WHERE has_table_privilege(before.role,to_regclass('public.'||before.table_name),before.privilege)
      IS DISTINCT FROM (before.allowed OR (before.role='authenticated' AND before.privilege=ANY(plan.operations)))) THEN
    RAISE EXCEPTION 'Journal privilege postflight failed';
  END IF;
  IF EXISTS (SELECT 1 FROM journal_metadata_preimage_20261020 before JOIN pg_class c ON c.oid=before.oid
    WHERE before.value IS DISTINCT FROM jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))) THEN
    RAISE EXCEPTION 'Journal metadata changed';
  END IF;
END $$;
COMMIT;
