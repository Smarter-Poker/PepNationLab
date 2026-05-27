-- Add unique constraint to allow ON CONFLICT
ALTER TABLE agent_products ADD CONSTRAINT agent_products_agent_id_product_id_key UNIQUE (agent_id, product_id);

-- Function to ensure all products exist for a new agent
CREATE OR REPLACE FUNCTION seed_agent_products_for_new_agent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_products (agent_id, product_id, retail_price, is_visible)
  SELECT NEW.id, p.id, p.base_cost * 10, true
  FROM products p
  ON CONFLICT (agent_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger when a new agent profile is created
CREATE TRIGGER trigger_seed_agent_products_for_new_agent
AFTER INSERT ON agent_profiles
FOR EACH ROW
EXECUTE FUNCTION seed_agent_products_for_new_agent();

-- Function to ensure a new product exists for all agents
CREATE OR REPLACE FUNCTION seed_agent_products_for_new_product()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_products (agent_id, product_id, retail_price, is_visible)
  SELECT a.id, NEW.id, NEW.base_cost * 10, true
  FROM agent_profiles a
  ON CONFLICT (agent_id, product_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger when a new product is created
CREATE TRIGGER trigger_seed_agent_products_for_new_product
AFTER INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION seed_agent_products_for_new_product();

-- Seed any missing records retroactively
INSERT INTO agent_products (agent_id, product_id, retail_price, is_visible)
SELECT a.id, p.id, p.base_cost * 10, true
FROM agent_profiles a
CROSS JOIN products p
ON CONFLICT (agent_id, product_id) DO NOTHING;
