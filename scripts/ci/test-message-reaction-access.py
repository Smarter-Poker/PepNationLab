#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='reaction-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55441','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55441\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('request.jwt.claim.role',true)='admin'$$;")
 alice='00000000-0000-0000-0000-000000000001';bob='00000000-0000-0000-0000-000000000002';eve='00000000-0000-0000-0000-000000000003'
 own='10000000-0000-0000-0000-000000000001';other='10000000-0000-0000-0000-000000000002'
 sql(f"CREATE TABLE public.internal_messages(id uuid PRIMARY KEY,sender_id uuid,receiver_id uuid); CREATE TABLE public.message_reactions(message_id uuid REFERENCES internal_messages(id),user_id uuid,emoji text); ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY; ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY; GRANT SELECT ON internal_messages TO authenticated,service_role; GRANT SELECT,INSERT,UPDATE,DELETE ON message_reactions TO authenticated,service_role; CREATE POLICY participants ON internal_messages FOR SELECT TO authenticated USING(sender_id=auth.uid() OR receiver_id=auth.uid()); CREATE POLICY \"Users can manage own reactions\" ON message_reactions FOR ALL USING(user_id=auth.uid()); INSERT INTO internal_messages VALUES('{own}','{alice}','{bob}'),('{other}','{eve}','{eve}');")
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{alice}'; "
 # Reproduce the real policy gap with an own-user reaction on an unrelated parent.
 sql(session+f"INSERT INTO message_reactions VALUES('{other}','{alice}','x');")
 sql("DELETE FROM message_reactions;")
 migration=(root/'supabase/migrations/20261020164837_message_reactions_participant_authorization.sql').read_text()
 sql('CREATE POLICY unexpected_new_policy ON message_reactions FOR SELECT USING(true);')
 r=run(cmd,migration);assert r.returncode!=0 and 'Unexpected reaction policy drift' in r.stderr,r.stderr
 assert sql("SELECT count(*) FROM pg_policy WHERE polrelid='message_reactions'::regclass AND polname='unexpected_new_policy';")=='1'
 sql('DROP POLICY unexpected_new_policy ON message_reactions; ALTER TABLE message_reactions DISABLE ROW LEVEL SECURITY;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Expected reaction and parent RLS' in r.stderr,r.stderr
 sql('ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;')
 sql(migration)
 def refused(statement):
  r=run(cmd,session+statement);assert r.returncode!=0 and 'row-level security' in r.stderr,r.stderr
 refused(f"INSERT INTO message_reactions VALUES('{other}','{alice}','x');")
 refused(f"INSERT INTO message_reactions VALUES('{own}','{bob}','x');")
 sql(session+f"INSERT INTO message_reactions VALUES('{own}','{alice}','ok');")
 assert sql(session+"SELECT count(*) FROM message_reactions;")=='1'
 refused(f"UPDATE message_reactions SET message_id='{other}';")
 refused(f"UPDATE message_reactions SET user_id='{bob}';")
 sql(f"SET ROLE service_role; INSERT INTO message_reactions VALUES('{other}','{eve}','private');")
 assert sql(session+"SELECT count(*) FROM message_reactions;")=='1'
 assert sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{bob}'; SELECT count(*) FROM message_reactions;")=='1'
 sql(f"SET ROLE authenticated; SET request.jwt.claim.sub='{bob}'; DELETE FROM message_reactions;")
 assert sql("SELECT count(*) FROM message_reactions;")=='2'
 sql(session+"DELETE FROM message_reactions;")
 assert sql("SELECT count(*) FROM message_reactions;")=='1'
 assert sql("SET ROLE anon; SELECT has_table_privilege(current_user,'message_reactions','INSERT');")=='f'
 print(json.dumps({'passed':True,'checks':['unrelated-own-user-insert-before','unrelated-parent-refused-after','forged-user-refused','own-conversation-insert-read-delete','recipient-read-no-delete-other-owner','cross-parent-update-refused','forged-owner-update-refused','other-conversation-read-filtered','service-bypass-demonstrated','anon-no-default-access','unexpected-policy-aborts-without-deletion','rls-drift-aborts']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
