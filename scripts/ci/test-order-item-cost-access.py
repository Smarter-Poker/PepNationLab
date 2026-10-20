#!/usr/bin/env python3
"""ACL-only native qualification on private PostgreSQL; never connects remotely."""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
scratch=root.parent if str(root).startswith('/Volumes/SmarterWork/agent-work/') else None
if sys.platform=='darwin' and scratch is None: raise SystemExit('Use an owned external-SSD worktree')
cluster=Path(tempfile.mkdtemp(prefix='cost-native-',dir=scratch))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
cmd=[pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55442','-U','postgres','-d','postgres']
def run(args,value=None):return subprocess.run(list(map(str,args)),input=value,text=True,capture_output=True,timeout=60,env=env)
def sql(value):
 r=run(cmd,value);assert r.returncode==0,r.stderr;return r.stdout.strip()
def denied(value):
 r=run(cmd,value);assert r.returncode!=0 and 'permission denied' in r.stderr,r.stderr
try:
 r=run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8']);assert r.returncode==0,r.stderr
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55442\nshared_buffers='16MB'\n")
 r=run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start']);assert r.returncode==0,r.stderr
 sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;")
 buyer='00000000-0000-0000-0000-000000000001';other='00000000-0000-0000-0000-000000000002'
 sql("CREATE TABLE orders(id int PRIMARY KEY,buyer_id uuid); CREATE TABLE order_items(id int,order_id int,agent_product_id uuid,product_id uuid,product_name text,quantity int,unit_retail_price numeric,created_at timestamptz,lot_number text,coa_url text,unit_cost_price numeric,unit_super_agent_cost numeric,unit_house_cost numeric,future_private text); ALTER TABLE orders ENABLE ROW LEVEL SECURITY; ALTER TABLE order_items ENABLE ROW LEVEL SECURITY; GRANT SELECT ON orders TO authenticated; GRANT SELECT,INSERT,UPDATE,DELETE ON order_items TO authenticated,service_role; GRANT SELECT ON order_items TO PUBLIC; CREATE POLICY buyer_orders ON orders FOR SELECT TO authenticated USING(buyer_id=auth.uid()); CREATE POLICY buyer_items ON order_items FOR SELECT TO authenticated USING(order_id IN(SELECT id FROM orders));")
 sql(f"INSERT INTO orders VALUES(1,'{buyer}'),(2,'{other}'); INSERT INTO order_items(id,order_id,product_name,quantity,unit_retail_price,unit_cost_price,unit_super_agent_cost,unit_house_cost) VALUES(1,1,'Item',2,50,20,10,5),(2,2,'Hidden',1,80,30,20,10);")
 session=f"SET ROLE authenticated; SET request.jwt.claim.sub='{buyer}'; "
 historical=(root/'supabase/migrations/20260605000003_audit_phase2_fixes.sql').read_text()
 sql('\n'.join(re.findall(r'REVOKE SELECT\([^;]+;',historical)))
 assert sql(session+"SELECT unit_cost_price,unit_super_agent_cost FROM order_items;")=='20|10','Historical column revokes should reproduce table SELECT bypass'
 def writes():return sql("SELECT jsonb_agg(jsonb_build_array(r,p,has_table_privilege(r,'order_items',p)) ORDER BY r,p) FROM unnest(ARRAY['anon','authenticated','service_role'])r CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE'])p;")
 before=writes()
 migration=(root/'supabase/migrations/20261020165054_order_item_cost_column_privacy.sql').read_text()
 sql('ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Expected order items RLS' in r.stderr,r.stderr
 assert writes()==before
 sql('ALTER TABLE order_items ENABLE ROW LEVEL SECURITY; ALTER TABLE order_items RENAME COLUMN coa_url TO renamed_coa;')
 r=run(cmd,migration);assert r.returncode!=0 and 'Expected order item columns missing' in r.stderr,r.stderr
 assert writes()==before
 sql('ALTER TABLE order_items RENAME COLUMN renamed_coa TO coa_url; GRANT SELECT(unit_house_cost) ON order_items TO authenticated;')
 sql(migration)
 assert sql(session+"SELECT id,order_id,product_name,quantity,unit_retail_price FROM order_items;")=='1|1|Item|2|50'
 for role in ['anon','authenticated']:
  for column in ['unit_cost_price','unit_super_agent_cost','unit_house_cost','future_private','*']:
   denied(f"SET ROLE {role}; SET request.jwt.claim.sub='{buyer}'; SELECT {column} FROM order_items;")
 assert sql("SET ROLE service_role; SELECT unit_cost_price,unit_super_agent_cost,unit_house_cost FROM order_items WHERE id=1;")=='20|10|5'
 assert writes()==before,'Write ACLs changed'
 sql('ALTER TABLE order_items ADD COLUMN future_secret text;')
 denied(session+'SELECT future_secret FROM order_items;')
 assert sql("SELECT count(*) FROM order_items;")=='2'
 print(json.dumps({'passed':True,'checks':['historical-column-revoke-bypassed-before','buyer-safe-projection-and-row-filter','both-browser-cost-and-star-denial','house-cost-and-private-column-denial','service-cost-access-retained','all-role-write-acls-unchanged','future-column-denied','rows-preserved','rls-drift-aborts','column-drift-aborts','existing-protected-column-grant-removed']}))
finally:
 if (cluster/'data/postmaster.pid').exists():
  r=run([pg/'pg_ctl','-D',cluster/'data','-m','fast','-w','stop']);assert r.returncode==0,r.stderr
 shutil.rmtree(cluster)
