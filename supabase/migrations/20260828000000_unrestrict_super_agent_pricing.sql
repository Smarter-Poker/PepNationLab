-- Remove all price ceiling restrictions for Super Agents and their downlines.
-- Previously they were capped at 1.5x the admin store price. Now they can price infinitely.

CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_ceiling()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_max_retail_price numeric(10,2);
  v_pr_role text;
  v_pr_is_super boolean;
  v_pr_parent_id uuid;
  v_par_role text;
  v_par_is_super boolean;
  v_is_manufacturer boolean;
  v_ceiling numeric(10,2);
BEGIN
  -- 1. Fetch profile info
  SELECT role, is_super_agent, parent_agent_id, COALESCE(is_manufacturer, false)
    INTO v_pr_role, v_pr_is_super, v_pr_parent_id, v_is_manufacturer
  FROM public.profiles WHERE id = NEW.agent_id;

  -- Admin store sets the ceiling itself; never cap it.
  -- Manufacturer stores have unrestricted pricing; never cap them.
  IF v_pr_role = 'admin' OR v_is_manufacturer THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch parent info if exists
  IF v_pr_parent_id IS NOT NULL THEN
    SELECT role, is_super_agent
      INTO v_par_role, v_par_is_super
    FROM public.profiles WHERE id = v_pr_parent_id;
  END IF;

  -- 3. Super agents and their downlines have NO ceiling restrictions.
  IF v_pr_role = 'super_agent' OR v_pr_is_super = true
     OR v_par_role = 'super_agent' OR v_par_is_super = true THEN
    RETURN NEW;
  END IF;

  -- 4. Get max_retail_price ceiling from products (for normal agents, multiplier is 1.0)
  SELECT max_retail_price INTO v_max_retail_price
  FROM public.products
  WHERE id = NEW.product_id;

  IF v_max_retail_price IS NOT NULL THEN
    v_ceiling := v_max_retail_price;
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
