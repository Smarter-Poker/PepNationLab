-- ============================================================================
-- Cosmetic consistency: the live DB policy on sub_agent_commission_plan was
-- named `sacp_read`, while the foundation migration (040000) declares
-- `sub_agent_commission_plan_read`. Normalize to the canonical repo name so a
-- fresh rebuild and the live database match exactly. Identical USING clause;
-- no behavioral change.
-- ============================================================================
DROP POLICY IF EXISTS sacp_read ON public.sub_agent_commission_plan;
DROP POLICY IF EXISTS sub_agent_commission_plan_read ON public.sub_agent_commission_plan;
CREATE POLICY sub_agent_commission_plan_read ON public.sub_agent_commission_plan
  FOR SELECT TO authenticated
  USING (auth.uid() = super_agent_id OR auth.uid() = sub_agent_id);
