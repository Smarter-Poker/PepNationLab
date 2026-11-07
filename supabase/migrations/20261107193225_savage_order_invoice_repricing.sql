CREATE TABLE public.pricing_revision_records (
 batch_key text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL,
 before_state jsonb NOT NULL, after_state jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(batch_key,entity_type,entity_id)
);
ALTER TABLE public.pricing_revision_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pricing_revision_records FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.pricing_revision_records TO service_role;

CREATE FUNCTION public.reprice_contract_orders(p_owner uuid,p_start timestamptz,p_end timestamptz,p_batch text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record; i record; inv record; tx record; c record; v_before jsonb; v_after jsonb;
 v_cost numeric; v_super numeric; v_subtotal numeric; v_old_cost numeric; v_new_cost numeric;
 v_delta numeric; v_balance numeric; v_account text; v_count int:=0; v_parent uuid;
 v_bundle text; v_bundle_price numeric; v_total_weight numeric; v_running numeric;
 v_weight numeric; v_is_buy boolean;
BEGIN
 IF p_start>=p_end OR p_batch IS NULL OR length(p_batch)<8 THEN RAISE EXCEPTION 'Invalid Repricing Scope'; END IF;
 SELECT * INTO c FROM account_pricing_contracts WHERE agent_id=p_owner;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contract Not Found'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('contract-repricing:'||p_owner::text,0));
 PERFORM set_config('app.contract_order_reprice',p_batch,true);
 FOR o IN
   WITH RECURSIVE n AS(SELECT p_owner id UNION SELECT p.id FROM profiles p JOIN n ON p.parent_agent_id=n.id)
   SELECT ord.* FROM orders ord WHERE (ord.agent_id IN(SELECT id FROM n) OR ord.buyer_id IN(SELECT id FROM n))
     AND ord.created_at>=p_start AND ord.created_at<p_end ORDER BY ord.id FOR UPDATE
 LOOP
   IF EXISTS(SELECT 1 FROM pricing_revision_records WHERE batch_key=p_batch AND entity_type='order' AND entity_id=o.id) THEN CONTINUE; END IF;
   IF EXISTS(SELECT 1 FROM statement_orders WHERE order_id=o.id) THEN RAISE EXCEPTION 'Linked House Statement Requires Reconciliation: %',o.id; END IF;
   SELECT jsonb_build_object('order',to_jsonb(o),'items',jsonb_agg(to_jsonb(oi) ORDER BY oi.id)) INTO v_before
   FROM order_items oi WHERE oi.order_id=o.id;
   INSERT INTO pricing_revision_records VALUES(p_batch,'order',o.id,v_before,NULL,now());
   v_is_buy:=COALESCE(o.buyer_id=o.agent_id,false) OR COALESCE(o.is_wholesale_restock,false);
   SELECT parent_agent_id INTO v_parent FROM profiles WHERE id=o.agent_id;
   FOR i IN SELECT * FROM order_items WHERE order_id=o.id ORDER BY id FOR UPDATE LOOP
     v_bundle:=substring(i.product_name from '\[Part of: (.*)\]$');
     v_cost:=fn_contract_product_cost(o.agent_id,i.product_id,CASE WHEN v_bundle IS NULL THEN NULL ELSE v_bundle END);
     IF v_cost IS NULL THEN RAISE EXCEPTION 'Order Outside Contract: %',o.id; END IF;
     v_super:=CASE WHEN v_parent IS NOT NULL THEN fn_contract_product_cost(v_parent,i.product_id) ELSE NULL END;
     -- Allocate the listed bundle total across the recorded components. Historic
     -- partial bundles retain their quantities and are visible in the audit.
     IF v_bundle IS NOT NULL AND o.agent_id<>p_owner THEN
       SELECT COALESCE(NULLIF((b->>'custom_price')::numeric,0),sum(ap.retail_price)*(1-COALESCE((b->>'discount_percent')::numeric,0)/100))
         INTO v_bundle_price FROM agent_profiles a CROSS JOIN LATERAL jsonb_array_elements(a.bundles_config)b
         JOIN agent_products ap ON ap.agent_id=a.id AND b->'product_ids' ? ap.product_id::text
         WHERE a.id=p_owner AND lower(b->>'name')=lower(v_bundle) GROUP BY b;
       SELECT sum(ap.retail_price),sum(ap.retail_price) FILTER(WHERE oi.id<=i.id),max(ap.retail_price) FILTER(WHERE oi.id=i.id)
         INTO v_total_weight,v_running,v_weight FROM order_items oi JOIN agent_products ap ON ap.product_id=oi.product_id AND ap.agent_id=p_owner
         WHERE oi.order_id=o.id AND substring(oi.product_name from '\[Part of: (.*)\]$')=v_bundle;
       v_cost:=(round(round(v_bundle_price*c.downline_retail_factor,2)*100*v_running/v_total_weight)
         -round(round(v_bundle_price*c.downline_retail_factor,2)*100*(v_running-v_weight)/v_total_weight))/100;
     END IF;
     UPDATE order_items SET unit_cost_price=v_cost,unit_super_agent_cost=v_super,
       unit_house_cost=(SELECT COALESCE(house_cost,base_cost) FROM products WHERE id=i.product_id),
       unit_retail_price=CASE WHEN v_is_buy THEN v_cost ELSE unit_retail_price END WHERE id=i.id;
   END LOOP;
   SELECT sum(quantity*unit_retail_price) INTO v_subtotal FROM order_items WHERE order_id=o.id;
   UPDATE orders SET subtotal=v_subtotal,total=greatest(0,v_subtotal+COALESCE(shipping_cost,0)-COALESCE(discount_amount,0)-COALESCE(credits_redeemed,0)) WHERE id=o.id;
   -- Existing charges are adjusted by the difference only. Original charge and
   -- payment entries are immutable. Pending and cancelled orders gain no charge.
   IF o.status::text<>'cancelled' THEN
     FOR tx IN SELECT * FROM balance_transactions WHERE reference_id=o.id AND type='order_charge' LOOP
       SELECT sum((CASE WHEN tx.agent_id=o.agent_id THEN unit_cost_price ELSE COALESCE(unit_super_agent_cost,unit_cost_price) END)*quantity)
         INTO v_new_cost FROM order_items WHERE order_id=o.id;
       SELECT sum((CASE WHEN tx.agent_id=o.agent_id THEN (x->>'unit_cost_price')::numeric ELSE COALESCE((x->>'unit_super_agent_cost')::numeric,(x->>'unit_cost_price')::numeric) END)*(x->>'quantity')::int)
         INTO v_old_cost FROM jsonb_array_elements(v_before->'items')x;
       v_delta:=round(v_new_cost-v_old_cost,2);
       IF v_delta<>0 THEN
         SELECT account_type,CASE WHEN account_type='credit' THEN COALESCE(credit_used,0) ELSE COALESCE(prepaid_balance,0) END
           INTO v_account,v_balance FROM profiles WHERE id=tx.agent_id FOR UPDATE;
         UPDATE profiles SET credit_used=CASE WHEN v_account='credit' THEN credit_used+v_delta ELSE credit_used END,
           prepaid_balance=CASE WHEN v_account='credit' THEN prepaid_balance ELSE prepaid_balance-v_delta END WHERE id=tx.agent_id;
         INSERT INTO balance_transactions(agent_id,type,amount,balance_before,balance_after,description,reference_id,reference_type)
           VALUES(tx.agent_id,CASE WHEN v_delta>0 THEN 'debit' ELSE 'adjustment' END,abs(v_delta),v_balance,
             v_balance+CASE WHEN v_account='credit' THEN v_delta ELSE -v_delta END,
             'Owner-Directed Pricing Correction: '||p_batch,o.id,'pricing_revision');
       END IF;
     END LOOP;
   END IF;
   SELECT jsonb_build_object('order',to_jsonb(ord),'items',(SELECT jsonb_agg(to_jsonb(oi) ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id))
     INTO v_after FROM orders ord WHERE ord.id=o.id;
   UPDATE pricing_revision_records SET after_state=v_after WHERE batch_key=p_batch AND entity_type='order' AND entity_id=o.id;
   v_count:=v_count+1;
 END LOOP;
 -- Reconcile the same billed lines represented by an existing invoice, preserving
 -- paid/submitted facts. Record the old invoice alongside the new invoice.
 FOR inv IN SELECT * FROM agent_invoices WHERE super_agent_id=p_owner AND week_end>=p_start::date AND week_start<p_end::date ORDER BY id FOR UPDATE LOOP
   IF EXISTS(SELECT 1 FROM pricing_revision_records WHERE batch_key=p_batch AND entity_type='agent_invoice' AND entity_id=inv.id) THEN CONTINUE; END IF;
   SELECT COALESCE(sum((after_item->>'quantity')::int*((after_item->>'unit_cost_price')::numeric-(before_item->>'unit_cost_price')::numeric)),0)
     INTO v_delta FROM pricing_revision_records r
     CROSS JOIN LATERAL jsonb_array_elements(r.before_state->'items') before_item
     CROSS JOIN LATERAL jsonb_array_elements(r.after_state->'items') after_item
     WHERE r.batch_key=p_batch AND r.entity_type='order'
       AND before_item->>'id'=after_item->>'id'
       AND r.before_state->'order'->>'agent_id'=inv.agent_id::text
       AND r.before_state->'order'->>'status' NOT IN ('cancelled','pending_customer_payment','agent_approval_pending')
       AND COALESCE((r.before_state->'order'->>'agent_approved_at')::timestamptz,(r.before_state->'order'->>'created_at')::timestamptz)>=inv.week_start::timestamp AT TIME ZONE 'America/Chicago'
       AND COALESCE((r.before_state->'order'->>'agent_approved_at')::timestamptz,(r.before_state->'order'->>'created_at')::timestamptz)<(inv.week_end+1)::timestamp AT TIME ZONE 'America/Chicago';
   INSERT INTO pricing_revision_records VALUES(p_batch,'agent_invoice',inv.id,to_jsonb(inv),NULL,now());
   UPDATE agent_invoices SET total_cogs=total_cogs+v_delta,total_owed=total_owed+v_delta,updated_at=now() WHERE id=inv.id;
   UPDATE pricing_revision_records SET after_state=(SELECT to_jsonb(a) FROM agent_invoices a WHERE id=inv.id)
     WHERE batch_key=p_batch AND entity_type='agent_invoice' AND entity_id=inv.id;
 END LOOP;
 PERFORM set_config('app.contract_order_reprice','',true);
 RETURN jsonb_build_object('orders_repriced',v_count,'batch',p_batch);
END;
$$;
REVOKE ALL ON FUNCTION public.reprice_contract_orders(uuid,timestamptz,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reprice_contract_orders(uuid,timestamptz,timestamptz,text) TO service_role;
