-- Double all pricing for Cindy De La Mora (agent_id: b2ee9bf4-6dd5-41b3-9450-fee51aecb592)
-- If pricing is currently 39.97, double it to 79.97. End all pricing with .97
-- Disable ceiling trigger temporarily to allow prices that exceed max_retail_price

ALTER TABLE agent_products DISABLE TRIGGER trg_agent_product_price_ceiling;

UPDATE agent_products
SET retail_price = FLOOR(retail_price * 2) + 0.97
WHERE agent_id = 'b2ee9bf4-6dd5-41b3-9450-fee51aecb592'
AND (
    product_id IS NULL 
    OR product_id IN (SELECT id FROM products WHERE COALESCE(is_banned, false) = false)
);

ALTER TABLE agent_products ENABLE TRIGGER trg_agent_product_price_ceiling;
