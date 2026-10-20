-- Column REVOKE cannot override table-wide SELECT. Replace browser SELECT
-- with the actual safe projection; service access and all write ACLs stay intact.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $$
BEGIN
  IF to_regclass('public.order_items') IS NULL THEN RAISE EXCEPTION 'Order items missing'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.order_items'::regclass) THEN
    RAISE EXCEPTION 'Expected order items RLS';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.order_items'::regclass
      AND NOT attisdropped AND attname IN ('id','order_id','agent_product_id','product_id','product_name','quantity',
        'unit_retail_price','created_at','lot_number','coa_url','unit_cost_price','unit_super_agent_cost')) <> 12 THEN
    RAISE EXCEPTION 'Expected order item columns missing';
  END IF;
END $$;
CREATE TEMP TABLE order_item_access_preimage_20261020 ON COMMIT DROP AS
  SELECT r.role,p.privilege,has_table_privilege(r.role,'public.order_items',p.privilege) AS allowed
  FROM (VALUES('anon'),('authenticated'),('service_role'))r(role)
  CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege)
  WHERE r.role='service_role' OR p.privilege<>'SELECT';
CREATE TEMP TABLE order_item_service_columns_20261020 ON COMMIT DROP AS
  SELECT attname,has_column_privilege('service_role',attrelid,attname,'SELECT') AS allowed
  FROM pg_attribute WHERE attrelid='public.order_items'::regclass AND attnum>0 AND NOT attisdropped;
CREATE TEMP TABLE order_item_metadata_20261020 ON COMMIT DROP AS
  SELECT jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid)) AS value
  FROM pg_class c WHERE c.oid='public.order_items'::regclass;
REVOKE SELECT ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
DO $$
DECLARE columns text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO columns
  FROM pg_attribute WHERE attrelid = 'public.order_items'::regclass
    AND attnum > 0 AND NOT attisdropped;
  EXECUTE format('REVOKE SELECT (%s) ON TABLE public.order_items FROM PUBLIC, anon, authenticated', columns);
END $$;
GRANT SELECT (
  id, order_id, agent_product_id, product_id, product_name, quantity,
  unit_retail_price, created_at, lot_number, coa_url
) ON TABLE public.order_items TO authenticated;
-- Row policies still restrict these fields to the same authorized orders.
-- Costs (including unit_house_cost) and future columns remain server-only.
DO $$
BEGIN
  IF EXISTS (
    (SELECT r.role,p.privilege,has_table_privilege(r.role,'public.order_items',p.privilege)
      FROM (VALUES('anon'),('authenticated'),('service_role'))r(role)
      CROSS JOIN (VALUES('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN'))p(privilege)
      WHERE r.role='service_role' OR p.privilege<>'SELECT'
      EXCEPT SELECT * FROM order_item_access_preimage_20261020)
  ) OR EXISTS (
    (SELECT attname,has_column_privilege('service_role',attrelid,attname,'SELECT')
      FROM pg_attribute WHERE attrelid='public.order_items'::regclass AND attnum>0 AND NOT attisdropped
      EXCEPT SELECT * FROM order_item_service_columns_20261020)
  ) THEN RAISE EXCEPTION 'Order item write or service privileges changed'; END IF;
  IF EXISTS (SELECT 1 FROM (VALUES('anon'),('authenticated'))r(role)
    WHERE has_table_privilege(r.role,'public.order_items','SELECT')) THEN
    RAISE EXCEPTION 'Browser table-wide SELECT remains';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute a CROSS JOIN (VALUES('anon'),('authenticated'))r(role)
    WHERE a.attrelid='public.order_items'::regclass AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege(r.role,a.attrelid,a.attname,'SELECT') IS DISTINCT FROM
        (r.role='authenticated' AND a.attname IN ('id','order_id','agent_product_id','product_id','product_name',
          'quantity','unit_retail_price','created_at','lot_number','coa_url'))) THEN
    RAISE EXCEPTION 'Unexpected order item column privileges';
  END IF;
  IF (SELECT jsonb_build_object('owner',c.relowner,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,
      'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid=c.oid))
      FROM pg_class c WHERE c.oid='public.order_items'::regclass)
      IS DISTINCT FROM (SELECT value FROM order_item_metadata_20261020) THEN
    RAISE EXCEPTION 'Order item RLS or owner metadata changed';
  END IF;
END $$;
COMMIT;
