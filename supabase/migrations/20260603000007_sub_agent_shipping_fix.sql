-- ============================================
-- PEP NATION LAB — Phase 9 Migrations
-- Migration: 20260603000007_sub_agent_shipping_fix
-- ============================================

-- Add total_shipping to sub_agent_invoices to prevent shipping costs
-- from leaking into the void and forcing Super Agents to pay for them.
ALTER TABLE public.sub_agent_invoices 
ADD COLUMN IF NOT EXISTS total_shipping NUMERIC(10,2) NOT NULL DEFAULT 0;
