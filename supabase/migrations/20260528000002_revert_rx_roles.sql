-- ============================================
-- REVERT: PEP NATION LAB + PEP NATION RX UNIFICATION
-- Migration: 20260528000002_revert_rx_roles
-- ============================================

-- Revert products policy
-- Drop BOTH the RX-era name and the target name first, so this migration is
-- idempotent on a fresh rebuild (where the initial schema already created the
-- "Authed users..." policy). Without the second DROP, CREATE POLICY errors with
-- "already exists" and halts the entire migration run.
DROP POLICY IF EXISTS "Lab users can view active products" ON products;
DROP POLICY IF EXISTS "Authed users can view active products" ON products;
CREATE POLICY "Authed users can view active products" ON products
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL AND is_active = true AND is_banned = false);

-- Revert pricing_tiers policy
DROP POLICY IF EXISTS "Lab users can view pricing tiers" ON pricing_tiers;
DROP POLICY IF EXISTS "Anyone can view pricing tiers" ON pricing_tiers;
CREATE POLICY "Anyone can view pricing tiers" ON pricing_tiers
  FOR SELECT USING (true);

-- Revert agent_profiles policy
DROP POLICY IF EXISTS "Lab users can view active agent profiles" ON agent_profiles;
DROP POLICY IF EXISTS "Anyone can view active agent profiles" ON agent_profiles;
CREATE POLICY "Anyone can view active agent profiles" ON agent_profiles
  FOR SELECT USING (is_active = true);

-- Revert agent_products policy
DROP POLICY IF EXISTS "Lab users can view visible agent products" ON agent_products;
DROP POLICY IF EXISTS "Anyone can view visible agent products" ON agent_products;
CREATE POLICY "Anyone can view visible agent products" ON agent_products
  FOR SELECT USING (is_visible = true);

-- Drop the helper function
DROP FUNCTION IF EXISTS is_lab_user();

-- Note: PostgreSQL does not support dropping values from an ENUM type using ALTER TYPE.
-- The roles ('doctor', 'patient', 'pharmacy', 'rx_admin') remain in the user_role enum 
-- but will not affect system operations as they are no longer referenced in RLS.
