#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='journal-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55443','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55443\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY);")
 migrations=['20260608000000_lab_journal_notes.sql','20260608000001_researcher_comparisons.sql','20260608000002_lab_journal_elite_upgrades.sql','20260707180000_lab_journal_phase2.sql','20260707200000_lab_journal_phase3.sql','20260712080000_researcher_symptoms.sql']
 for name in migrations:sql((root/'supabase/migrations'/name).read_text())
 alice='00000000-0000-0000-0000-000000000001';bob='00000000-0000-0000-0000-000000000002'
 sql(f"INSERT INTO auth.users VALUES('{alice}'),('{bob}'); INSERT INTO profiles VALUES('{alice}'),('{bob}');")
 fixture={
 'researcher_biometrics':('metric_name,metric_value',"'fixture',1",'SID'),
 'researcher_comparisons':('product_ids',"ARRAY['fixture']",'SID'),
 'researcher_doses':('compound_slug,dose_amount,unit',"'fixture',1,'fixture'",'SID'),
 'researcher_goals':('goal_name',"'fixture'",'SIUD'),
 'researcher_inventory':('product_id',"'fixture'",'SIU'),
 'researcher_notes':('note_text',"'fixture'",'SIUD'),
 'researcher_scheduled_protocols':('compound_slug,amount,unit,frequency',"'fixture',1,'fixture','fixture'",'SID'),
 'researcher_symptoms':('symptom_name,severity',"'fixture',1",'SID')}
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{alice}'; "
 for table,(columns,values,rights) in fixture.items():
  denied(session+f"SELECT * FROM {table};")
  denied(session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values});")
 migration=(root/'supabase/migrations/20261020165645_explicit_lab_journal_session_privileges.sql').read_text()
 sql('ALTER TABLE researcher_notes DISABLE ROW LEVEL SECURITY;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Journal RLS drift' in r.stderr,r.stderr
 sql('ALTER TABLE researcher_notes ENABLE ROW LEVEL SECURITY; CREATE POLICY unexpected ON researcher_notes FOR SELECT USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Journal policy count drift' in r.stderr,r.stderr
 sql('DROP POLICY unexpected ON researcher_notes; ALTER POLICY "Users can view their own notes" ON researcher_notes USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Journal ownership policy drift' in r.stderr,r.stderr
 sql('ALTER POLICY "Users can view their own notes" ON researcher_notes USING((SELECT auth.uid())=user_id);')
 sql(migration)
 for table,(columns,values,rights) in fixture.items():
  sql(f"INSERT INTO {table}(user_id,{columns}) VALUES('{bob}',{values});")
  sql(session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values}) RETURNING id;")
  assert sql(session+f"SELECT count(*) FROM {table};")=='1'
  r=run(cmd,session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{bob}',{values});")
  assert r.returncode!=0 and 'row-level security' in r.stderr,r.stderr
  for role in ['anon','service_role']:
   for op in [f'SELECT * FROM {table}',f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values})",f'DELETE FROM {table}']:
    denied(f'SET ROLE {role}; '+op+';')
  if 'U' in rights:sql(session+f"UPDATE {table} SET user_id=user_id RETURNING id;")
  else:denied(session+f"UPDATE {table} SET user_id=user_id;")
  if 'D' in rights:
   sql(session+f"DELETE FROM {table};")
   assert sql(f'SELECT count(*) FROM {table};')=='1'
  else:denied(session+f'DELETE FROM {table};')
  denied(session+f'TRUNCATE {table};')
 # Existing automatic grants must remain exactly as broad as their preimage.
 sql('GRANT ALL ON '+','.join(fixture)+' TO anon,authenticated,service_role;')
 def matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r,p,has_table_privilege(r,c.oid,p)) ORDER BY c.relname,r,p) FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])p WHERE c.relname LIKE 'researcher_%' AND c.relnamespace='public'::regnamespace;")
 before=matrix();sql(migration);assert matrix()==before
 assert sql("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='S';")=='0'
 print(json.dumps({'passed':True,'tables':8,'checks':['actual-original-create-migrations-with-no-defaults','all-eight-read-and-insert-fail-before','per-table-exact-required-operations-after','cross-user-insert-refused-and-reads-filtered','anon-and-service-denied-absent-authorization','unneeded-update-delete-denied','truncate-denied','existing-all-role-acls-preserved','policy-rls-drift-refused','initplan-and-original-own-user-policy-compatible','uuid-no-sequences']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
