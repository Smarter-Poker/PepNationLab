-- ============================================================================
-- AUDIT FIX (deep-dive): house_tiers RLS hardening.
-- The foundation migration created house_tiers_read as
-- `FOR SELECT TO authenticated USING (true)`, which let ANY authenticated user
-- — including researchers — read the house markup ladder and infer the
-- platform's margin structure. This matches the pricing_tiers posture instead:
-- only agents/super_agents/admin/shipping may read; only admin may write.
-- Researchers can no longer enumerate house margins. Code reads house_tiers via
-- the service-role client (RLS-bypassing), so this is transparent to the app.
-- ============================================================================

DROP POLICY IF EXISTS house_tiers_read ON public.house_tiers;
CREATE POLICY house_tiers_read ON public.house_tiers
  FOR SELECT USING (public.is_agent_or_above());

DROP POLICY IF EXISTS house_tiers_admin_manage ON public.house_tiers;
CREATE POLICY house_tiers_admin_manage ON public.house_tiers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
