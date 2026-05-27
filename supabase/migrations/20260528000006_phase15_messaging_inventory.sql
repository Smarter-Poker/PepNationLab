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
