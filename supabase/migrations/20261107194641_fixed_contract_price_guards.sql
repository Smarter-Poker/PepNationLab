ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_house_cost numeric;

-- No background writer may change a contracted store's posted prices.
CREATE FUNCTION public.guard_contract_product_price() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM fn_account_pricing_contract(NEW.agent_id)) AND
   (NEW.retail_price IS DISTINCT FROM OLD.retail_price OR NEW.sale_price IS DISTINCT FROM OLD.sale_price OR NEW.is_on_sale IS DISTINCT FROM OLD.is_on_sale)
   AND COALESCE(current_setting('app.contract_price_edit',true),'')<>NEW.agent_id::text THEN
   RAISE EXCEPTION 'Contract Price Is Locked. Use An Explicit Authorized Price Edit.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_product_price() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_contract_price_lock AFTER UPDATE ON public.agent_products
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_product_price();

CREATE FUNCTION public.edit_store_product(p_agent uuid,p_id uuid,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.agent_products%ROWTYPE; v_prev text; v_before jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('retail_price','margin_percent','sale_price','is_on_sale','is_visible','custom_name','custom_description','custom_image_url','manufacturer_cost','updated_at')) THEN
   RAISE EXCEPTION 'Invalid Product Edit';
 END IF;
 SELECT * INTO r FROM agent_products WHERE id=p_id AND agent_id=p_agent FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Product Not Owned By Agent'; END IF;
 v_before:=to_jsonb(r);
 r:=jsonb_populate_record(r,p_patch);
 v_prev:=current_setting('app.contract_price_edit',true);
 PERFORM set_config('app.contract_price_edit',p_agent::text,true);
 UPDATE agent_products SET retail_price=r.retail_price,margin_percent=r.margin_percent,sale_price=r.sale_price,
   is_on_sale=r.is_on_sale,is_visible=r.is_visible,custom_name=r.custom_name,custom_description=r.custom_description,
   custom_image_url=r.custom_image_url,manufacturer_cost=r.manufacturer_cost,updated_at=now()
 WHERE id=p_id AND agent_id=p_agent;
 IF EXISTS(SELECT 1 FROM fn_account_pricing_contract(p_agent)) THEN
   INSERT INTO pricing_revision_records(batch_key,entity_type,entity_id,before_state,after_state)
   SELECT 'explicit-price-edit:'||gen_random_uuid()::text,'product_price',p_id,v_before,to_jsonb(ap)
   FROM agent_products ap WHERE ap.id=p_id;
 END IF;
 PERFORM set_config('app.contract_price_edit',COALESCE(v_prev,''),true);
END;
$$;
REVOKE ALL ON FUNCTION public.edit_store_product(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edit_store_product(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.guard_contract_store_prices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old jsonb; v_new jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM fn_account_pricing_contract(NEW.id)) THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' THEN
   NEW.enable_dynamic_pricing:=false; NEW.enable_bulk_discounts:=false; NEW.volume_pricing_enabled:=false; RETURN NEW;
 END IF;
 IF COALESCE(NEW.enable_dynamic_pricing,false) OR COALESCE(NEW.enable_bulk_discounts,false) OR COALESCE(NEW.volume_pricing_enabled,false) THEN
   RAISE EXCEPTION 'Automatic Price Adjustments Are Disabled For Fixed Contract Stores.';
 END IF;
 SELECT jsonb_agg(jsonb_build_array(b->>'id',b->'custom_price',b->'discount_percent') ORDER BY b->>'id') INTO v_old FROM jsonb_array_elements(OLD.bundles_config)b;
 SELECT jsonb_agg(jsonb_build_array(b->>'id',b->'custom_price',b->'discount_percent') ORDER BY b->>'id') INTO v_new FROM jsonb_array_elements(NEW.bundles_config)b;
 IF v_old IS DISTINCT FROM v_new AND COALESCE(current_setting('app.contract_price_edit',true),'')<>NEW.id::text THEN
   RAISE EXCEPTION 'Bundle Prices Are Locked. Use An Explicit Authorized Bundle Edit.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_store_prices() FROM PUBLIC,anon,authenticated;
-- Disable automatic discounts before installing the permanent guard.
UPDATE public.agent_profiles ap SET enable_dynamic_pricing=false,enable_bulk_discounts=false,volume_pricing_enabled=false
WHERE EXISTS(SELECT 1 FROM fn_account_pricing_contract(ap.id));
CREATE TRIGGER trg_00_contract_store_price_lock BEFORE INSERT OR UPDATE ON public.agent_profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_store_prices();

CREATE FUNCTION public.edit_store_bundles(p_agent uuid,p_bundles jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prev text; v_before jsonb;
BEGIN
 SELECT bundles_config INTO v_before FROM agent_profiles WHERE id=p_agent FOR UPDATE;
 IF jsonb_typeof(p_bundles)<>'array' THEN RAISE EXCEPTION 'Invalid Bundle Configuration'; END IF;
 v_prev:=current_setting('app.contract_price_edit',true);
 PERFORM set_config('app.contract_price_edit',p_agent::text,true);
 UPDATE agent_profiles SET bundles_config=p_bundles,updated_at=now() WHERE id=p_agent;
 IF NOT FOUND THEN RAISE EXCEPTION 'Store Not Found'; END IF;
 IF EXISTS(SELECT 1 FROM fn_account_pricing_contract(p_agent)) THEN
   INSERT INTO pricing_revision_records(batch_key,entity_type,entity_id,before_state,after_state)
   VALUES('explicit-bundle-edit:'||gen_random_uuid()::text,'bundle_price',p_agent,v_before,p_bundles);
 END IF;
 PERFORM set_config('app.contract_price_edit',COALESCE(v_prev,''),true);
END;
$$;
REVOKE ALL ON FUNCTION public.edit_store_bundles(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.edit_store_bundles(uuid,jsonb) TO service_role;

CREATE FUNCTION public.guard_contract_order_prices() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM orders o CROSS JOIN LATERAL fn_account_pricing_contract(o.agent_id)c WHERE o.id=NEW.order_id)
   AND (NEW.unit_retail_price IS DISTINCT FROM OLD.unit_retail_price OR NEW.unit_cost_price IS DISTINCT FROM OLD.unit_cost_price
     OR NEW.unit_super_agent_cost IS DISTINCT FROM OLD.unit_super_agent_cost OR NEW.unit_house_cost IS DISTINCT FROM OLD.unit_house_cost)
   AND NOT EXISTS(SELECT 1 FROM pricing_revision_records r WHERE r.batch_key=current_setting('app.contract_order_reprice',true)
     AND r.entity_type='order' AND r.entity_id=NEW.order_id AND r.after_state IS NULL) THEN
   RAISE EXCEPTION 'Order Prices Are Immutable Without An Audited Repricing Operation.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_order_prices() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_00_contract_order_price_lock BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_order_prices();

CREATE FUNCTION public.guard_contract_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Pricing Contracts Require An Explicit Owner-Authorized Source Migration.';
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_policy() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_contract_policy_lock BEFORE UPDATE OR DELETE ON public.account_pricing_contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_policy();

-- Verify new order snapshots at the database boundary as well as checkout.
CREATE FUNCTION public.validate_contract_order_price() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE o record; v_cost numeric; v_parent uuid; v_super numeric;
BEGIN
 SELECT * INTO o FROM orders WHERE id=NEW.order_id;
 IF NOT EXISTS(SELECT 1 FROM fn_account_pricing_contract(o.agent_id)) THEN RETURN NEW; END IF;
 v_cost:=fn_contract_product_cost(o.agent_id,NEW.product_id,substring(NEW.product_name from '\[Part of: (.*)\]$'));
 IF NEW.unit_cost_price IS DISTINCT FROM v_cost THEN RAISE EXCEPTION 'Order Cost Does Not Match The Fixed Account Price.'; END IF;
 SELECT parent_agent_id INTO v_parent FROM profiles WHERE id=o.agent_id;
 IF v_parent IS NOT NULL THEN
   v_super:=fn_contract_product_cost(v_parent,NEW.product_id);
   IF NEW.unit_super_agent_cost IS DISTINCT FROM v_super THEN RAISE EXCEPTION 'Upstream Cost Does Not Match The Account Contract.'; END IF;
 END IF;
 IF (o.buyer_id=o.agent_id OR COALESCE(o.is_wholesale_restock,false)) AND NEW.unit_retail_price IS DISTINCT FROM v_cost THEN
   RAISE EXCEPTION 'Agent Purchase Price Must Equal The Fixed Account Price.';
 END IF;
 NEW.unit_house_cost:=(SELECT COALESCE(house_cost,base_cost) FROM products WHERE id=NEW.product_id);
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_contract_order_price() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_validate_contract_order_price BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_contract_order_price();

CREATE FUNCTION public.validate_contract_order_spread() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM orders o CROSS JOIN LATERAL fn_account_pricing_contract(o.agent_id)c WHERE o.id=NEW.order_id)
   AND (SELECT COALESCE(sum((unit_cost_price-unit_super_agent_cost)*quantity),0) FROM order_items WHERE order_id=NEW.order_id AND unit_super_agent_cost IS NOT NULL)<0 THEN
   RAISE EXCEPTION 'The Fixed Agent Price Is Below Supply Cost. An Explicit Retail Price Edit Is Required.';
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_contract_order_spread() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER trg_contract_order_spread AFTER INSERT ON public.order_items
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_contract_order_spread();
