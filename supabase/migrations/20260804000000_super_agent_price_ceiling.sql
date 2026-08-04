-- ============================================================
-- SUPER AGENT ADMIN PRICE CEILING +50%
-- Allows Super Agents and their downlines to price up to 50% above the Admin Store's max_retail_price.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_ceiling()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_retail_price numeric(10,2);
  v_pr_role text;
  v_pr_is_super boolean;
  v_pr_parent_id uuid;
  v_par_role text;
  v_par_is_super boolean;
  v_limit_multiplier numeric := 1.0;
  v_ceiling numeric(10,2);
BEGIN
  -- 1. Fetch profile info
  SELECT role, is_super_agent, parent_agent_id
    INTO v_pr_role, v_pr_is_super, v_pr_parent_id
  FROM profiles WHERE id = NEW.agent_id;

  -- Admin store sets the ceiling itself; never cap it.
  IF v_pr_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch parent info if exists
  IF v_pr_parent_id IS NOT NULL THEN
    SELECT role, is_super_agent
      INTO v_par_role, v_par_is_super
    FROM profiles WHERE id = v_pr_parent_id;
  END IF;

  -- 3. Determine multiplier
  IF v_pr_role = 'super_agent' OR v_pr_is_super = true OR v_par_role = 'super_agent' OR v_par_is_super = true THEN
    v_limit_multiplier := 1.5;
  END IF;

  -- 4. Get ceiling
  SELECT max_retail_price INTO v_max_retail_price
  FROM products
  WHERE id = NEW.product_id;

  IF v_max_retail_price IS NOT NULL THEN
    v_ceiling := v_max_retail_price * v_limit_multiplier;
    IF NEW.retail_price > v_ceiling THEN
      RAISE EXCEPTION 'retail_price (%) exceeds maximum allowed price (%) for this product',
        NEW.retail_price, v_ceiling;
    END IF;
    IF NEW.sale_price IS NOT NULL AND NEW.sale_price > v_ceiling THEN
      RAISE EXCEPTION 'sale_price (%) exceeds maximum allowed price (%) for this product',
        NEW.sale_price, v_ceiling;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

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
                         ELSE LEAST(ap.retail_price, NEW.retail_price * CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true THEN 1.5 ELSE 1.0 END)
                       END,
        sale_price   = CASE
                         WHEN ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price * (CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true THEN 1.5 ELSE 1.0 END) THEN NEW.retail_price * CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true THEN 1.5 ELSE 1.0 END
                         ELSE ap.sale_price
                       END
    FROM profiles pr
    LEFT JOIN profiles par ON pr.parent_agent_id = par.id
    WHERE ap.agent_id = pr.id
      AND ap.product_id = NEW.product_id
      AND ap.agent_id <> NEW.agent_id
      AND NOT COALESCE((SELECT is_banned FROM products WHERE id = ap.product_id), false)
      AND (
            (ap.retail_price = OLD.retail_price)
            OR ap.retail_price > NEW.retail_price * CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true THEN 1.5 ELSE 1.0 END
            OR (ap.sale_price IS NOT NULL AND ap.sale_price > NEW.retail_price * CASE WHEN pr.role = 'super_agent' OR pr.is_super_agent = true OR par.role = 'super_agent' OR par.is_super_agent = true THEN 1.5 ELSE 1.0 END)
          );
  END IF;

  RETURN NULL;
END;
$function$;
