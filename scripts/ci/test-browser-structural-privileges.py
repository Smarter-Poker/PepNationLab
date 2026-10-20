#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='acl-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55440','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
q=lambda v:'"'+v.replace('"','""')+'"'
privileges={'a':'INSERT','r':'SELECT','w':'UPDATE','d':'DELETE','D':'TRUNCATE','x':'REFERENCES','t':'TRIGGER','m':'MAINTAIN'}
fixture=json.loads((root/'tests/fixtures/public-table-acls-20261020.json').read_text())
relations=fixture['relations']
def matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r.role,p.privilege,has_table_privilege(r.role,c.oid,p.privilege)) ORDER BY c.relname,r.role,p.privilege) FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'),('service_role'))r(role) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege) WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f');")
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55440\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role; CREATE SCHEMA native_fixture; GRANT USAGE,CREATE ON SCHEMA native_fixture TO anon,authenticated;')
 setup=[]
 for c in relations:
  name='public.'+q(c['table'])
  if c['kind'] in ['r','p']:
   setup.append(f'CREATE TABLE {name}(id integer PRIMARY KEY,value text); ALTER TABLE {name} ENABLE ROW LEVEL SECURITY; CREATE POLICY deny_rows ON {name} TO anon,authenticated USING(false) WITH CHECK(false);')
  else:
   kind='MATERIALIZED VIEW' if c['kind']=='m' else 'VIEW'
   setup.append(f'CREATE {kind} {name} AS SELECT 1 AS id,NULL::text AS value;')
  for role,codes in re.findall(r'(?:^|,)(anon|authenticated|service_role|)=([a-zA-Z*]+)/[^,}]+',(c['acl'] or '').strip('{}')):
   grant=','.join(privileges[code] for code in codes if code!='*')
   if grant:setup.append(f'GRANT {grant} ON TABLE {name} TO {q(role) if role else "PUBLIC"};')
 sql('\n'.join(setup))
 sql("INSERT INTO admin_audit_log VALUES(1,'private fixture'); CREATE FUNCTION public.test_trigger_fn() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW; END$$;")
 # RLS denies the data, yet SQL TRUNCATE succeeds before the correction.
 assert sql('SET ROLE anon; SELECT count(*) FROM admin_audit_log;')=='0'
 assert sql('BEGIN; SET ROLE anon; TRUNCATE admin_audit_log; RESET ROLE; SELECT count(*) FROM admin_audit_log; ROLLBACK;')=='0'
 assert sql('SELECT count(*) FROM admin_audit_log;')=='1'
 sql('BEGIN; SET ROLE anon; CREATE TRIGGER unauthorized BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.test_trigger_fn(); ROLLBACK;')
 # Verify empty-default provisioning first, then reproduce observed old defaults.
 sql('CREATE TABLE public.native_no_default(id int); ALTER TABLE public.native_no_default ENABLE ROW LEVEL SECURITY;')
 assert sql("SELECT NOT has_table_privilege('anon','native_no_default','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN');")=='t'
 sql('CREATE ROLE native_other_owner; ALTER DEFAULT PRIVILEGES FOR ROLE native_other_owner IN SCHEMA public GRANT ALL ON TABLES TO anon; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA native_fixture GRANT ALL ON TABLES TO authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE,REFERENCES,TRIGGER,MAINTAIN,TRUNCATE ON TABLES TO anon,authenticated; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres,service_role; CREATE TABLE public.native_old_default(id int); ALTER TABLE public.native_old_default ENABLE ROW LEVEL SECURITY;')
 default_other_before=sql("SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d WHERE NOT (defaclrole='postgres'::regrole::oid AND defaclnamespace='public'::regnamespace);")
 default_dml_before=sql("SELECT jsonb_agg(jsonb_build_array(r.role,p.privilege,has_table_privilege(r.role,'native_old_default',p.privilege)) ORDER BY r.role,p.privilege) FROM (VALUES('anon'),('authenticated'),('service_role'))r(role) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege);")
 assert sql("SELECT has_table_privilege('anon','native_old_default','REFERENCES,TRIGGER,MAINTAIN');")=='t'
 before=matrix()
 policies=sql("SELECT jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,p.polname,p.polqual::text,p.polwithcheck::text) ORDER BY c.relname) FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid=c.oid WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p');")
 migration=(root/'supabase/migrations/20261020164122_browser_roles_have_no_table_maintenance_rights.sql').read_text()
 sql(migration)
 assert matrix()==before,'DML privileges changed'
 assert sql("SELECT count(*) FROM pg_class c CROSS JOIN (VALUES('anon'),('authenticated'))r(role) WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m','f') AND has_table_privilege(r.role,c.oid,'TRUNCATE,REFERENCES,TRIGGER,MAINTAIN');")=='0'
 for role in ['anon','authenticated']:
  denied(f'SET ROLE {role}; TRUNCATE admin_audit_log;')
  denied(f'SET ROLE {role}; CREATE TRIGGER unauthorized BEFORE INSERT ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION public.test_trigger_fn();')
  denied(f'SET ROLE {role}; CREATE TABLE native_fixture.unauthorized_fk(id integer REFERENCES admin_audit_log(id));')
 assert sql('SELECT count(*) FROM admin_audit_log;')=='1'
 assert policies==sql("SELECT jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,p.polname,p.polqual::text,p.polwithcheck::text) ORDER BY c.relname) FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid=c.oid WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p');")
 # Future postgres-owned tables retain original DML, but no SQL structure rights.
 sql('CREATE TABLE public.native_new_default(id int); ALTER TABLE public.native_new_default ENABLE ROW LEVEL SECURITY;')
 assert default_dml_before==sql("SELECT jsonb_agg(jsonb_build_array(r.role,p.privilege,has_table_privilege(r.role,'native_new_default',p.privilege)) ORDER BY r.role,p.privilege) FROM (VALUES('anon'),('authenticated'),('service_role'))r(role) CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'))p(privilege);")
 assert sql("SELECT count(*) FROM (VALUES('anon'),('authenticated'))r(role) WHERE has_table_privilege(r.role,'native_new_default','TRUNCATE,REFERENCES,TRIGGER,MAINTAIN');")=='0'
 assert sql("SELECT has_table_privilege('service_role','native_new_default','TRUNCATE') AND has_table_privilege('service_role','native_new_default','REFERENCES') AND has_table_privilege('service_role','native_new_default','TRIGGER') AND has_table_privilege('service_role','native_new_default','MAINTAIN');")=='t'
 assert default_other_before==sql("SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d WHERE NOT (defaclrole='postgres'::regrole::oid AND defaclnamespace='public'::regnamespace);")
 print(json.dumps({'passed':True,'relations':len(relations),'base_tables':sum(c['kind'] in ['r','p'] for c in relations),'checks':['rls-does-not-stop-truncate-before','unauthorized-trigger-before','browser-structural-denial-after','all-browser-and-service-dml-unchanged','service-structural-privileges-preserved-by-migration','all-policy-and-rls-metadata-unchanged','fixture-row-preserved','future-table-no-defaults','old-default-future-structural-denial-dml-service-unchanged','other-owner-and-schema-defaults-unchanged']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
