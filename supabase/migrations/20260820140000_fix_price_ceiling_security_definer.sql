-- Fix 2026-08-20: enforce_agent_product_price_ceiling is missing SECURITY DEFINER
-- in every migration that defines it. The function does two SELECTs:
--   1. FROM profiles WHERE id = NEW.agent_id          (the agent's own row)
--   2. FROM profiles WHERE id = v_pr_parent_id        (the parent/super-agent's row)
--   3. FROM products WHERE id = NEW.product_id
--
-- Without SECURITY DEFINER the function runs as the calling 'authenticated' user
-- (the agent). RLS on profiles allows agents to see their OWN row (1 passes), but
-- NOT their parent's row (2 fails → v_par_role and v_par_is_super stay NULL).
--
-- Consequence: agents that are under a super_agent always get the standard
-- 1.0x ceiling instead of the 1.5x super-agent ceiling, silently capping their
-- pricing. This doesn't raise an exception, it just applies the wrong limit.
--
-- Fix: add SECURITY DEFINER + pinned search_path so all three SELECTs bypass RLS.

CREATE OR REPLACE FUNCTION public.enforce_agent_product_price_ceiling()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER                             -- ← the missing declaration
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
  v_limit_multiplier numeric := 1.0;
  v_ceiling numeric(10,2);
BEGIN
  -- 1. Fetch profile info (SECURITY DEFINER ensures parent row is also visible)
  SELECT role, is_super_agent, parent_agent_id, COALESCE(is_manufacturer, false)
    INTO v_pr_role, v_pr_is_super, v_pr_parent_id, v_is_manufacturer
  FROM public.profiles WHERE id = NEW.agent_id;

  -- Admin store sets the ceiling itself; never cap it.
  -- Manufacturer stores have unrestricted pricing; never cap them.
  IF v_pr_role = 'admin' OR v_is_manufacturer THEN
    RETURN NEW;
  END IF;

  -- 2. Fetch parent info if exists (now RLS-bypassed, so this actually works)
  IF v_pr_parent_id IS NOT NULL THEN
    SELECT role, is_super_agent
      INTO v_par_role, v_par_is_super
    FROM public.profiles WHERE id = v_pr_parent_id;
  END IF;

  -- 3. Determine multiplier: super_agents and their downlines get 1.5x ceiling
  IF v_pr_role = 'super_agent' OR v_pr_is_super = true
     OR v_par_role = 'super_agent' OR v_par_is_super = true THEN
    v_limit_multiplier := 1.5;
  END IF;

  -- 4. Get max_retail_price ceiling from products
  SELECT max_retail_price INTO v_max_retail_price
  FROM public.products
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
