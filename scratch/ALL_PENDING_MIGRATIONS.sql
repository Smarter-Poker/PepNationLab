-- ============================================
-- REVERT: PEP NATION LAB + PEP NATION RX UNIFICATION
-- Migration: 20260528000002_revert_rx_roles
-- ============================================

-- Revert products policy
DROP POLICY IF EXISTS "Lab users can view active products" ON products;
CREATE POLICY "Authed users can view active products" ON products
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL AND is_active = true AND is_banned = false);

-- Revert pricing_tiers policy
DROP POLICY IF EXISTS "Lab users can view pricing tiers" ON pricing_tiers;
CREATE POLICY "Anyone can view pricing tiers" ON pricing_tiers
  FOR SELECT USING (true);

-- Revert agent_profiles policy
DROP POLICY IF EXISTS "Lab users can view active agent profiles" ON agent_profiles;
CREATE POLICY "Anyone can view active agent profiles" ON agent_profiles
  FOR SELECT USING (is_active = true);

-- Revert agent_products policy
DROP POLICY IF EXISTS "Lab users can view visible agent products" ON agent_products;
CREATE POLICY "Anyone can view visible agent products" ON agent_products
  FOR SELECT USING (is_visible = true);

-- Drop the helper function
DROP FUNCTION IF EXISTS is_lab_user();

-- Note: PostgreSQL does not support dropping values from an ENUM type using ALTER TYPE.
-- The roles ('doctor', 'patient', 'pharmacy', 'rx_admin') remain in the user_role enum 
-- but will not affect system operations as they are no longer referenced in RLS.
-- ============================================
-- PEP NATION LAB — Strict Inventory Deduction
-- Migration: 20260528000003_strict_inventory
-- ============================================

CREATE OR REPLACE FUNCTION deduct_inventory_on_order_approval()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  is_status_transition BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
  current_inventory INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Check if transitioning from pending to approved states
    IF (OLD.status = 'pending_customer_payment' OR OLD.status = 'agent_approval_pending') AND 
       (NEW.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) THEN
      is_status_transition := TRUE;
    END IF;
    
    -- Check if transitioning to cancelled from approved states
    IF (OLD.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND 
       (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
    END IF;
  END IF;

  IF is_status_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
    LOOP
      IF item.product_id IS NOT NULL THEN
        
        -- Lock the product row and get current inventory
        SELECT inventory_count INTO current_inventory 
        FROM public.products 
        WHERE id = item.product_id 
        FOR UPDATE;

        IF current_inventory < item.quantity THEN
           RAISE EXCEPTION 'Insufficient stock for product. Only % remaining, but % requested.', current_inventory, item.quantity;
        END IF;

        UPDATE public.products 
        SET inventory_count = inventory_count - item.quantity
        WHERE id = item.product_id;
        
      END IF;
    END LOOP;
  END IF;
  
  IF is_cancelled_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
    LOOP
      IF item.product_id IS NOT NULL THEN
        UPDATE public.products 
        SET inventory_count = inventory_count + item.quantity
        WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================
-- PEP NATION LAB — Phase 7 Migrations
-- Migration: 20260528000004_phase7_additions
-- ============================================

-- 1. Add Live Carts State to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cart_state JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS cart_updated_at TIMESTAMP WITH TIME ZONE;

-- 2. Storage Bucket for Product Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Allow public read access to images
CREATE POLICY "Public product images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Allow admins to upload/modify images
CREATE POLICY "Admin product images upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);

CREATE POLICY "Admin product images update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);

CREATE POLICY "Admin product images delete" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'product-images' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'shipping')
);
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
-- ============================================
-- PEP NATION LAB — Phase 15 Migrations
-- Migration: 20260528000006_phase15_messaging_inventory
-- ============================================

-- 1. Agent Inventory Table
CREATE TABLE IF NOT EXISTS public.agent_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(agent_id, product_id)
);

ALTER TABLE public.agent_inventory ENABLE ROW LEVEL SECURITY;

-- Agents can view their own inventory
CREATE POLICY "Agents can view their own inventory"
  ON public.agent_inventory FOR SELECT
  USING (agent_id = auth.uid());

-- Agents can update their own inventory
CREATE POLICY "Agents can update their own inventory"
  ON public.agent_inventory FOR UPDATE
  USING (agent_id = auth.uid());

-- Agents can insert their own inventory
CREATE POLICY "Agents can insert their own inventory"
  ON public.agent_inventory FOR INSERT
  WITH CHECK (agent_id = auth.uid());

-- Admins can manage all agent inventory
CREATE POLICY "Admins can manage agent inventory"
  ON public.agent_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'shipping')
    )
  );

-- Researchers can read agent inventory for their assigned agent
CREATE POLICY "Researchers can read agent inventory"
  ON public.agent_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND referring_agent_id = agent_inventory.agent_id
    )
  );

-- Public can read agent inventory (for storefront display before login)
CREATE POLICY "Public can read agent inventory"
  ON public.agent_inventory FOR SELECT
  USING (true);


-- 2. Internal Messages Table
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_url TEXT,
  type TEXT DEFAULT 'direct_message' CHECK (type IN ('direct_message', 'notification', 'invoice')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Users can read their own received messages
CREATE POLICY "Users can read their received messages"
  ON public.internal_messages FOR SELECT
  USING (receiver_id = auth.uid());

-- Users can read messages they sent
CREATE POLICY "Users can read sent messages"
  ON public.internal_messages FOR SELECT
  USING (sender_id = auth.uid());

-- Users can send messages
CREATE POLICY "Users can send messages"
  ON public.internal_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Users can mark messages as read
CREATE POLICY "Users can update their received messages"
  ON public.internal_messages FOR UPDATE
  USING (receiver_id = auth.uid());

-- Admins can read/manage all messages
CREATE POLICY "Admins can manage all messages"
  ON public.internal_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'shipping')
    )
  );


-- 3. Add Storefront Customization fields to agent_profiles
ALTER TABLE public.agent_profiles 
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 4. Create Storage Buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('storefront-assets', 'storefront-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for storefront-assets
CREATE POLICY "Public storefront assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'storefront-assets');

CREATE POLICY "Agents storefront assets upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'storefront-assets' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent')
);

CREATE POLICY "Agents storefront assets update" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'storefront-assets' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'agent')
);

-- Storage Policies for message-attachments
CREATE POLICY "Public message attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'message-attachments');

CREATE POLICY "Users message attachments upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'message-attachments' AND auth.role() = 'authenticated'
);
-- ============================================
-- PEP NATION LAB — Update Inventory Deduction Trigger
-- Migration: 20260528000007_update_inventory_trigger
-- ============================================

CREATE OR REPLACE FUNCTION deduct_inventory_on_order_approval()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  is_status_transition BOOLEAN := FALSE;
  is_cancelled_transition BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Check if transitioning from pending to approved states
    IF (OLD.status = 'pending_customer_payment' OR OLD.status = 'agent_approval_pending') AND 
       (NEW.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) THEN
      is_status_transition := TRUE;
    END IF;
    
    -- Check if transitioning to cancelled from approved states
    IF (OLD.status IN ('approved_ship', 'approved_pickup', 'in_fulfillment', 'shipped', 'delivered')) AND 
       (NEW.status = 'cancelled') THEN
      is_cancelled_transition := TRUE;
    END IF;
  END IF;

  IF is_status_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL THEN
          -- Agent Order: Deduct from agent's inventory
          UPDATE public.agent_inventory 
          SET stock_count = GREATEST(0, stock_count - item.quantity)
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          -- Direct Retail Order: Deduct from global inventory
          UPDATE public.products 
          SET inventory_count = GREATEST(0, inventory_count - item.quantity)
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  IF is_cancelled_transition THEN
    FOR item IN 
      SELECT product_id, quantity 
      FROM public.order_items 
      WHERE order_id = NEW.id 
    LOOP
      IF item.product_id IS NOT NULL THEN
        IF NEW.agent_id IS NOT NULL THEN
          -- Agent Order: Refund to agent's inventory
          UPDATE public.agent_inventory 
          SET stock_count = stock_count + item.quantity
          WHERE product_id = item.product_id AND agent_id = NEW.agent_id;
        ELSE
          -- Direct Retail Order: Refund to global inventory
          UPDATE public.products 
          SET inventory_count = inventory_count + item.quantity
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- ============================================
-- PEP NATION LAB — Bulk Pricing Migration
-- Migration: 20260528000008_bulk_pricing
-- ============================================

-- 1. Add Bulk Pricing to Products (Admin to Agent/Super Agent)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS admin_bulk_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS admin_bulk_threshold INTEGER DEFAULT 100;

-- 2. Add Bulk Pricing to Super Agent Pricing (Super Agent to Sub-Agent)
ALTER TABLE public.super_agent_pricing
ADD COLUMN IF NOT EXISTS bulk_baseline_cost NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS bulk_threshold INTEGER DEFAULT 100;
