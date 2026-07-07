-- Fix bug: Guests can view visible agent_products, but were blocked from seeing the underlying products.
-- This caused the storefront to render a single blank product ("Research Compound") with 0 inventory.

DROP POLICY IF EXISTS "Authed users can view active products" ON products;

CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (is_active = true AND is_banned = false);
