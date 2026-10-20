#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='ri-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55446','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55446\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr+((cluster/'server.log').read_text() if (cluster/'server.log').exists() else '')
 manifest=json.loads((root/'tests/fixtures/public-table-access-intent-20261020.json').read_text())
 snapshot=json.loads((root/'tests/fixtures/public-table-acls-20261020.json').read_text())
 migration=(root/'supabase/migrations/20261020171425_explicit_caller_qualified_public_relation_privileges.sql').read_text()
 assert len(manifest['tables'])==190 and len(manifest['sequenceCatalog'])==9 and manifest['observedPrivilegesHeldInCatalog']
 assert not manifest['unresolvedSourceCalls']
 expected=set()
 for table in manifest['tables']:
  for grant in table['grants']:
   for privilege in grant['privileges']:expected.add((table['table'],grant['role'],privilege,None))
  for grant in table['columnGrants']:
   for column in grant['columns']:expected.add((table['table'],grant['role'],grant['privilege'],column))
 declared=set()
 for privilege,columns,table,role in re.findall(r'^GRANT (SELECT|INSERT|UPDATE|DELETE)(?: \(([^)]+)\))? ON TABLE public\.([a-z_][a-z_0-9]*) TO (anon|authenticated|service_role);',migration,re.M):
  for column in columns.split(',') if columns else [None]:declared.add((table,role,privilege,column.strip() if column else None))
 assert declared==expected,'Manifest and static SQL grants differ'
 assert not any(t=='order_items' and role!='service_role' and p=='SELECT' and col is None for t,role,p,col in declared)
 assert ('products','anon','SELECT',None) in expected,'Guest nested product selection omitted'
 for table in ['messenger_messages','messenger_calls','messenger_reactions','messenger_participants','messenger_conversations']:
  assert (table,'authenticated','SELECT',None) in expected,'Browser Realtime read omitted'
 assert 'ALTER DEFAULT PRIVILEGES' not in migration
 sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE ROLE supabase_admin;')
 q=lambda v:'"'+v.replace('"','""')+'"'
 code={'a':'INSERT','r':'SELECT','w':'UPDATE','d':'DELETE','D':'TRUNCATE','x':'REFERENCES','t':'TRIGGER','m':'MAINTAIN'}
 def setup(name,live):
  sql('CREATE DATABASE '+name+';')
  cmd[-1]=name
  sql("CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role,supabase_admin; GRANT CREATE ON SCHEMA public TO supabase_admin; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;")
  statements=[]
  for table in manifest['tables']:
   relation='public.'+q(table['table'])
   if table['kind']=='r':
    columns='id bigint PRIMARY KEY,value text,user_id uuid,read_at timestamptz'
    if table['table']=='order_items':columns+=',order_id bigint,agent_product_id uuid,product_id uuid,product_name text,quantity int,unit_retail_price numeric,created_at timestamptz,lot_number text,coa_url text,unit_cost_price numeric,unit_super_agent_cost numeric,unit_house_cost numeric,future_private text'
    statements.append(f'CREATE TABLE {relation}({columns}); ALTER TABLE {relation} ENABLE ROW LEVEL SECURITY; CREATE POLICY representative_owner ON {relation} TO anon,authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());')
   else:
    kind='MATERIALIZED VIEW' if table['kind']=='m' else 'VIEW'
    options=' WITH ('+','.join(table['options'])+')' if table['kind']=='v' and table['options'] else ''
    statements.append(f'CREATE {kind} {relation}{options} AS SELECT 1::bigint id,NULL::text value,NULL::uuid user_id,NULL::timestamptz read_at;')
  sql('\n'.join(statements))
  for sequence in manifest['sequenceCatalog']:
   seq='public.'+q(sequence['sequence']);parent='public.'+q(sequence['table']);column=q(sequence['column'])
   sql(f"CREATE SEQUENCE {seq}; ALTER SEQUENCE {seq} OWNED BY {parent}.{column}; ALTER TABLE {parent} ALTER COLUMN {column} SET DEFAULT nextval('{seq}');")
  if live:
   acl_statements=[]
   for table in snapshot['relations']:
    for role,codes in re.findall(r'(?:^|,)(anon|authenticated|service_role|)=([a-zA-Z*]+)/[^,}]+',(table['acl'] or '').strip('{}')):
     privileges=','.join(code[c] for c in codes if c!='*')
     if privileges:acl_statements.append(f'GRANT {privileges} ON public.{q(table["table"])} TO {q(role) if role else "PUBLIC"};')
   for sequence in manifest['sequenceCatalog']:
    for role,codes in re.findall(r'(?:^|,)(anon|authenticated|service_role|)=([a-zA-Z*]+)/[^,}]+',(sequence['acl'] or '').strip('{}')):
     privileges=','.join({'r':'SELECT','w':'UPDATE','U':'USAGE'}[c] for c in codes if c!='*')
     if privileges:acl_statements.append(f'GRANT {privileges} ON SEQUENCE public.{q(sequence["sequence"])} TO {q(role) if role else "PUBLIC"};')
   sql('\n'.join(acl_statements))
   # The already-qualified browser structural/cost corrections precede this file.
   sql((root/'supabase/migrations/20261020164122_browser_roles_have_no_table_maintenance_rights.sql').read_text())
   sql((root/'supabase/migrations/20261020165054_order_item_cost_column_privacy.sql').read_text())
   for owner in ['postgres','supabase_admin']:
    sql(f'ALTER DEFAULT PRIVILEGES FOR ROLE {owner} IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES FOR ROLE {owner} IN SCHEMA public GRANT ALL ON SEQUENCES TO anon,authenticated,service_role;')
 def table_matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r,p,has_table_privilege(r,c.oid,p)) ORDER BY c.relname,r,p) FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])p WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','v','m');")
 def sequence_matrix():return sql("SELECT jsonb_agg(jsonb_build_array(c.relname,r,p,has_sequence_privilege(r,c.oid,p)) ORDER BY c.relname,r,p) FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['SELECT','UPDATE','USAGE'])p WHERE c.relnamespace='public'::regnamespace AND c.relkind='S';")
 setup('fresh',False)
 denied('SET ROLE service_role; SELECT * FROM agent_products;')
 denied('SET ROLE anon; SELECT * FROM agent_products;')
 denied('SET ROLE authenticated; SELECT * FROM messenger_messages;')
 for view in ['agent_storefront_analytics_30d','agent_top_search_terms_30d','product_popular_60d']:denied(f'SET ROLE service_role; SELECT * FROM {view};')
 # Admission drift refuses atomically before GRANT statements.
 sql('ALTER TABLE agent_products DISABLE ROW LEVEL SECURITY;')
 r=run(cmd,migration);assert r.returncode!=0 and 'RLS drift' in r.stderr,r.stderr
 assert sql("SELECT has_table_privilege('service_role','agent_products','SELECT');")=='f'
 sql('ALTER TABLE agent_products ENABLE ROW LEVEL SECURITY; ALTER SEQUENCE auth_events_id_seq OWNED BY NONE;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Sequence ownership drift' in r.stderr,r.stderr
 sql('ALTER SEQUENCE auth_events_id_seq OWNED BY auth_events.id;')
 sql(migration)
 for name,role,privilege,actual in json.loads(table_matrix()):
  assert actual==((name,role,privilege,None) in expected),(name,role,privilege,actual)
 for name,role,privilege,actual in json.loads(sequence_matrix()):
  assert actual==(role=='service_role' and privilege=='USAGE' and any(seq['sequence']==name for seq in manifest['sequences'])),(name,role,privilege,actual)
 # Actual representative operations; generic owner RLS is explicit test scope.
 alice='00000000-0000-0000-0000-000000000001';bob='00000000-0000-0000-0000-000000000002'
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{alice}'; "
 sql(f"SET ROLE service_role; INSERT INTO agent_products(id,user_id,value) VALUES(1,'{alice}','fixture'),(2,'{bob}','private');")
 assert sql(session+'SELECT count(*) FROM agent_products;')=='1'
 sql(session+f"INSERT INTO researcher_notes(id,user_id,value) VALUES(1,'{alice}','own fixture');")
 r=run(cmd,session+f"INSERT INTO researcher_notes(id,user_id,value) VALUES(2,'{bob}','forged fixture');");assert r.returncode!=0 and 'row-level security' in r.stderr,r.stderr
 denied(session+f"INSERT INTO agent_products(id,user_id) VALUES(3,'{bob}');")
 assert sql('SET ROLE service_role; SELECT count(*) FROM agent_storefront_analytics_30d;')=='1'
 assert sql('SET ROLE service_role; SELECT count(*) FROM product_popular_60d;')=='1'
 sql("SET ROLE service_role; INSERT INTO auth_events(value) VALUES('fixture');")
 for role in ['anon','authenticated']:denied(f'SET ROLE {role}; SELECT unit_cost_price FROM order_items;')
 assert sql(session+'SELECT count(id) FROM order_items;')=='0'
 denied(session+"UPDATE notifications SET value='forged';")
 # No default fallback for either supported creator; future objects stay closed.
 for owner in ['postgres','supabase_admin']:
  sql(f'SET ROLE {owner}; CREATE TABLE public.future_{owner}(id int); CREATE VIEW public.future_view_{owner} AS SELECT 1 id; CREATE SEQUENCE public.future_seq_{owner};')
  assert sql(f"SELECT NOT has_table_privilege('anon','future_{owner}','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('authenticated','future_{owner}','SELECT,INSERT,UPDATE,DELETE') AND NOT has_table_privilege('service_role','future_{owner}','SELECT,INSERT,UPDATE,DELETE');")=='t'
  assert sql(f"SELECT NOT has_table_privilege('anon','future_view_{owner}','SELECT') AND NOT has_table_privilege('authenticated','future_view_{owner}','SELECT') AND NOT has_table_privilege('service_role','future_view_{owner}','SELECT') AND NOT has_sequence_privilege('anon','future_seq_{owner}','USAGE,SELECT,UPDATE') AND NOT has_sequence_privilege('authenticated','future_seq_{owner}','USAGE,SELECT,UPDATE') AND NOT has_sequence_privilege('service_role','future_seq_{owner}','USAGE,SELECT,UPDATE');")=='t'
 cmd[-1]='postgres';setup('live',True)
 before=table_matrix();seqbefore=sequence_matrix();sql(migration)
 assert table_matrix()==before,'Live table privileges changed'
 assert sequence_matrix()==seqbefore,'Live sequence privileges changed'
 for role in ['anon','authenticated']:denied(f'SET ROLE {role}; SELECT unit_cost_price FROM order_items;')
 assert sql("SELECT NOT has_table_privilege('authenticated','order_items','SELECT');")=='t'
 print(json.dumps({'passed':True,'relations':190,'base_tables':180,'views_matviews':10,'sequences':9,'provisioned_relations':152,'declared_privileges':len(expected),'checks':['all-manifest-grants-match-static-sql','all-no-default-allow-deny-table-matrix','all-nine-sequence-allow-deny-matrix','dormant-owner-untracked-no-api-grants','representative-owner-rls-rows','realtime-and-nested-projection-read-edges','view-and-matview-service-reads','serial-insert-usage','drift-refuses-before-grants','two-creators-no-default-fallback','whole-live-table-sequence-acl-preservation','cost-column-privacy-not-restored'],'limits':['ACL fixture with representative RLS, not full business-schema restore; exact original-schema18table batches retained separately','No hosted behavior or production fixture writes']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
