-- Set PepNation's base cost (house_cost) for BAC Water to $3/vial for both the
-- 3 mL and 10 mL variants. This is the landed cost before any tier multiplier.
-- Downstream pricing (agent storefronts, researchers) is derived automatically
-- from house_cost x tier multiplier, so this is the only record that needs to change.

UPDATE products
SET    house_cost = 3
WHERE  compound_slug = 'bac-water'
  AND  id IN (
    '7d3ab49b-8774-430b-a340-9e76981c352a',
    'ea769cfb-bd9f-4a9e-9d88-acf9fa42aca8'
  );
