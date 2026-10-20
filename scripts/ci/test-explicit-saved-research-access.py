#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='saved-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55444','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55444\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE profiles(id uuid PRIMARY KEY);")
 sql('CREATE TABLE public.compound_references(id uuid PRIMARY KEY);')
 for name in ['20260602130000_reconstitution_logs.sql','20260606070000_saved_matches.sql']:
  sql((root/'supabase/migrations'/name).read_text())
 wave=(root/'supabase/migrations/20260603140000_research_v3_wave2.sql').read_text()
 start=wave.index('CREATE TABLE IF NOT EXISTS user_saved_compounds')
 end=wave.index('CREATE POLICY subs_owner_write',start)
 end=wave.index(';',end)+1
 sql(wave[start:end])
 alice='00000000-0000-0000-0000-000000000001';bob='00000000-0000-0000-0000-000000000002'
 sql(f"INSERT INTO auth.users VALUES('{alice}'),('{bob}'); INSERT INTO profiles VALUES('{alice}'),('{bob}');")
 fixture={
 'reconstitution_logs':('compound_slug',"'fixture'",'SID'),
 'user_compound_subscriptions':('compound_slug',"'fixture'",'SIUD'),
 'user_reading_queue':('compound_slug',"'fixture'",'SIUD'),
 'user_saved_compounds':('compound_slug',"'fixture'",'SIUD'),
 'user_saved_matches':('match_input,results',"'{}'::jsonb,'[]'::jsonb",'SI')}
 service_reads=['user_compound_subscriptions','user_reading_queue','user_saved_compounds']
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{alice}'; "
 for table,(columns,values,rights) in fixture.items():
  denied(session+f"SELECT * FROM {table};")
  denied(session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values});")
 migration=(root/'supabase/migrations/20261020165831_explicit_saved_research_privileges.sql').read_text()
 sql('ALTER TABLE user_saved_matches DISABLE ROW LEVEL SECURITY;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Saved research RLS drift' in r.stderr,r.stderr
 sql('ALTER TABLE user_saved_matches ENABLE ROW LEVEL SECURITY; CREATE POLICY unexpected ON user_saved_matches FOR SELECT USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Saved research policy count drift' in r.stderr,r.stderr
 sql('DROP POLICY unexpected ON user_saved_matches; ALTER POLICY "Users can view own saved matches" ON user_saved_matches USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Saved research ownership policy drift' in r.stderr,r.stderr
 sql('ALTER POLICY "Users can view own saved matches" ON user_saved_matches USING((SELECT auth.uid())=user_id);')
 sql(migration)
 for table,(columns,values,rights) in fixture.items():
  sql(f"INSERT INTO {table}(user_id,{columns}) VALUES('{bob}',{values});")
  sql(session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values}) RETURNING id;")
  assert sql(session+f"SELECT count(*) FROM {table};")=='1'
  r=run(cmd,session+f"INSERT INTO {table}(user_id,{columns}) VALUES('{bob}',{values});")
  assert r.returncode!=0 and 'row-level security' in r.stderr,r.stderr
  denied('SET ROLE anon; '+f'SELECT * FROM {table};')
  if table in service_reads:assert sql('SET ROLE service_role; '+f'SELECT count(*) FROM {table};')=='2'
  else:denied('SET ROLE service_role; '+f'SELECT * FROM {table};')
  for role in ['anon','service_role']:
   for op in [f"INSERT INTO {table}(user_id,{columns}) VALUES('{alice}',{values})",f'DELETE FROM {table}']:
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
 def matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r,p,has_table_privilege(r,c.oid,p)) ORDER BY c.relname,r,p) FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])p WHERE c.relname IN ('reconstitution_logs','user_compound_subscriptions','user_reading_queue','user_saved_compounds','user_saved_matches') AND c.relnamespace='public'::regnamespace;")
 before=matrix();sql(migration);assert matrix()==before
 assert sql("SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='S';")=='0'
 print(json.dumps({'passed':True,'tables':5,'checks':['actual-original-create-migrations-with-no-defaults','all-five-read-and-insert-fail-before','per-table-exact-required-operations-after','cross-user-insert-refused-and-reads-filtered','anon-denied-service-read-only-on-three-server-page-tables','unneeded-update-delete-denied','truncate-denied','existing-all-role-acls-preserved','policy-rls-drift-refused','initplan-and-original-own-user-policy-compatible','uuid-no-sequences']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
