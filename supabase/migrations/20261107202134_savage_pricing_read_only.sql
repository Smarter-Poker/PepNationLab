-- The owner removed SavageBrands account pricing-edit permission.
ALTER TABLE public.account_pricing_contracts ADD COLUMN owner_can_edit_prices boolean NOT NULL DEFAULT true;
ALTER TABLE public.account_pricing_contracts DISABLE TRIGGER trg_contract_policy_lock;
UPDATE public.account_pricing_contracts SET owner_can_edit_prices=false,updated_at=now()
WHERE agent_id=(SELECT id FROM public.agent_profiles WHERE slug='savagebrands');
ALTER TABLE public.account_pricing_contracts ENABLE TRIGGER trg_contract_policy_lock;

CREATE FUNCTION public.can_edit_store_pricing(p_agent uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT COALESCE((SELECT owner_can_edit_prices FROM account_pricing_contracts WHERE agent_id=p_agent),true);
$$;
REVOKE ALL ON FUNCTION public.can_edit_store_pricing(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_store_pricing(uuid) TO service_role;

CREATE FUNCTION public.reject_readonly_product_prices() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT can_edit_store_pricing(NEW.agent_id) AND
  (NEW.retail_price IS DISTINCT FROM OLD.retail_price OR NEW.sale_price IS DISTINCT FROM OLD.sale_price
   OR NEW.is_on_sale IS DISTINCT FROM OLD.is_on_sale OR NEW.manufacturer_cost IS DISTINCT FROM OLD.manufacturer_cost) THEN
  RAISE EXCEPTION 'Pricing Is Read Only For This Account.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_readonly_product_prices() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_readonly_product_prices AFTER UPDATE ON public.agent_products
FOR EACH ROW EXECUTE FUNCTION public.reject_readonly_product_prices();

CREATE FUNCTION public.reject_readonly_bundle_prices() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NOT can_edit_store_pricing(NEW.id) AND NEW.bundles_config IS DISTINCT FROM OLD.bundles_config THEN
  RAISE EXCEPTION 'Bundle Configuration Is Read Only For This Account.';
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_readonly_bundle_prices() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_readonly_bundle_prices BEFORE UPDATE OF bundles_config ON public.agent_profiles
FOR EACH ROW EXECUTE FUNCTION public.reject_readonly_bundle_prices();

CREATE OR REPLACE FUNCTION public.edit_store_product(p_agent uuid,p_id uuid,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r public.agent_products%ROWTYPE; v_prev text; v_before jsonb;
BEGIN
 IF NOT can_edit_store_pricing(p_agent) AND p_patch ?| ARRAY['retail_price','sale_price','is_on_sale','margin_percent','manufacturer_cost'] THEN RAISE EXCEPTION 'Pricing Is Read Only For This Account.'; END IF;
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


CREATE OR REPLACE FUNCTION public.edit_store_bundles(p_agent uuid,p_bundles jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_prev text; v_before jsonb;
BEGIN
 IF NOT can_edit_store_pricing(p_agent) THEN RAISE EXCEPTION 'Bundle Configuration Is Read Only For This Account.'; END IF;
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



-- Close alternate price configuration paths; redemption counters still work.
CREATE FUNCTION public.reject_readonly_coupon_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_agent uuid;
BEGIN
 v_agent:=CASE WHEN TG_OP='DELETE' THEN OLD.agent_id ELSE NEW.agent_id END;
 IF NOT can_edit_store_pricing(v_agent) THEN
  IF TG_OP<>'UPDATE' THEN RAISE EXCEPTION 'Coupon Configuration Is Read Only For This Account.'; END IF;
  IF (to_jsonb(NEW)-ARRAY['uses_count','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['uses_count','updated_at']) THEN
   RAISE EXCEPTION 'Coupon Configuration Is Read Only For This Account.';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_readonly_coupon_config() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_readonly_coupon_config BEFORE INSERT OR UPDATE OR DELETE ON public.coupons
FOR EACH ROW EXECUTE FUNCTION public.reject_readonly_coupon_config();

CREATE FUNCTION public.reject_readonly_baseline_pricing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_agent uuid;
BEGIN
 v_agent:=CASE WHEN TG_OP='DELETE' THEN OLD.super_agent_id ELSE NEW.super_agent_id END;
 IF NOT can_edit_store_pricing(v_agent) THEN RAISE EXCEPTION 'Baseline Pricing Is Read Only For This Account.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.reject_readonly_baseline_pricing() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_readonly_baseline_pricing BEFORE INSERT OR UPDATE OR DELETE ON public.super_agent_pricing
FOR EACH ROW EXECUTE FUNCTION public.reject_readonly_baseline_pricing();

-- Existing owner ALL policies also allowed deleting and recreating price rows.
-- Restrict only the signed-in account's replacement operations; keep catalog
-- reads, visibility edits and service-owned catalog provisioning intact.
CREATE FUNCTION public.can_self_edit_pricing() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND can_edit_store_pricing(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_self_edit_pricing() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_self_edit_pricing() TO authenticated;
CREATE POLICY readonly_product_insert ON public.agent_products AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT can_self_edit_pricing()));
CREATE POLICY readonly_product_delete ON public.agent_products AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT can_self_edit_pricing()));
CREATE POLICY readonly_store_insert ON public.agent_profiles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT can_self_edit_pricing()));
CREATE POLICY readonly_store_delete ON public.agent_profiles AS RESTRICTIVE FOR DELETE TO authenticated
USING ((SELECT can_self_edit_pricing()));
