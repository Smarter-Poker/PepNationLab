-- ============================================
-- PEP NATION LAB - statement_orders RLS Policies
-- Migration: 20260521000006_statement_orders_rls
-- ============================================
-- The initial schema enabled Row Level Security on statement_orders but
-- defined no policies, leaving the table accessible only to the service
-- role. These policies let an agent read the order links for their own
-- weekly statements, and let admins manage all of them.

DROP POLICY IF EXISTS "Agents can view own statement orders" ON public.statement_orders;
DROP POLICY IF EXISTS "Admin can manage all statement orders" ON public.statement_orders;

CREATE POLICY "Agents can view own statement orders" ON public.statement_orders
  FOR SELECT USING (
    statement_id IN (
      SELECT id FROM public.weekly_statements
      WHERE agent_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admin can manage all statement orders" ON public.statement_orders
  FOR ALL USING (public.is_admin());
