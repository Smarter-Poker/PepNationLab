-- Set KLOW STACK market_avg_price to $124.97 so the storefront card shows
-- "MSRP $124.97 / YOU SAVE $25" (retail is $99.97/vial).
-- Also restores the market_avg_price field to the storefront catalog API
-- query (see app/api/storefront/catalog/[agentSlug]/route.ts).

UPDATE products
SET market_avg_price = 124.97
WHERE id = 'ae609171-efaf-4cd2-9255-f983e1983adf'
  AND compound_slug = 'klow';
