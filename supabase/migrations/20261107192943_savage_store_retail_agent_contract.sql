-- Owner-directed account contract. Retail prices remain independent of house prices.
CREATE TABLE public.account_pricing_contracts (
  agent_id uuid PRIMARY KEY REFERENCES public.profiles(id),
  house_cogs_multiplier numeric NOT NULL CHECK (house_cogs_multiplier >= 1),
  downline_retail_factor numeric NOT NULL CHECK (downline_retail_factor > 0 AND downline_retail_factor <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.account_pricing_contracts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_pricing_contracts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.account_pricing_contracts TO service_role;

INSERT INTO public.account_pricing_contracts(agent_id,house_cogs_multiplier,downline_retail_factor)
SELECT id,1.50,0.75 FROM public.agent_profiles WHERE slug='savagebrands';

CREATE FUNCTION public.fn_account_pricing_contract(p_agent uuid)
RETURNS TABLE(owner_id uuid,house_cogs_multiplier numeric,retail_factor numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 WITH RECURSIVE chain AS (
   SELECT p.id,p.parent_agent_id,0 depth,ARRAY[p.id] seen FROM profiles p WHERE p.id=p_agent
   UNION ALL
   SELECT p.id,p.parent_agent_id,c.depth+1,c.seen||p.id
   FROM profiles p JOIN chain c ON p.id=c.parent_agent_id
   WHERE c.depth<32 AND NOT p.id=ANY(c.seen)
 )
 SELECT ac.agent_id,ac.house_cogs_multiplier,
   CASE WHEN ac.agent_id=p_agent THEN NULL::numeric ELSE ac.downline_retail_factor END
 FROM chain c JOIN account_pricing_contracts ac ON ac.agent_id=c.id
 ORDER BY c.depth LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.fn_account_pricing_contract(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_account_pricing_contract(uuid) TO service_role;

-- One exact cent allocation per bundle. Cumulative rounding conserves the listed
-- bundle total, unlike independently rounding each discounted component.
CREATE FUNCTION public.fn_contract_product_cost(p_agent uuid,p_product uuid,p_bundle text DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c record; v_cost numeric; v_bundle jsonb; v_total numeric; v_share numeric;
BEGIN
 SELECT * INTO c FROM fn_account_pricing_contract(p_agent);
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF c.retail_factor IS NULL THEN
   SELECT round(COALESCE(house_cost,base_cost)*c.house_cogs_multiplier,2) INTO v_cost FROM products WHERE id=p_product;
 ELSE
   IF p_bundle IS NOT NULL THEN
     SELECT b INTO v_bundle FROM agent_profiles a CROSS JOIN LATERAL jsonb_array_elements(a.bundles_config) b
     WHERE a.id=c.owner_id AND lower(trim(b->>'name'))=lower(trim(p_bundle)) AND COALESCE((b->>'is_active')::boolean,true)
       AND b->'product_ids' ? p_product::text;
     IF v_bundle IS NULL THEN RAISE EXCEPTION 'Unknown Contract Bundle'; END IF;
     SELECT COALESCE(NULLIF((v_bundle->>'custom_price')::numeric,0),sum(ap.retail_price)*(1-COALESCE((v_bundle->>'discount_percent')::numeric,0)/100))
       INTO v_total FROM agent_products ap WHERE ap.agent_id=c.owner_id AND v_bundle->'product_ids' ? ap.product_id::text;
     WITH members AS (
       SELECT ap.product_id,ap.retail_price weight FROM agent_products ap
       WHERE ap.agent_id=c.owner_id AND v_bundle->'product_ids' ? ap.product_id::text
     ), shares AS (SELECT *,sum(weight) OVER() total,sum(weight) OVER(ORDER BY product_id) cumulative FROM members)
     SELECT (round(round(v_total*c.retail_factor,2)*100*cumulative/total)
             -round(round(v_total*c.retail_factor,2)*100*(cumulative-weight)/total))/100
       INTO v_cost FROM shares WHERE product_id=p_product;
   ELSE
     SELECT round(ap.retail_price*c.retail_factor,2) INTO v_cost
     FROM agent_products ap WHERE ap.agent_id=c.owner_id AND ap.product_id=p_product;
   END IF;
 END IF;
 IF v_cost IS NULL OR v_cost<=0 THEN RAISE EXCEPTION 'Contract Pricing Configuration Missing'; END IF;
 RETURN v_cost;
END;
$$;
REVOKE ALL ON FUNCTION public.fn_contract_product_cost(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_contract_product_cost(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.fn_contract_costs(p_agent uuid,p_products uuid[],p_bundle text DEFAULT NULL)
RETURNS TABLE(product_id uuid,cost numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT id,fn_contract_product_cost(p_agent,id,p_bundle) FROM unnest(p_products) id
 WHERE EXISTS(SELECT 1 FROM fn_account_pricing_contract(p_agent));
$$;
REVOKE ALL ON FUNCTION public.fn_contract_costs(uuid,uuid[],text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_contract_costs(uuid,uuid[],text) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_agent_chain_cost(p_agent uuid,p_product uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_base numeric; v_is_sub boolean; v_parent uuid; v_node uuid; v_factor numeric:=1;
 v_seen uuid[]:='{}'; v_markup numeric; v_contract numeric;
BEGIN
 v_contract:=fn_contract_product_cost(p_agent,p_product);
 IF v_contract IS NOT NULL THEN RETURN v_contract; END IF;
 SELECT base_cost INTO v_base FROM products WHERE id=p_product;
 IF v_base IS NULL OR v_base<=0 THEN RETURN NULL; END IF;
 SELECT COALESCE(is_sub_agent,false),parent_agent_id INTO v_is_sub,v_parent FROM profiles WHERE id=p_agent;
 IF NOT FOUND THEN RETURN NULL; END IF;
 v_node:=CASE WHEN v_is_sub THEN COALESCE(v_parent,p_agent) ELSE p_agent END;
 LOOP
   IF v_node=ANY(v_seen) OR cardinality(v_seen)>=6 THEN RAISE EXCEPTION 'Invalid Pricing Chain'; END IF;
   v_seen:=v_seen||v_node;
   SELECT parent_agent_id INTO v_parent FROM profiles WHERE id=v_node;
   EXIT WHEN v_parent IS NULL;
   v_factor:=v_factor*(1+fn_agent_effective_markup(v_node)/100.0);
   v_node:=v_parent;
 END LOOP;
 SELECT COALESCE((SELECT custom_markup_override FROM profiles WHERE id=v_node),
   (SELECT markup FROM house_tiers WHERE level=fn_resolve_house_tier_level(v_node)),
   (SELECT max(markup) FROM house_tiers),2.5) INTO v_markup;
 RETURN round(v_base*(1+v_markup)*v_factor,2);
END;
$$;

DROP TRIGGER IF EXISTS trz_sync_savage_brands_pricing ON public.agent_products;
DROP FUNCTION IF EXISTS public.sync_savage_brands_pricing();

-- Refresh percentages without changing any independently chosen retail prices.
CREATE FUNCTION public.refresh_contract_margin() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cost numeric;
BEGIN
 IF EXISTS(SELECT 1 FROM fn_account_pricing_contract(NEW.agent_id)) THEN
   v_cost:=fn_contract_product_cost(NEW.agent_id,NEW.product_id);
   NEW.margin_percent:=round((NEW.retail_price/v_cost-1)*100,2);
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_contract_margin() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trz_refresh_contract_margin BEFORE INSERT OR UPDATE ON public.agent_products
FOR EACH ROW EXECUTE FUNCTION public.refresh_contract_margin();

CREATE OR REPLACE FUNCTION public.fn_propagate_admin_price_to_stores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public','pg_temp'
AS $function$
BEGIN
  -- Only the admin house store drives propagation.
  IF NEW.agent_id <> 'b8bd12e6-8196-401e-b37b-f742caf1596c' THEN
    RETURN NULL;
  END IF;

  -- (1) The admin price IS the max. Refresh the product cap first so downstream
  --     ceiling checks on other stores pass in this same transaction.
  UPDATE products
  SET max_retail_price = NEW.retail_price
  WHERE id = NEW.product_id
    AND max_retail_price IS DISTINCT FROM NEW.retail_price
    AND NOT COALESCE(is_banned, false);

  -- (2) Propagate to every other store (only on real price changes).
  IF TG_OP = 'UPDATE' AND NEW.retail_price IS DISTINCT FROM OLD.retail_price THEN
    UPDATE agent_products ap
    SET retail_price = CASE
                         WHEN ap.retail_price = OLD.retail_price THEN NEW.retail_price
                         WHEN (pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true) THEN ap.retail_price
                         ELSE LEAST(ap.retail_price, NEW.retail_price)
                       END,
        sale_price   = CASE
                         WHEN (pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true) THEN ap.sale_price
                         WHEN ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price THEN NEW.retail_price
                         ELSE ap.sale_price
                       END
    FROM profiles pr
    LEFT JOIN profiles par ON pr.parent_agent_id = par.id
    WHERE ap.agent_id = pr.id
      AND ap.product_id = NEW.product_id
      AND ap.agent_id <> NEW.agent_id
      AND NOT EXISTS (SELECT 1 FROM fn_account_pricing_contract(ap.agent_id))
      AND NOT COALESCE((SELECT is_banned FROM products WHERE id = ap.product_id), false)
      AND (
            (ap.retail_price = OLD.retail_price)
            OR (NOT (pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true) AND ap.retail_price > NEW.retail_price)
            OR (NOT (pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true) AND ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price)
          );
  END IF;

  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION snap_agent_product_to_97()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_cost numeric;
BEGIN
  IF TG_OP='UPDATE' AND NEW.retail_price IS NOT DISTINCT FROM OLD.retail_price THEN RETURN NEW; END IF;
  IF NEW.retail_price IS NOT NULL THEN
    -- Snap to .97
    -- Using integer math to avoid float precision issues:
    -- Multiply by 100, round, subtract 3, if less than original add 100.
    DECLARE
      v_raw_cents int := ROUND(NEW.retail_price * 100);
      v_snapped_cents int;
    BEGIN
      -- Calculate the nearest .97
      v_snapped_cents := (ROUND(v_raw_cents / 100.0) * 100) - 3;
      IF v_snapped_cents < v_raw_cents THEN
         v_snapped_cents := v_snapped_cents + 100;
      END IF;
      
      NEW.retail_price := v_snapped_cents / 100.0;
    END;

    -- Recalculate margin_percent so the DB math doesn't complain later
    -- We need the base cost or chain cost for this.
    v_cost := public.fn_agent_chain_cost(NEW.agent_id, NEW.product_id);
    IF v_cost IS NOT NULL AND v_cost > 0 THEN
      NEW.margin_percent := ROUND(((NEW.retail_price / v_cost) - 1) * 100, 2);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- Recompute reporting percentages only; do not change retail prices or images.
UPDATE public.agent_products ap SET margin_percent=round((ap.retail_price/fn_contract_product_cost(ap.agent_id,ap.product_id)-1)*100,2)
WHERE NOT COALESCE((SELECT is_banned FROM products WHERE id=ap.product_id),false) AND EXISTS(SELECT 1 FROM fn_account_pricing_contract(ap.agent_id));

CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_floor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_manufacturer boolean; v_cost numeric; v_max numeric; v_floor numeric;
BEGIN
 SELECT role,COALESCE(is_manufacturer,false) INTO v_role,v_manufacturer FROM profiles WHERE id=NEW.agent_id;
 IF v_role='admin' OR v_manufacturer THEN RETURN NEW; END IF;
 v_cost:=fn_agent_chain_cost(NEW.agent_id,NEW.product_id);
 IF v_cost IS NULL OR v_cost<=0 THEN RETURN NEW; END IF;
 v_floor:=round(v_cost*1.10,2);
 IF NOT EXISTS(SELECT 1 FROM fn_account_pricing_contract(NEW.agent_id)) THEN
   SELECT max_retail_price INTO v_max FROM products WHERE id=NEW.product_id;
   IF v_max IS NOT NULL THEN v_floor:=least(v_floor,v_max); END IF;
 END IF;
 IF NEW.retail_price<v_floor THEN NEW.retail_price:=v_floor; END IF;
 IF NEW.sale_price<v_floor THEN NEW.sale_price:=v_floor; END IF;
 RETURN NEW;
END;
$$;

CREATE FUNCTION public.refresh_dependent_contract_margins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_TABLE_NAME='products' THEN
   UPDATE agent_products ap SET margin_percent=round((ap.retail_price/fn_contract_product_cost(ap.agent_id,ap.product_id)-1)*100,2)
   WHERE ap.product_id=NEW.id AND NOT COALESCE((SELECT is_banned FROM products WHERE id=NEW.id),false) AND EXISTS(SELECT 1 FROM fn_account_pricing_contract(ap.agent_id));
 ELSIF EXISTS(SELECT 1 FROM account_pricing_contracts WHERE agent_id=NEW.agent_id) THEN
   UPDATE agent_products ap SET margin_percent=round((ap.retail_price/fn_contract_product_cost(ap.agent_id,ap.product_id)-1)*100,2)
   WHERE ap.product_id=NEW.product_id AND ap.agent_id<>NEW.agent_id
     AND NOT COALESCE((SELECT is_banned FROM products WHERE id=ap.product_id),false)
     AND EXISTS(SELECT 1 FROM fn_account_pricing_contract(ap.agent_id) c WHERE c.owner_id=NEW.agent_id);
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_dependent_contract_margins() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_refresh_contract_cogs AFTER UPDATE OF house_cost,base_cost ON public.products
FOR EACH ROW EXECUTE FUNCTION public.refresh_dependent_contract_margins();
CREATE TRIGGER trg_refresh_contract_retail AFTER UPDATE OF retail_price ON public.agent_products
FOR EACH ROW WHEN (NEW.retail_price IS DISTINCT FROM OLD.retail_price)
EXECUTE FUNCTION public.refresh_dependent_contract_margins();

REVOKE ALL ON FUNCTION public.fn_agent_chain_cost(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.fn_agent_chain_cost(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.snap_agent_product_to_97() FROM PUBLIC,anon,authenticated;
