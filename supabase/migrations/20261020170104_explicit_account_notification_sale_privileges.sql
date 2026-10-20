-- Caller-qualified account/session, notification and public sale privileges.
-- Keep existing broader permissions, policies, ownership and rows unchanged.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
CREATE TEMP TABLE account_access_plan_20261020(table_name text, role_name text, privilege text, column_name text) ON COMMIT DROP;
INSERT INTO account_access_plan_20261020 VALUES
('account_export_jobs','authenticated','SELECT',NULL),
('account_export_jobs','authenticated','INSERT',NULL),
('account_export_jobs','service_role','SELECT',NULL),
('account_export_jobs','service_role','UPDATE',NULL),
('user_sessions','authenticated','SELECT',NULL),
('user_sessions','authenticated','INSERT',NULL),
('user_sessions','authenticated','UPDATE',NULL),
('notification_preferences','authenticated','SELECT',NULL),
('notification_preferences','authenticated','INSERT',NULL),
('notification_preferences','authenticated','UPDATE',NULL),
('notification_preferences','service_role','SELECT',NULL),
('notification_preferences','service_role','INSERT',NULL),
('notification_preferences','service_role','UPDATE',NULL),
('notifications','authenticated','SELECT',NULL),
('notifications','authenticated','UPDATE','read_at'),
('notifications','service_role','SELECT',NULL),
('notifications','service_role','INSERT',NULL),
('notifications','service_role','UPDATE',NULL),
('flash_sales','anon','SELECT',NULL),
('flash_sales','authenticated','SELECT',NULL),
('flash_sales','service_role','SELECT',NULL),
('flash_sales','service_role','INSERT',NULL),
('flash_sales','service_role','UPDATE',NULL),
('flash_sales','service_role','DELETE',NULL);
CREATE TEMP TABLE account_policy_plan_20261020(table_name text, policy_count int, expressions text[]) ON COMMIT DROP;
INSERT INTO account_policy_plan_20261020 VALUES
('account_export_jobs',3,ARRAY['user_id=auth.uidoris_admin','is_admin']::text[]),
('user_sessions',3,ARRAY['user_id=auth.uidoris_admin']::text[]),
('notification_preferences',1,ARRAY['user_id=auth.uid']::text[]),
('notifications',2,ARRAY['auth.uid=user_id']::text[]),
('flash_sales',2,ARRAY['is_admin','is_active=trueandstarts_at<=nowandends_at>=now']::text[]);
DO $$
DECLARE item record; policy record; expression text;
BEGIN
 FOR item IN SELECT * FROM account_policy_plan_20261020 LOOP
  IF to_regclass('public.'||item.table_name) IS NULL THEN RAISE EXCEPTION 'Account table missing: %',item.table_name; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||item.table_name)) THEN RAISE EXCEPTION 'Account RLS drift'; END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name)) <> item.policy_count THEN RAISE EXCEPTION 'Account policy count drift'; END IF;
  FOR policy IN SELECT * FROM pg_policy WHERE polrelid=to_regclass('public.'||item.table_name) LOOP
   IF NOT policy.polpermissive THEN RAISE EXCEPTION 'Account policy shape drift'; END IF;
   IF policy.polcmd<>'a' AND policy.polqual IS NULL THEN RAISE EXCEPTION 'Account USING missing'; END IF;
   IF policy.polcmd IN ('a','*') AND policy.polwithcheck IS NULL THEN RAISE EXCEPTION 'Account CHECK missing'; END IF;
   FOREACH expression IN ARRAY ARRAY[pg_get_expr(policy.polqual,policy.polrelid),pg_get_expr(policy.polwithcheck,policy.polrelid)] LOOP
    IF expression IS NOT NULL THEN
     expression:=regexp_replace(lower(expression),'[[:space:]()]','','g');
     expression:=replace(replace(replace(expression,'public.',''),'selectauth.uidasuid','auth.uid'),'selectis_adminasis_admin','is_admin');
     IF NOT expression=ANY(item.expressions) THEN RAISE EXCEPTION 'Account policy expression drift: %',item.table_name; END IF;
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF EXISTS (SELECT 1 FROM (VALUES
  ('account_export_jobs',ARRAY['id','user_id','status','file_path','requested_at','completed_at']),
  ('user_sessions',ARRAY['id','user_id','device_name','user_agent','ip','last_seen','created_at','revoked_at']),
  ('notification_preferences',ARRAY['user_id','updated_at']),
  ('notifications',ARRAY['id','user_id','type','title','body','url','read_at','created_at']),
  ('flash_sales',ARRAY['id','name','banner_text','discount_pct','starts_at','ends_at','is_active','created_by','created_at'])
 )t(table_name,columns) CROSS JOIN LATERAL unnest(t.columns) expected(column_name)
 WHERE NOT EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid=to_regclass('public.'||t.table_name)
  AND a.attname=expected.column_name AND a.attnum>0 AND NOT a.attisdropped)) THEN RAISE EXCEPTION 'Account expected column drift'; END IF;
 IF pg_get_serial_sequence('public.notifications','id') IS DISTINCT FROM 'public.notifications_id_seq'
   OR NOT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.notifications'::regclass AND attname='read_at' AND atttypid='timestamptz'::regtype) THEN
  RAISE EXCEPTION 'Notification column or sequence ownership drift';
 END IF;
END $$;
CREATE TEMP TABLE account_acl_before_20261020 ON COMMIT DROP AS
 SELECT plan.table_name,r.role,p.privilege,has_table_privilege(r.role,to_regclass('public.'||plan.table_name),p.privilege) AS allowed
 FROM account_policy_plan_20261020 plan CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role)
 CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege);
CREATE TEMP TABLE account_column_before_20261020 ON COMMIT DROP AS
 SELECT plan.table_name,a.attname,r.role,p.privilege,has_column_privilege(r.role,a.attrelid,a.attname,p.privilege) AS allowed
 FROM account_policy_plan_20261020 plan JOIN pg_attribute a ON a.attrelid=to_regclass('public.'||plan.table_name) AND a.attnum>0 AND NOT a.attisdropped
 CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('REFERENCES'))p(privilege);
CREATE TEMP TABLE account_metadata_before_20261020 ON COMMIT DROP AS
 SELECT c.oid,jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid)) AS value
 FROM pg_class c JOIN account_policy_plan_20261020 plan ON c.oid=to_regclass('public.'||plan.table_name);
CREATE TEMP TABLE notification_sequence_before_20261020 ON COMMIT DROP AS
 SELECT r.role,p.privilege,has_sequence_privilege(r.role,'public.notifications_id_seq',p.privilege) AS allowed
 FROM (VALUES('anon'),('authenticated'),('service_role'))r(role) CROSS JOIN (VALUES('SELECT'),('UPDATE'),('USAGE'))p(privilege);
GRANT SELECT ON TABLE public.account_export_jobs TO authenticated;
GRANT INSERT ON TABLE public.account_export_jobs TO authenticated;
GRANT SELECT ON TABLE public.account_export_jobs TO service_role;
GRANT UPDATE ON TABLE public.account_export_jobs TO service_role;
GRANT SELECT ON TABLE public.user_sessions TO authenticated;
GRANT INSERT ON TABLE public.user_sessions TO authenticated;
GRANT UPDATE ON TABLE public.user_sessions TO authenticated;
GRANT SELECT ON TABLE public.notification_preferences TO authenticated;
GRANT INSERT ON TABLE public.notification_preferences TO authenticated;
GRANT UPDATE ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT ON TABLE public.notification_preferences TO service_role;
GRANT INSERT ON TABLE public.notification_preferences TO service_role;
GRANT UPDATE ON TABLE public.notification_preferences TO service_role;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
GRANT SELECT ON TABLE public.notifications TO service_role;
GRANT INSERT ON TABLE public.notifications TO service_role;
GRANT UPDATE ON TABLE public.notifications TO service_role;
GRANT SELECT ON TABLE public.flash_sales TO anon;
GRANT SELECT ON TABLE public.flash_sales TO authenticated;
GRANT SELECT ON TABLE public.flash_sales TO service_role;
GRANT INSERT ON TABLE public.flash_sales TO service_role;
GRANT UPDATE ON TABLE public.flash_sales TO service_role;
GRANT DELETE ON TABLE public.flash_sales TO service_role;
-- lib/notify.ts inserts BIGSERIAL notifications via service clients.
GRANT USAGE ON SEQUENCE public.notifications_id_seq TO service_role;
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM account_acl_before_20261020 before WHERE
   has_table_privilege(before.role,to_regclass('public.'||before.table_name),before.privilege) IS DISTINCT FROM
    (before.allowed OR EXISTS(SELECT 1 FROM account_access_plan_20261020 p WHERE p.table_name=before.table_name AND p.role_name=before.role AND p.privilege=before.privilege AND p.column_name IS NULL))) THEN
  RAISE EXCEPTION 'Account table privilege postflight failed';
 END IF;
 IF EXISTS (SELECT 1 FROM account_column_before_20261020 before WHERE
   has_column_privilege(before.role,to_regclass('public.'||before.table_name),before.attname,before.privilege) IS DISTINCT FROM
    (before.allowed OR EXISTS(SELECT 1 FROM account_access_plan_20261020 p WHERE p.table_name=before.table_name AND p.role_name=before.role AND p.privilege=before.privilege AND (p.column_name IS NULL OR p.column_name=before.attname)))) THEN
  RAISE EXCEPTION 'Account column privilege postflight failed';
 END IF;
 IF EXISTS (SELECT 1 FROM notification_sequence_before_20261020 before WHERE
   has_sequence_privilege(before.role,'public.notifications_id_seq',before.privilege) IS DISTINCT FROM
    (before.allowed OR (before.role='service_role' AND before.privilege='USAGE'))) THEN
  RAISE EXCEPTION 'Notification sequence postflight failed';
 END IF;
 IF EXISTS (SELECT 1 FROM account_metadata_before_20261020 before JOIN pg_class c ON c.oid=before.oid
   WHERE before.value IS DISTINCT FROM jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
   'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))) THEN RAISE EXCEPTION 'Account metadata changed'; END IF;
END $$;
COMMIT;
