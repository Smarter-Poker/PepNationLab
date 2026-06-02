-- ============================================================================
-- 20260606030000_terminology_alignment.sql
-- Renames columns and tables to strictly enforce the logic that:
-- Super Agents manage Regular Agents (Invoicing)
-- Regular Agents manage Sub Agents (Gamification)
-- ============================================================================

-- 1. Rename the invoices table from sub_agent_invoices to agent_invoices
ALTER TABLE IF EXISTS public.sub_agent_invoices RENAME TO agent_invoices;

-- 2. Rename sub_agent_id to agent_id in agent_invoices (Super Agents invoice Agents)
ALTER TABLE IF EXISTS public.agent_invoices RENAME COLUMN sub_agent_id TO agent_id;

-- 3. Re-create the policy to use the new names and clean up the naming
DROP POLICY IF EXISTS "Super Agents can view their Sub-Agent invoices" ON public.agent_invoices;
CREATE POLICY "Super Agents can view their Agent invoices" 
  ON public.agent_invoices FOR SELECT 
  USING (
    super_agent_id = auth.uid() OR 
    agent_id = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Rename super_agent_id to parent_agent_id in sub_agent_commission_plan (Agents gamify Sub Agents)
ALTER TABLE IF EXISTS public.sub_agent_commission_plan RENAME COLUMN super_agent_id TO parent_agent_id;
