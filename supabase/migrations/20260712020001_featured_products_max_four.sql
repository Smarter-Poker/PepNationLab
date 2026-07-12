-- Enforce the Storefront Conversion Kit cap server-side: the selector limits
-- to 4 client-side, but featured_products is written via a direct RLS client
-- update, so a crafted request could store more.
-- NOTE: Applied to production 2026-07-11 via MCP.
ALTER TABLE public.agent_profiles
  DROP CONSTRAINT IF EXISTS agent_profiles_featured_products_max4;
ALTER TABLE public.agent_profiles
  ADD CONSTRAINT agent_profiles_featured_products_max4
  CHECK (featured_products IS NULL OR cardinality(featured_products) <= 4);
