-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: downline product inheritance
-- Modifies the trigger that creates agent_products for new agents to clone
-- custom_image_url and retail_price from their parent agent (if any).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_agent_products_for_new_agent()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_agent_id UUID;
BEGIN
  -- Lookup parent_agent_id from profiles
  SELECT parent_agent_id INTO v_parent_agent_id FROM profiles WHERE id = NEW.id;

  INSERT INTO agent_products (agent_id, product_id, retail_price, custom_image_url, is_visible)
  SELECT 
    NEW.id, 
    p.id, 
    COALESCE(parent_prods.retail_price, p.base_cost * 10), 
    parent_prods.custom_image_url,
    COALESCE(parent_prods.is_visible, true)
  FROM products p
  LEFT JOIN agent_products parent_prods ON parent_prods.agent_id = v_parent_agent_id AND parent_prods.product_id = p.id
  ON CONFLICT (agent_id, product_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
