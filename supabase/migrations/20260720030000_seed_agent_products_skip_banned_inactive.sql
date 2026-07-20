-- Fix agent creation failure (2026-07-20): seed_agent_products_for_new_agent
-- seeded rows for EVERY product with no filter, so once any product was
-- banned, the check_banned_product trigger on agent_products raised
-- ('This product is permanently banned from sale on PepNationLab') inside the
-- profile-insert transaction and ALL new agent creation failed with
-- "An Unexpected Error Occurred Saving Profile."
-- Seed only active, non-banned products (mirrors the guard the sibling
-- seed_agent_products_for_new_product trigger already has).
-- Applied to production 2026-07-20.
CREATE OR REPLACE FUNCTION public.seed_agent_products_for_new_agent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_parent_agent_id UUID;
BEGIN
  SELECT parent_agent_id INTO v_parent_agent_id FROM profiles WHERE id = NEW.id;

  INSERT INTO agent_products (agent_id, product_id, retail_price, custom_image_url, is_visible)
  SELECT
    NEW.id,
    p.id,
    COALESCE(p.max_retail_price, parent_prods.retail_price, p.base_cost * 10),
    parent_prods.custom_image_url,
    COALESCE(parent_prods.is_visible, true)
  FROM products p
  LEFT JOIN agent_products parent_prods ON parent_prods.agent_id = v_parent_agent_id AND parent_prods.product_id = p.id
  WHERE p.is_active = true
    AND COALESCE(p.is_banned, false) = false
  ON CONFLICT (agent_id, product_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
