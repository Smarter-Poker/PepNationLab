#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='account-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55445','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55445\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT coalesce(current_setting('request.jwt.claim.role',true)='admin',false)$$; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY); CREATE TABLE orders(id uuid PRIMARY KEY); CREATE PUBLICATION supabase_realtime;")
 for name in ['20260528190000_sms_notifications.sql','20260601200002_account_round24.sql','20260604000003_notifications_table.sql','20260711160500_flash_sales.sql']:
  sql((root/'supabase/migrations'/name).read_text())
 alice='00000000-0000-0000-0000-000000000001';bob='00000000-0000-0000-0000-000000000002'
 sql(f"INSERT INTO auth.users VALUES('{alice}'),('{bob}'); INSERT INTO profiles(id) VALUES('{alice}'),('{bob}');")
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{alice}'; "
 tables=['account_export_jobs','user_sessions','notification_preferences','notifications','flash_sales']
 for table in tables:denied(session+f'SELECT * FROM {table};')
 notification=f"INSERT INTO notifications(user_id,type,title) VALUES('{alice}','system','Fixture');"
 denied('SET ROLE service_role; '+notification)
 sql('GRANT INSERT ON notifications TO service_role;')
 r=run(cmd,'SET ROLE service_role; '+notification);assert r.returncode!=0 and 'permission denied for sequence' in r.stderr,r.stderr
 sql('REVOKE INSERT ON notifications FROM service_role;')
 migration=(root/'supabase/migrations/20261020170104_explicit_account_notification_sale_privileges.sql').read_text()
 sql('CREATE POLICY unexpected ON notifications FOR SELECT USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Account policy count drift' in r.stderr,r.stderr
 sql('DROP POLICY unexpected ON notifications;')
 sql(migration)
 # Own-session queue insertion/read, service worker transitions, no session delete/update.
 sql(session+f"INSERT INTO account_export_jobs(user_id) VALUES('{alice}');")
 sql(f"INSERT INTO account_export_jobs(user_id) VALUES('{bob}');")
 assert sql(session+'SELECT count(*) FROM account_export_jobs;')=='1'
 denied(session+"UPDATE account_export_jobs SET status='completed';")
 denied(session+'DELETE FROM account_export_jobs;')
 sql("SET ROLE service_role; UPDATE account_export_jobs SET status='running';")
 # DELETE endpoint semantics require UPDATE, not DELETE privilege.
 sql(session+f"INSERT INTO user_sessions(user_id) VALUES('{alice}'); UPDATE user_sessions SET revoked_at=now();")
 denied(session+'DELETE FROM user_sessions;')
 denied('SET ROLE service_role; SELECT * FROM user_sessions;')
 # Both direct-session and authorized server preference upserts require SIU.
 sql(session+f"INSERT INTO notification_preferences(user_id) VALUES('{alice}'); UPDATE notification_preferences SET sms_enabled=true;")
 sql(f"SET ROLE service_role; INSERT INTO notification_preferences(user_id) VALUES('{bob}'); UPDATE notification_preferences SET sms_enabled=true;")
 denied(session+'DELETE FROM notification_preferences;')
 # Service insert obtains only sequence USAGE; user can mark read but cannot rewrite messages.
 sql('SET ROLE service_role; '+notification)
 sql(f"SET ROLE service_role; INSERT INTO notifications(user_id,type,title) VALUES('{bob}','system','Other');")
 assert sql(session+'SELECT count(*) FROM notifications;')=='1'
 sql(session+'UPDATE notifications SET read_at=now();')
 denied(session+"UPDATE notifications SET title='Forged';")
 denied(session+f"UPDATE notifications SET user_id='{bob}';")
 denied(session+notification)
 denied(session+'DELETE FROM notifications;')
 assert sql('SET ROLE service_role; SELECT count(*) FROM notifications;')=='2'
 sql('SET ROLE service_role; UPDATE notifications SET read_at=now();')
 for role in ['anon','authenticated']:
  denied(f"SET ROLE {role}; SELECT nextval('notifications_id_seq');")
 assert sql("SELECT has_sequence_privilege('service_role','notifications_id_seq','USAGE') AND NOT has_sequence_privilege('service_role','notifications_id_seq','SELECT,UPDATE');")=='t'
 # Public banner legitimately needs anonymous SELECT, but only current active rows pass RLS.
 sql("SET ROLE service_role; INSERT INTO flash_sales(name,starts_at,ends_at,is_active) VALUES('Active',now()-interval '1hour',now()+interval '1hour',true),('Hidden',now()-interval '1hour',now()+interval '1hour',false);")
 assert sql('SET ROLE anon; SELECT name FROM flash_sales;')=='Active'
 denied('SET ROLE anon; DELETE FROM flash_sales;')
 denied(session+"INSERT INTO flash_sales(name,ends_at) VALUES('Forged',now()+interval '1hour');")
 sql("SET ROLE service_role; UPDATE flash_sales SET banner_text='Fixture'; DELETE FROM flash_sales WHERE NOT is_active;")
 # Additive migration preserves existing broad live grants including sequence grants.
 sql('GRANT ALL ON '+','.join(tables)+' TO anon,authenticated,service_role; GRANT ALL ON SEQUENCE notifications_id_seq TO anon,authenticated,service_role;')
 def matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r,p,has_table_privilege(r,c.oid,p)) ORDER BY c.relname,r,p) FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])p WHERE c.relname IN ('account_export_jobs','user_sessions','notification_preferences','notifications','flash_sales') AND c.relnamespace='public'::regnamespace;")
 before=matrix();sql(migration);assert matrix()==before
 print(json.dumps({'passed':True,'tables':5,'checks':['actual-original-create-migrations-no-defaults','missing-table-and-independent-sequence-failure-before','caller-qualified-role-operations-after','session-owned-export-and-service-worker-transition','session-revocation-update-no-delete','session-and-service-preference-upsert','notification-read-at-only-session-update','notification-service-sequence-usage-only','public-active-sale-read-no-writes','service-sale-crud','unexpected-policy-drift-refused','existing-all-role-table-and-sequence-acls-preserved']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
