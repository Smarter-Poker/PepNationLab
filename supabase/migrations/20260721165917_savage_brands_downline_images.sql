-- Propagate Savage Brands custom_image_url to all existing downline agents recursively.

WITH RECURSIVE downlines AS (
  -- Base case: Savage Brands itself (level 0)
  SELECT p.id, 0 AS level
  FROM profiles p 
  JOIN agent_profiles ap ON p.id = ap.id 
  WHERE ap.slug = 'savagebrands'
  
  UNION ALL
  
  -- Recursive step: all children of the current downlines
  SELECT p.id, d.level + 1 AS level
  FROM profiles p
  JOIN downlines d ON p.parent_agent_id = d.id
)
UPDATE agent_products target
SET custom_image_url = src.custom_image_url
FROM (
  SELECT product_id, custom_image_url
  FROM agent_products
  WHERE agent_id = (SELECT id FROM agent_profiles WHERE slug = 'savagebrands' LIMIT 1)
    AND custom_image_url IS NOT NULL
) AS src
WHERE target.product_id = src.product_id
  AND target.agent_id IN (
    SELECT id FROM downlines WHERE level > 0
  );
