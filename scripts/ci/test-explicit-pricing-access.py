#!/usr/bin/env python3
"""Qualify pricing contracts and audited repricing on isolated PostgreSQL only."""
import os, subprocess, tempfile, shutil, sys
from decimal import Decimal
from pathlib import Path
root=Path(__file__).resolve().parents[2]
pg=Path(os.environ.get('PG_BIN','/opt/homebrew/opt/postgresql@17/bin'))
cluster=Path(tempfile.mkdtemp(prefix='pricing-native-',dir=root.parent))
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
def run(cmd,content=None):
 r=subprocess.run(list(map(str,cmd)),input=content,text=True,capture_output=True,env=env,timeout=60)
 assert r.returncode==0,r.stderr
 return r.stdout.strip()
def sql(s):return run([pg/'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',cluster/'socket','-p','55447','-U','postgres','-d','postgres'],s)
try:
 run([pg/'initdb','-D',cluster/'data','-U','postgres','--auth-local=trust','--no-locale','--encoding=UTF8'])
 (cluster/'socket').mkdir()
 with (cluster/'data/postgresql.conf').open('a') as f:f.write(f"\nlisten_addresses=''\nunix_socket_directories='{cluster/'socket'}'\nport=55447\nshared_buffers='16MB'\n")
 run([pg/'pg_ctl','-D',cluster/'data','-l',cluster/'server.log','-w','start'])
 sql('''CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE TABLE profiles(id uuid PRIMARY KEY,parent_agent_id uuid,role text,is_manufacturer bool DEFAULT false,is_super_agent bool,is_sub_agent bool DEFAULT false,custom_markup_override numeric,commission_pct numeric,account_type text,prepaid_balance numeric DEFAULT 0,credit_used numeric DEFAULT 0);
 CREATE TABLE products(id uuid PRIMARY KEY,base_cost numeric,house_cost numeric,max_retail_price numeric,is_banned bool DEFAULT false);
 CREATE TABLE agent_profiles(id uuid PRIMARY KEY,slug text,bundles_config jsonb DEFAULT '[]',enable_dynamic_pricing boolean,enable_bulk_discounts boolean,volume_pricing_enabled boolean,updated_at timestamptz);
 CREATE TABLE agent_products(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),agent_id uuid,product_id uuid,retail_price numeric,sale_price numeric,margin_percent numeric,is_on_sale boolean,is_visible boolean,custom_name text,custom_description text,custom_image_url text,manufacturer_cost numeric,updated_at timestamptz);
 CREATE TABLE house_tiers(level int,markup numeric);
 CREATE TABLE orders(id uuid PRIMARY KEY,agent_id uuid,buyer_id uuid,created_at timestamptz,status text,is_wholesale_restock bool DEFAULT false,shipping_cost numeric DEFAULT 0,discount_amount numeric DEFAULT 0,credits_redeemed numeric DEFAULT 0,subtotal numeric,total numeric,agent_approved_at timestamptz,payment_confirmed_at timestamptz);
 CREATE TABLE order_items(id uuid PRIMARY KEY,order_id uuid,product_id uuid,product_name text,quantity int,unit_retail_price numeric,unit_cost_price numeric,unit_super_agent_cost numeric,unit_house_cost numeric);
 CREATE TABLE statement_orders(order_id uuid);
 CREATE TABLE balance_transactions(id uuid DEFAULT gen_random_uuid(),agent_id uuid,type text,amount numeric,balance_before numeric,balance_after numeric,description text,reference_id uuid,reference_type text);
 CREATE TABLE agent_invoices(id uuid PRIMARY KEY,super_agent_id uuid,agent_id uuid,week_start date,week_end date,total_cogs numeric,total_owed numeric,status text,updated_at timestamptz);
 CREATE FUNCTION fn_agent_effective_markup(uuid) RETURNS numeric LANGUAGE sql AS $$ SELECT commission_pct FROM profiles WHERE id=$1 $$;
 CREATE FUNCTION fn_resolve_house_tier_level(uuid) RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;
 INSERT INTO house_tiers VALUES(1,1);
 ''')
 ids=[f'00000000-0000-0000-0000-{i:012d}' for i in range(1,12)]
 owner,child,other,p1,p2,order,invoice,item1,item2,retailorder,retailitem=ids
 sql(f"""INSERT INTO profiles(id,role,account_type,prepaid_balance) VALUES('{owner}','super_agent','prepaid',1000),('{child}','agent','credit',0),('{other}','agent','credit',0);
 UPDATE profiles SET parent_agent_id='{owner}',commission_pct=100,credit_used=20 WHERE id='{child}';
 INSERT INTO agent_profiles(id,slug,bundles_config) VALUES('{owner}','savagebrands','[{{"name":"Test Bundle","product_ids":["{p1}","{p2}"],"custom_price":99.97,"is_active":true}}]');
 INSERT INTO products VALUES('{p1}',5,10,100,false),('{p2}',7,20,100,false);
 INSERT INTO agent_products(agent_id,product_id,retail_price,margin_percent) VALUES('{owner}','{p1}',60,0),('{owner}','{p2}',90,0),('{child}','{p1}',100,0),('{child}','{p2}',120,0);
 INSERT INTO orders(id,agent_id,buyer_id,created_at,status,subtotal,total,payment_confirmed_at) VALUES('{order}','{child}','{child}','2026-11-01','approved_pickup',20,20,'2026-11-02'),('{retailorder}','{child}','{other}','2026-11-01','approved_pickup',120,120,'2026-11-02');
 INSERT INTO order_items VALUES('{item1}','{order}','{p1}','P1 [Part of: Test Bundle]',1,10,10,10,10),('{item2}','{order}','{p2}','P2 [Part of: Test Bundle]',1,10,10,20,20),('{retailitem}','{retailorder}','{p1}','P1',1,120,10,10,10);
 INSERT INTO agent_invoices VALUES('{invoice}','{owner}','{child}','2026-10-26','2026-11-01',30,30,'open',now());
 INSERT INTO balance_transactions(agent_id,type,amount,balance_before,balance_after,reference_id) VALUES('{child}','order_charge',20,0,20,'{order}');""")
 for name in ['20261107192943_savage_store_retail_agent_contract.sql','20261107193225_savage_order_invoice_repricing.sql']:
  sql((root/'supabase/migrations'/name).read_text())
 sql((root/'supabase/migrations/20261107194641_fixed_contract_price_guards.sql').read_text())
 assert Decimal(sql(f"SELECT fn_contract_product_cost('{owner}','{p1}')"))==Decimal('15.00')
 assert Decimal(sql(f"SELECT fn_contract_product_cost('{child}','{p1}')"))==Decimal('45.00')
 assert Decimal(sql(f"SELECT fn_agent_chain_cost('{child}','{p1}')"))==Decimal('45.00')
 assert Decimal(sql(f"SELECT sum(cost) FROM fn_contract_costs('{child}',ARRAY['{p1}','{p2}']::uuid[],'Test Bundle')"))==Decimal('74.98')
 assert sql("SELECT has_table_privilege('anon','account_pricing_contracts','SELECT') OR has_function_privilege('authenticated','fn_contract_costs(uuid,uuid[],text)','EXECUTE')")=='f'
 sql(f"SELECT reprice_contract_orders('{owner}','2026-10-07','2026-11-08','test-batch-1')")
 assert Decimal(sql(f"SELECT total FROM orders WHERE id='{order}'"))==Decimal('74.98')
 assert Decimal(sql(f"SELECT total FROM orders WHERE id='{retailorder}'"))==Decimal('120')
 assert Decimal(sql(f"SELECT unit_cost_price FROM order_items WHERE id='{retailitem}'"))==Decimal('45.00')
 assert Decimal(sql(f"SELECT total_owed FROM agent_invoices WHERE id='{invoice}'"))==Decimal('119.98')
 assert Decimal(sql(f"SELECT credit_used FROM profiles WHERE id='{child}'"))==Decimal('74.98')
 assert sql(f"SELECT payment_confirmed_at IS NOT NULL FROM orders WHERE id='{order}'")=='t'
 assert sql(f"SELECT reprice_contract_orders('{owner}','2026-10-07','2026-11-08','test-batch-1')->>'orders_repriced'")=='0'
 assert Decimal(sql(f"SELECT credit_used FROM profiles WHERE id='{child}'"))==Decimal('74.98')
 new_product='00000000-0000-0000-0000-000000000012'
 sql(f"ALTER TABLE products ADD COLUMN sku text; UPDATE products SET sku='LC216' WHERE id='{p1}'; INSERT INTO products(id,base_cost,house_cost,max_retail_price,is_banned,sku) VALUES('{new_product}',4,8,80,false,'LC600'); ALTER TABLE products ADD COLUMN is_active boolean DEFAULT true; SELECT edit_store_bundles('{owner}',(SELECT bundles_config || jsonb_build_array(jsonb_build_object('name','Savage Shredder','product_ids',jsonb_build_array('{p1}','{p2}'),'custom_price',249.97)) FROM agent_profiles WHERE id='{owner}'));")
 sql((root/'supabase/migrations/20261107194439_savage_shredder_active_component.sql').read_text())
 assert sql(f"SELECT bundles_config->1->'product_ids'->>0 FROM agent_profiles WHERE id='{owner}'")==new_product
 def refuses(statement):
  try: sql(statement)
  except AssertionError: return
  raise AssertionError('Price Lock Did Not Reject Mutation')
 refuses(f"INSERT INTO order_items(id,order_id,product_id,product_name,quantity,unit_retail_price,unit_cost_price) VALUES(gen_random_uuid(),'{order}','{p1}','P1',1,1,1)")
 refuses(f"UPDATE agent_products SET retail_price=1 WHERE agent_id='{owner}'")
 refuses(f"UPDATE order_items SET unit_cost_price=1 WHERE order_id='{order}'")
 refuses(f"UPDATE agent_profiles SET volume_pricing_enabled=true WHERE id='{owner}'")
 refuses(f"UPDATE account_pricing_contracts SET downline_retail_factor=0.5 WHERE agent_id='{owner}'")
 sql(f"SELECT edit_store_product('{owner}',(SELECT id FROM agent_products WHERE agent_id='{owner}' AND product_id='{p1}'), jsonb_build_object('retail_price',61.23))")
 assert Decimal(sql(f"SELECT retail_price FROM agent_products WHERE agent_id='{owner}' AND product_id='{p1}'"))==Decimal('61.23')
 sql(f"UPDATE products SET house_cost=100 WHERE id='{p1}'")
 assert Decimal(sql(f"SELECT retail_price FROM agent_products WHERE agent_id='{owner}' AND product_id='{p1}'"))==Decimal('61.23')
 assert Decimal(sql(f"SELECT unit_cost_price FROM order_items WHERE id='{retailitem}'"))==Decimal('45.00')
 assert sql("SELECT has_function_privilege('anon','fn_agent_chain_cost(uuid,uuid)','EXECUTE')")=='f'
 print('Pricing native qualification: contract COG basis, 75% retail, exact bundle cents, private access, audited invoice correction, payment preservation and duplicate safety passed.')
finally:
 if (cluster/'data/postmaster.pid').exists():run([pg/'pg_ctl','-D',cluster/'data','-m','immediate','stop'])
 shutil.rmtree(cluster)
