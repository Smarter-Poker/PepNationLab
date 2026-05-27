-- ============================================
-- PEP NATION LAB — Phase 8 Migrations
-- Migration: 20260528000005_super_agents
-- ============================================

-- 1. Add Super Agent Flag to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_super_agent BOOLEAN DEFAULT FALSE;

-- 2. Create Super Agent Pricing Rules Table
-- Allows Super Agents to define the baseline cost for their Sub-Agents.
CREATE TABLE IF NOT EXISTS public.super_agent_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  baseline_cost NUMERIC(10,2) NOT NULL, -- What the Sub-Agent pays the Super Agent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(super_agent_id, product_id)
);

-- RLS for super_agent_pricing
ALTER TABLE public.super_agent_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Agents can manage their own pricing rules" 
  ON public.super_agent_pricing FOR ALL 
  USING (
    super_agent_id = auth.uid() OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Update Order Items to track Super Agent Cost
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS unit_super_agent_cost NUMERIC(10,2);

-- Update existing orders to copy cost_price to super_agent_cost for consistency
UPDATE public.order_items 
SET unit_super_agent_cost = unit_cost_price 
WHERE unit_super_agent_cost IS NULL;

-- 4. Sub-Agent Invoice Ledger Table
CREATE TABLE IF NOT EXISTS public.sub_agent_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  super_agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sub_agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_cogs NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_owed NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'paid'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sub_agent_id, week_start)
);

ALTER TABLE public.sub_agent_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Agents can view their Sub-Agent invoices" 
  ON public.sub_agent_invoices FOR SELECT 
  USING (
    super_agent_id = auth.uid() OR 
    sub_agent_id = auth.uid() OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 5. Expand RLS on Profiles and Orders for Super Agents
-- Super agents should be able to see profiles where parent_agent_id = their ID
-- and see orders where the agent_id = their Sub-Agent's ID
CREATE POLICY "Super Agents can view their sub-agents"
  ON public.profiles FOR SELECT
  USING (parent_agent_id = auth.uid());

CREATE POLICY "Super Agents can view downline researchers"
  ON public.profiles FOR SELECT
  USING (referring_agent_id IN (SELECT id FROM public.profiles WHERE parent_agent_id = auth.uid()));

CREATE POLICY "Super Agents can view sub-agent orders"
  ON public.orders FOR SELECT
  USING (agent_id IN (SELECT id FROM public.profiles WHERE parent_agent_id = auth.uid()));
