-- ============================================
-- PEP NATION LAB + PEP NATION RX UNIFICATION
-- Migration: 20260528000001_rx_roles_unification
-- ============================================

-- 1. Expand the global user_role enum to support the Telehealth domain
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'patient';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pharmacy';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rx_admin';

-- 2. Create a helper function to strictly identify Lab Ecommerce Users
CREATE OR REPLACE FUNCTION is_lab_user()
RETURNS BOOLEAN AS $$
  SELECT (SELECT role FROM profiles WHERE id = (SELECT auth.uid())) IN ('researcher', 'agent', 'super_agent', 'admin', 'shipping');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 3. Lock down ecommerce tables so Telehealth users (doctors, patients) cannot read the catalog via the API
DROP POLICY IF EXISTS "Authed users can view active products" ON products;
CREATE POLICY "Lab users can view active products" ON products
  FOR SELECT USING (is_lab_user() AND is_active = true AND is_banned = false);

DROP POLICY IF EXISTS "Anyone can view pricing tiers" ON pricing_tiers;
CREATE POLICY "Lab users can view pricing tiers" ON pricing_tiers
  FOR SELECT USING (is_lab_user());

DROP POLICY IF EXISTS "Anyone can view active agent profiles" ON agent_profiles;
CREATE POLICY "Lab users can view active agent profiles" ON agent_profiles
  FOR SELECT USING (is_lab_user() AND is_active = true);

DROP POLICY IF EXISTS "Anyone can view visible agent products" ON agent_products;
CREATE POLICY "Lab users can view visible agent products" ON agent_products
  FOR SELECT USING (is_lab_user() AND is_visible = true);
